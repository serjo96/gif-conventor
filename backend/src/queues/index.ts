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
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

process.on('SIGTERM', async () => {
  await conversionQueue.close();
});
