import { Response, NextFunction, Request } from 'express';
import { ApiError, ApiResponse } from '../types/api.types';
import { FileRequest } from '../types/request.types';
import { ConversionService } from '../services/conversion.service';
import config from '../config';
import { ErrorCode } from '../types/api.types';
import { FileValidator } from '../utils/file.utils';

interface JobStatus {
  jobId: string;
  status: string;
  outputUrl?: string;
  error?: {
    message: string;
    code: ErrorCode;
  };
}

export class ConversionController {
  constructor(private readonly conversionService: ConversionService = new ConversionService()) {}

  uploadVideo = async (req: FileRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.validateUploadRequest(req);

      const jobId = await this.processVideoUpload(req.file!);

      this.sendSuccessResponse(res, {
        jobId,
        status: 'queued'
      });
    } catch (error) {
      next(error);
    }
  };

  getBatchStatus = async (
    req: Request<any, any, { jobIds: string[] }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      this.validateBatchStatusRequest(req);

      const statuses = await this.getJobStatuses(req.body.jobIds);

      this.sendSuccessResponse(res, { jobs: statuses });
    } catch (error) {
      next(error);
    }
  };

  private validateUploadRequest(req: FileRequest): void {
    if (!req.file) {
      throw new ApiError(400, 'No video file uploaded', ErrorCode.FILE_REQUIRED);
    }
  }

  private async processVideoUpload(file: Express.Multer.File): Promise<string> {
    await FileValidator.validateVideoFile(file);
    return this.conversionService.processVideo(file);
  }

  private validateBatchStatusRequest(req: Request): void {
    const { jobIds } = req.body;
    if (!Array.isArray(jobIds)) {
      throw new ApiError(400, 'jobIds must be an array', ErrorCode.INVALID_REQUEST);
    }
  }

  private async getJobStatuses(jobIds: string[]): Promise<JobStatus[]> {
    return Promise.all(
      jobIds.map(async (jobId) => {
        try {
          const job = await this.conversionService.getJobDetails(jobId);
          return this.formatJobStatus(job);
        } catch (error) {
          return this.createNotFoundStatus(jobId);
        }
      })
    );
  }

  private formatJobStatus(job: any): JobStatus {
    const status: JobStatus = {
      jobId: job.jobId,
      status: job.status
    };

    if (job.status === 'completed') {
      status.outputUrl = `${config.baseUrl}/${job.outputPath}`;
    }

    if (job.error) {
      status.error = {
        message: job.error.message,
        code: job.error.code as ErrorCode
      };
    }

    return status;
  }

  private createNotFoundStatus(jobId: string): JobStatus {
    return {
      jobId,
      status: 'not_found'
    };
  }

  private sendSuccessResponse<T>(res: Response, data: T): void {
    const response: ApiResponse<T> = {
      success: true,
      data
    };
    res.json(response);
  }
}
