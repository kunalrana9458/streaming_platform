// src/workers/media-worker.ts
import 'dotenv/config';
import path from 'path';
import { Worker, Job } from 'bullmq';
import { connection, MEDIA_QUEUE_NAME } from '../lib/queue';
import { connectDB, disconnectDB } from '../lib/db';
import Media from '../modules/media/media.model';
import { downloadObjectToTemp, uploadFile, uploadDir } from '../lib/minio.client';
import { tmpSubdir } from '../utils/tmp';
import fs from 'fs';
import os from 'os';
import { transcodeToHlsSingle } from '../utils/hls';
import { generateSpriteAndVtt, generateThumbnails } from '../utils/thumbs';
import { mediaJobDuration, mediaJobsTotal } from '../observability/metrics';
import logger from '../observability/logger';
import { Sentry } from '../observability/sentry';

async function processJob(job: Job) {
  const { mediaId } = job.data as { mediaId: string };

  const log = logger.child({
    jobId: job.id,
    jobName: job.name,
    mediaId
  });

  log.info('Media processing job started');
  
  const media = await Media.findById(mediaId);
  if (!media) {
    log.warn('Media not found');
    throw new Error('Media Not found');
  }

  const addLog = async (msg: string) => {
    await Media.updateOne(
      { _id: mediaId },
      { $push: { processingLogs: `[${new Date().toISOString()}] ${msg}` } }
    );
  };

  // mark processing start
  await Media.updateOne({ _id: mediaId }, { $set: { status: 'processing', progress: 10 } });
  await job.updateProgress(10);
  await addLog('Job started');

  // prepare tmp dirs
  const workDir = tmpSubdir(`media-${mediaId}`);
  const thumbWork = path.join(os.tmpdir(), `thumbs-${mediaId}`);

  const endTimer = mediaJobDuration.startTimer();

  try {
    // logs the job start
    log.info('Downloading original media file');
    // 1 -> download original
    const srcPath = await downloadObjectToTemp(media.objectKey);
    await addLog(`Downloaded source: ${srcPath}`);
    await Media.updateOne({ _id: mediaId }, { $set: { progress: 25 } });
    await job.updateProgress(25);

    // 2 -> transcode to HLS (single bitrate)
    log.info('Transcoding video to HLS');
    const variantName = 'hls_2400k';
    // IMPORTANT: videoBitrate should be a video bitrate like '2400k', not '128k'
    const { masterPath } = await transcodeToHlsSingle(srcPath, workDir, {
      variantName,
      videoBitrate: '2400k',
      hlsTime: 4,
      hlsListSize: 0,
    });

    await addLog(`ffmpeg HLS created: ${masterPath}`);
    await Media.updateOne({ _id: mediaId }, { $set: { progress: 70 } });
    await job.updateProgress(70);

    // 3 -> upload HLS directory to MinIO under hls/<mediaId>/
    log.info('Uploading HLS output to MinIO');
    const hlsPrefix = `hls/${mediaId}`;
    await uploadDir(workDir, hlsPrefix);
    await addLog(`Uploaded HLS folder to MinIO at prefix: ${hlsPrefix}`);

    // master key relative to the bucket
    const masterRelKey = path.posix.join(hlsPrefix, variantName, 'master.m3u8').replace(/\\/g, '/');

    // 4 -> generate thumbnails & sprite + vtt
    log.info('Generating thumbnails and sprite');
    fs.mkdirSync(thumbWork, { recursive: true });
    await addLog(`Generating thumbnails in ${thumbWork}`);

    // generate thumbnails (12 *320px)
    let thumbs: string[] = [];
    try {
      thumbs = await generateThumbnails(srcPath, thumbWork, { count: 12, width: 320 });
      await addLog(`Generated ${thumbs.length} thumbnails`);
    } catch (err) {
      // don't crash entire job for small thumbnail failure, but log and continue
      log.warn({err},'Thumbnail generation failed');
      await addLog(`Thumbnail generation failed: ${(err as Error).message}`);
      thumbs = [];
    }

    const spriteLocal = path.join(thumbWork, 'sprite.jpg');
    const vttLocal = path.join(thumbWork, 'sprite.vtt');
    const duration = media.metadata?.duration || 0;

    try {
      await generateSpriteAndVtt(thumbs, spriteLocal, vttLocal, { columns: 4, thumbWidth: 320, duration });
      await addLog(`Sprite + VTT generated: ${spriteLocal}, ${vttLocal}`);
    } catch (err) {
      log.warn({err},'Sprite/VTT generation failed');
      await addLog(`Sprite/VTT generation failed: ${(err as Error).message}`);
    }

    await Media.updateOne({ _id: mediaId }, { $set: { progress: 85 } });
    await job.updateProgress(85);

    // 5 -> upload thumbnails + sprite + vtt to MinIO under thumbnails/<mediaId>/
    log.info('Uploading thumbnails to MinIO');
    const thumbPrefix = `thumbnails/${mediaId}`;
    const thumbKeys: string[] = [];

    for (const t of thumbs) {
      try {
        const key = `${thumbPrefix}/${path.basename(t)}`;
        await uploadFile(key, t);
        thumbKeys.push(key);
      } catch (err) {
        await addLog(`Failed upload thumb ${t}: ${(err as Error).message}`);
      }
    }

    // upload sprite & vtt if present
    let spriteKey: string | null = null;
    let vttKey: string | null = null;
    try {
      if (fs.existsSync(spriteLocal)) {
        spriteKey = `${thumbPrefix}/${path.basename(spriteLocal)}`;
        await uploadFile(spriteKey, spriteLocal);
      }
      if (fs.existsSync(vttLocal)) {
        vttKey = `${thumbPrefix}/${path.basename(vttLocal)}`;
        await uploadFile(vttKey, vttLocal);
      }
    } catch (err) {
      await addLog(`Failed upload sprite/vtt: ${(err as Error).message}`);
    }

    // 6 -> update DB final
    await Media.updateOne(
      { _id: mediaId },
      {
        $set: {
          status: 'ready',
          progress: 100,
          outputUrlKey: masterRelKey,
          thumbnails: thumbKeys,
          spriteKey,
          vttKey,
        },
      }
    );

    await job.updateProgress(100);
    await addLog(`Job finished: outputUrlKey=${masterRelKey}`);
    log.info('Media Processing complete successfully');
    mediaJobsTotal.inc({status:'success'})
  } catch (err) {
    // add the metric when error occur
    mediaJobsTotal.inc({status:'failed'});
    Sentry.captureException(err);

    log.error({err},'Media Processing job failed');
    // mark failed and record error
    const msg = (err as Error).message || String(err);
    await addLog(`Job failed: ${msg}`);
    await Media.updateOne({ _id: mediaId }, { $set: { status: 'failed', progress: 0 } });
    throw err; // rethrow so BullMQ records failure
  } finally {
    // best-effort cleanup of temp files
    try {
      // remove original download if exists
      // note: we don't know srcPath here in outer scope if download failed early; safe guard
      // remove workDir & thumbWork
      try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
      try { fs.rmSync(thumbWork, { recursive: true, force: true }); } catch {}
      endTimer()
    } catch {}
  }
}

async function start() {
  // connect DB
  await connectDB();
  logger.info('Media Worker started and DB connected');

  // create worker after DB connected
  const worker = new Worker(
    MEDIA_QUEUE_NAME,
    async (job: Job) => {
      try {
        logger.info(`[worker] started job ${job.id} of type ${job.name}`);
        await processJob(job);
      } catch (error) {
        logger.error({error},`[worker] error processing job ${job.id}:`);
        throw error;
      }
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id,err },
      'Worker job failed'
    )
  });

  const shutdown = async () => {
    logger.info('Shutting down media worker');
    await worker.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  logger.error({ err },'Worker failed to start');
  process.exit(1);
});
