export enum ErrorCode {
  FILE_REQUIRED = 'FILE_REQUIRED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  INVALID_VIDEO_DURATION = 'INVALID_VIDEO_DURATION',
  MULTER_ERROR = 'MULTER_ERROR',
  CONVERSION_ERROR = 'CONVERSION_ERROR',
  DIRECTORY_CREATE_ERROR = 'DIRECTORY_CREATE_ERROR',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: ErrorCode
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: ErrorCode;
    statusCode: number;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ConversionResponse {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  error?: {
    message: string;
    code?: ErrorCode;
  };
}

export interface BatchStatusResponse {
  jobs: Array<{
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
    outputUrl?: string;
    error?: {
      message: string;
      code: ErrorCode;
    };
  }>;
} 