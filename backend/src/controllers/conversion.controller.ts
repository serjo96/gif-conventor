import { Response, NextFunction, Request } from 'express';
import { ApiError, ApiResponse, ConversionResponse, BatchStatusResponse } from '../types/api.types';
import { FileRequest } from '../types/request.types';
import { ConversionService } from '../services/conversion.service';
import config from '../config';
import { ErrorCode } from '../types/api.types';

export class ConversionController {
  private conversionService: ConversionService;

  constructor() {
    this.conversionService = new ConversionService();
  }

  uploadVideo = async (req: FileRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ApiError(400, 'No video file uploaded', ErrorCode.FILE_REQUIRED);
      }
      await this.conversionService.validateFile(req.file);

      const jobId = await this.conversionService.processVideo(req.file);

      const response: ApiResponse<ConversionResponse> = {
        success: true,
        data: {
          jobId,
          status: 'queued'
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getBatchStatus = async (
    req: Request<any, any, { jobIds: string[] }>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { jobIds } = req.body;

      if (!Array.isArray(jobIds)) {
        throw new ApiError(400, 'jobIds must be an array', ErrorCode.INVALID_REQUEST);
      }
      const statuses = await Promise.all(
        jobIds.map(async (jobId) => {
          try {
            const job = await this.conversionService.getJobDetails(jobId);
            console.log('JOB_DATA_CONTROLLER', job);
            return {
              jobId,
              status: job.status,
              ...(job.status === 'completed' && {
                outputUrl: `${config.baseUrl}/${job.outputPath}`
              }),
              ...(job.error && {
                error: {
                  message: job.error.message,
                  code: job.error.code as ErrorCode
                }
              })
            };
          } catch (error) {
            return {
              jobId,
              status: 'not_found' as const
            };
          }
        })
      );

      console.log('STATUS_UPDATES_CONTROLLER', statuses);
      const response: ApiResponse<BatchStatusResponse> = {
        success: true,
        data: {
          jobs: statuses
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}
