import { Queue } from 'bullmq';
import config from '../config';

export const conversionQueue = new Queue('video-conversion', {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: {
      count: 1000,
      age: 3600
    },
    removeOnFail: {
      count: 500
    },
    priority: 1
  }
});

process.on('SIGTERM', async () => {
  await conversionQueue.close();
});
