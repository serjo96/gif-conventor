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
      delay: 2000 // начальная задержка 2 секунды
    },
    removeOnComplete: true, // удалять успешные задачи для экономии памяти
    removeOnFail: false    // сохранять неудачные для анализа
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await conversionQueue.close();
});
