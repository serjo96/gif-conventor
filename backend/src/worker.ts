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
  async (job: Job<JobData>) => {
    const { inputPath, jobId, originalName } = job.data;

    try {
      await job.updateProgress(PROGRESS_STAGES.STARTED);
      await job.log(`Starting conversion attempt ${job.attemptsMade + 1}`);

      // Validate input file exists
      const fileExists = await validateInputFile(inputPath);
      if (!fileExists) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      await job.updateProgress(PROGRESS_STAGES.VALIDATION);

      // Convert file
      await job.updateProgress(PROGRESS_STAGES.CONVERSION_PREP);
      await FFmpegConverter.convertToGif(inputPath, jobId, originalName);
      await job.updateProgress(PROGRESS_STAGES.CONVERSION_DONE);

      // Cleanup
      await fs.unlink(inputPath);
      await job.updateProgress(PROGRESS_STAGES.COMPLETED);
      await job.log('Conversion completed successfully');

      return {
        outputPath: path.join('uploads/output', `${jobId}-${originalName}.gif`)
      };
    } catch (error) {
      await handleJobError(job, error);
      throw error;
    }
  },
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password
    },
    concurrency: 3,
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

async function handleJobError(job: Job<JobData>, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  await job.log(`Failed with error: ${errorMessage}`);
}

// Event handlers
worker.on('failed', async (job: Job<JobData> | undefined, err: Error) => {
  if (!job) return;

  const logContext = {
    jobId: job.id,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    error: err.message
  };

  console.error('Job failed:', logContext);

  if (job.attemptsMade >= (job.opts.attempts || 1)) {
    console.log(`Job ${job.id} has failed all retry attempts`);
  }
});

worker.on('completed', (job: Job<JobData>) => {
  console.log(`Job ${job.id} completed successfully`);
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
