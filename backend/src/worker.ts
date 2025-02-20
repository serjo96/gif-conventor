import { Worker, Job } from 'bullmq';
import config from './config';
import { FFmpegConverter } from './utils/ffmpeg.utils';
import { promises as fs } from 'fs';
import path from 'path';

interface JobData {
  inputPath: string;
  jobId: string;
  originalName: string;
}

const worker = new Worker<JobData>(
  'video-conversion',
  async (job: Job<JobData>) => {
    console.log('[DEBUG] Worker starting job:', {
      jobId: job.id,
      inputPath: job.data.inputPath,
      attempt: `${job.attemptsMade + 1}/${job.opts.attempts}`
    });

    const { inputPath, jobId, originalName } = job.data;

    console.log('[DEBUG] File system check:', {
      inputPath,
      exists: await fs
        .access(inputPath)
        .then(() => true)
        .catch(() => false),
      inputDir: path.dirname(inputPath),
      dirContents: await fs.readdir(path.dirname(inputPath)),
      absolutePath: path.resolve(inputPath)
    });

    try {
      // Проверяем существование файла
      /*try {
      console.log('inputPath', inputPath);

      await fs.access(inputPath);
    } catch (error) {
      // Если это последняя попытка, выбрасываем ошибку
      if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      // Иначе пробуем снова
      throw new Error(`Retry: Input file not found: ${inputPath}`);
    }*/

      await job.updateProgress(0);
      await job.log(`Starting conversion attempt ${job.attemptsMade + 1}`);

      await job.updateProgress(30);

      await job.updateProgress(60);

      console.log('[DEBUG] Pre-conversion check:', {
        inputPath,
        exists: await fs
          .access(inputPath)
          .then(() => true)
          .catch(() => false),
        stats: await fs.stat(inputPath).catch(() => null)
      });

      await FFmpegConverter.convertToGif(inputPath, jobId, originalName);

      await job.updateProgress(90);
      // Удаляем входной файл только после успешной конвертации
      // и только если это была успешная попытка
      await fs.unlink(inputPath);

      await job.updateProgress(100);
      await job.log('Conversion completed successfully');

      console.log(`Worker ${process.pid} completed job:`, jobId);
      return { outputPath: path.join('uploads/output', `${jobId}-${originalName}.gif`) };
    } catch (error) {
      console.error(`Worker ${process.pid} failed job:`, jobId, error);
      await job.log(
        `Failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Only delete input file on final attempt
      if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
        // await fs.unlink(inputPath).catch(console.error);
        await job.log('Cleaned up input file after final attempt');
      }
      throw error;
    }
  },
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password
    },
    concurrency: 1,
    limiter: {
      max: 5,
      duration: 1000 * 60
    }
  }
);

// Enhanced error handling and logging
worker.on('failed', async (job: Job<JobData> | undefined, err: Error) => {
  if (!job) return;

  console.error(`Worker ${process.pid} failed job ${job.id}:`, err);
  console.log(`Attempts made: ${job.attemptsMade} of ${job.opts.attempts}`);

  if (job.attemptsMade >= (job.opts.attempts || 1)) {
    console.log(`Job ${job.id} has failed all retry attempts`);
  }
});

worker.on('completed', (job: Job<JobData>) => {
  console.log(`Worker ${process.pid} completed job ${job.id}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing worker...');
  await worker.close();
});

process.on('uncaughtException', async (err) => {
  console.error('Uncaught exception:', err);
  await worker.close();
  process.exit(1);
});

export default worker;
