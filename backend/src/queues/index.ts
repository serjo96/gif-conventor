import { Queue } from 'bullmq';
import config from '../config';

export const conversionQueue = new Queue('video-conversion', {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3, // Number of retry attempts
    backoff: {
      type: 'exponential',
      delay: 5000, // Initial delay of 5 seconds
    },
    removeOnComplete: false, // Keep completed jobs
    removeOnFail: false, // Keep failed jobs
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await conversionQueue.close();
}); 