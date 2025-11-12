
import 'dotenv/config';
import path from 'path';
import { Worker, Job } from 'bullmq';
import { connection, MEDIA_QUEUE_NAME } from '../lib/queue';
import { connectDB, disconnectDB } from '../lib/db';
import  Media from '../modules/media/media.model';
import { downloadObjectToTemp,presignGet } from '../lib/minio.client'
import { uploadDir } from '../lib/minio.client'
import { tmpSubdir } from '../utils/tmp'
import fs from 'fs';
import { probeUrl } from '../utils/ffmpeg';
import { transcodeToHlsSingle } from '../utils/hls';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));



async function processJob(job:Job) {
  // check first media exist or not
  const { mediaId } = job.data as {mediaId: string}
  const media = await Media.findById(mediaId)
  if(!media) throw new Error('Media Not found')

    const addLog = async (msg:string) => {
      await Media.updateOne(
        {_id: mediaId},
        {$push: {processingLogs: `[${new Date().toString()}] ${msg}`}}
      )
    }

    await Media.updateOne({_id: mediaId},{$set: {status:'processing',progress: 10}})
    await job.updateProgress(10);
    await addLog('Job Started')

    // 1-> get source locally
    const srcPath = await downloadObjectToTemp(media.objectKey)
    await addLog(`Download Sourc: ${srcPath}`)
    await Media.updateOne({_id: mediaId},{$set:{progress:25}})
    await job.updateProgress(25);

    // 2-> Transcode to HLS (Single bitrate) into a temp folder
    const workDir = tmpSubdir(`media-${mediaId}`)
    const {masterPath} = await transcodeToHlsSingle(srcPath,workDir,{
      variantName: 'hls_2400k',
      videoBitrate: '128k',
      hlsTime: 4,
      hlsListSize: 0,
    })

    await addLog(`ffmpeg HLS created: ${masterPath}`)
    await Media.updateOne({_id: mediaId},{$set :{progress:70}})
    await job.updateProgress(70)

    // 3-> upload HLS directory to MinIO
    // we' ll under: hls/<mediaId>/... (so keys are stable)
    const hlsPrefix = `hls/${mediaId}`
    await uploadDir(workDir,hlsPrefix)
    await addLog(`uploaded HLS folder to MinIO at prefix: ${hlsPrefix}`)

    // master key relative to the bucket
    const masterRelKey = path.join(hlsPrefix,'hls_2400k','master.m3u8').replace(/\\/g,'/')

    // 4-> Update DD with outputUrlKey and finalize
    await Media.updateOne(
      {_id: mediaId},
      { $set:{ status:'ready', progress:100, outputUrlKey:masterRelKey}}
    );
    await job.updateProgress(100)
    await addLog(`Job Finished: outputUrlKey=${masterRelKey}`)

    // 5-> cleaup temp files (best-effort)
    try {fs.unlinkSync(srcPath)} catch{}
    try {fs.rmSync(workDir,{recursive:true,force:true})} catch {}
}


async function start() {
  // 1) Connect to Mongo for this process
  await connectDB();

  // 2) Create worker AFTER DB connection
  const worker = new Worker(
    MEDIA_QUEUE_NAME,
    async (job: Job) => {
      try {
        console.log(`[worker] started job ${job.id} of type ${job.name}`);
        await processJob(job);
      } catch (error) {
        console.error(`[worker] error processing job ${job.id}:`, error);
        throw error;
      }
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error('[worker] job failed', job?.id, err);
  });

  const shutdown = async () => {
    console.log('Shutting down worker');
    await worker.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('[worker] failed to start:', err);
  process.exit(1);
});
