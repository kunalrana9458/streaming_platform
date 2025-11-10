import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { connection, MEDIA_QUEUE_NAME } from '../lib/queue';
import { connectDB, disconnectDB } from '../lib/db';
import  Media from '../modules/media/media.model';

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function start() {
  // 1) Connect to Mongo for this process
  await connectDB();

  // 2) Create worker AFTER DB connection
  const worker = new Worker(
    MEDIA_QUEUE_NAME,
    async (job: Job) => {
      console.log('[worker] job received', job.id, job.name, job.data);
      const { mediaId } = job.data;

      const media = await Media.findById(mediaId);
      if (!media) throw new Error('media not found');

      media.status = 'processing';
      await media.save();

      await sleep(5000); // simulate processing
      media.status = 'ready';
      await media.save();

      console.log(`[worker] media ${mediaId} processed -> ready`);
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
