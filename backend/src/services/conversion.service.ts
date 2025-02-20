import { ApiError } from '../types/api.types';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { conversionQueue } from '../queues';

import { FileValidator } from '../utils/file.utils';
import { ErrorCode } from '../types/api.types';

export interface ConversionJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  inputPath: string;
  outputPath?: string;
  error?: {
    message: string;
    code: string;
  };
}

export class ConversionService {
  private readonly baseDir = 'uploads';
  private readonly inputDir = 'uploads/input';
  private readonly outputDir = 'uploads/output';

  constructor() {
    this.ensureDirectories().catch((error) => {
      console.error('Failed to create required directories:', error);
      process.exit(1);
    });
  }

  private async ensureDirectories() {
    for (const dir of [this.baseDir, this.inputDir, this.outputDir]) {
      try {
        await fs.access(dir);
      } catch {
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          throw new ApiError(
            500,
            `Failed to create directory ${dir}: ${message}`,
            ErrorCode.DIRECTORY_CREATE_ERROR
          );
        }
      }
    }
  }

  private async removeFile(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
      console.log(`[DEBUG] Would remove file: ${filePath}`);
    } catch (error) {
      if (error instanceof Error && (error as any).code !== 'ENOENT') {
        console.error(`Failed to remove file ${filePath}:`, error);
      }
    }
  }

  async validateFile(file: Express.Multer.File): Promise<void> {
    try {
      await FileValidator.validateVideoFile(file);
    } catch (error) {
      throw error;
    }
  }

  async processVideo(file: Express.Multer.File): Promise<string> {
    const jobId = uuidv4();
    const originalName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9]/g, '_');
    const inputFileName = `${jobId}-${path.basename(file.filename)}`;
    const inputPath = path.join(this.inputDir, inputFileName);

    try {
      await fs.rename(file.path, inputPath);

      console.log('[DEBUG] After rename:', {
        sourceExists: await fs
          .access(file.path)
          .then(() => true)
          .catch(() => false),
        destinationExists: await fs
          .access(inputPath)
          .then(() => true)
          .catch(() => false),
        inputDirContents: await fs.readdir(this.inputDir)
      });

      await conversionQueue.add(
        'convert',
        {
          inputPath,
          jobId,
          originalName
        },
        {
          jobId,
          removeOnComplete: false,
          removeOnFail: 1000 * 60 * 60 * 24
        }
      );

      return jobId;
    } catch (error) {
      console.error('Video processing failed:', error);
      throw error;
    }
  }

  async getJobDetails(jobId: string): Promise<ConversionJob> {
    const queueJob = await conversionQueue.getJob(jobId);
    if (!queueJob) {
      throw new ApiError(404, 'Job not found', ErrorCode.JOB_NOT_FOUND);
    }

    const jobState = await queueJob.getState();
    const status = this.mapBullState(jobState);
    const originalName = queueJob.data.originalName || jobId;
    console.log('ORIGINAL_NAME_SERVICE', originalName);
    return {
      id: jobId,
      status,
      inputPath: queueJob.data.inputPath,
      ...(status === 'completed' && {
        outputPath: path.join('uploads/output', `${jobId}-${originalName}.gif`)
      }),
      ...(queueJob.failedReason && {
        error: {
          message: queueJob.failedReason,
          code: ErrorCode.CONVERSION_ERROR
        }
      })
    };
  }

  private mapBullState(state: string): ConversionJob['status'] {
    switch (state) {
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'active':
        return 'processing';
      default:
        return 'queued';
    }
  }
}
