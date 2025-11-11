
import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { connection, MEDIA_QUEUE_NAME } from '../lib/queue';
import { connectDB, disconnectDB } from '../lib/db';
import  Media from '../modules/media/media.model';
import { presignGet } from '../lib/minio.client'
import { probeUrl } from '../utils/ffmpeg';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));


async function processJob(job:Job) {
  const { mediaId } = job.data as {mediaId:string};
  const media = await Media.findById(mediaId);
  if(!media) throw new Error('media not found');

  const addLog = async (msg:string) => {
    media.processingLogs = media.processingLogs || [];
    media.processingLogs.push(`[${new Date().toISOString()}] ${msg}`);
    await media.save();
  }

  await addLog('Job Started: Processing media');
  media.status = 'processing';
  media.progress = 10;
  await media.save();

  await job.updateProgress(10);

  // get a short lived url to read the original data from minio
  const sourceUrl = await presignGet(media.objectKey,600);
  await addLog('Generated presigned URL for source media');
  media.progress = 25;
  await media.save();
  await job.updateProgress(25);

  // probe meta data
  const meta = await probeUrl(sourceUrl);
  await addLog(`Probed media metadata: ${JSON.stringify(meta)}`);
  media.metadata = meta;
  media.progress = 70;
  await media.save()
  await job.updateProgress(70);

  // reaplce the code with actual HLS transcode
  // for now similate remaining processing time and steps
  await addLog('Simulating media transcoding...');
  await sleep(2000);

  media.progress = 100
  media.status = 'ready';
  await media.save();
  await job.updateProgress(100);
  await addLog('Media processing completed. Media is ready.');
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
