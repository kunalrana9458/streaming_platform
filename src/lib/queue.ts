import { Queue } from 'bullmq'; // If you're on BullMQ v4+, QueueScheduler is optional
import IORedis, { RedisOptions } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_URL  = process.env.REDIS_URL; // optional: redis://localhost:6379

const baseOptions: RedisOptions = REDIS_URL
  ? { maxRetriesPerRequest: null } 
  : { host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null };


export const connection = REDIS_URL
  ? new IORedis(REDIS_URL, baseOptions)
  : new IORedis(baseOptions);

export const MEDIA_QUEUE_NAME = 'media-processing';

// define the queue for the webhook job processing
export const WEBHOOK_QUEUE_NAME = 'stripe:webhook:queue';

// Producer queue (re-use the same options)
export const mediaQueue = new Queue(MEDIA_QUEUE_NAME, {
  connection
});

export const webhookQueue = new Queue(WEBHOOK_QUEUE_NAME,{
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
})