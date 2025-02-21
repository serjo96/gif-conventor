import { Worker, Job } from 'bullmq';
import { conversionQueue } from './queues';
import config from './config';
import { FFmpegConverter } from './utils/ffmpeg.utils';
import { promises as fs } from 'fs';
import path from 'path';

interface JobData {
  inputPath: string;
  jobId: string;
  originalName: string;
  timings: {
    startedAt: number | null;
    enqueuedAt: number;
    ffmpegStartedAt?: number | null;
    completedAt?: number | null;
  };
}

interface JobResult {
  outputPath: string;
}

const PROGRESS_STAGES = {
  STARTED: 0,
  VALIDATION: 30,
  CONVERSION_PREP: 60,
  CONVERSION_DONE: 90,
  COMPLETED: 100
} as const;

const worker = new Worker<JobData, JobResult>(
  'video-conversion',
  async (job) => {
    const { jobId, inputPath } = job.data;

    if (!job.data.timings) {
      job.data.timings = {
        enqueuedAt: Date.now(),
        startedAt: 0,
        ffmpegStartedAt: 0,
        completedAt: 0
      };
    }

    console.log(`[Job ${jobId}] Received job data:`, {
      inputPath,
      timings: job.data.timings,
      jobAttempt: job.attemptsMade + 1,
      timestamp: new Date().toISOString()
    });

    try {
      job.data.timings.startedAt = Date.now();
      console.log(
        `[Job ${jobId}] Started at: ${new Date(job.data.timings.startedAt).toISOString()}`
      );
      console.log(
        `[Job ${jobId}] Time in queue: ${(job.data.timings.startedAt - job.data.timings.enqueuedAt) / 1000}s`
      );

      job.data.timings.ffmpegStartedAt = Date.now();
      console.log(
        `[Job ${jobId}] FFmpeg started at: ${new Date(job.data.timings.ffmpegStartedAt).toISOString()}`
      );

      // Validate input file exists
      const fileExists = await validateInputFile(inputPath);
      if (!fileExists) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      await job.updateProgress(PROGRESS_STAGES.VALIDATION);

      // Convert file
      await job.updateProgress(PROGRESS_STAGES.CONVERSION_PREP);
      await FFmpegConverter.convertToGif(inputPath, jobId, job.data.originalName);
      await job.updateProgress(PROGRESS_STAGES.CONVERSION_DONE);

      // Cleanup
      await fs.unlink(inputPath);
      await job.updateProgress(PROGRESS_STAGES.COMPLETED);
      await job.log('Conversion completed successfully');

      job.data.timings.completedAt = Date.now();
      console.log(
        `[Job ${jobId}] Completed at: ${new Date(job.data.timings.completedAt).toISOString()}`
      );
      console.log(`[Job ${jobId}] Processing summary:
        Total duration: ${(job.data.timings.completedAt - job.data.timings.enqueuedAt) / 1000}s
        Queue time: ${(job.data.timings.startedAt - job.data.timings.enqueuedAt) / 1000}s
        FFmpeg time: ${(job.data.timings.completedAt - job.data.timings.ffmpegStartedAt) / 1000}s`);

      return {
        outputPath: path.join('uploads/output', `${jobId}-${job.data.originalName}.gif`)
      };
    } catch (error) {
      console.error(`[Job ${jobId}] Failed with error:`, {
        error: error instanceof Error ? error.message : String(error),
        attempt: job.attemptsMade + 1,
        timings: job.data.timings,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  },
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3
    },
    concurrency: 5,
    lockDuration: 20000,
    stalledInterval: 20000,
    limiter: {
      max: 50,
      duration: 1000 * 30
    }
  }
);

async function validateInputFile(inputPath: string): Promise<boolean> {
  try {
    await fs.access(inputPath);
    const stats = await fs.stat(inputPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

// Event handlers
worker.on('error', (err) => {
  console.error('Worker error:', err);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on('completed', (job) => {
  const processingTime = Date.now() - (job.data.timings.startedAt ?? Date.now());
  console.log(`Job ${job.id} completed in ${processingTime}ms`);
});

// Graceful shutdown handlers
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
