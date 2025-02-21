
export enum FileProcessingStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NOT_FOUND = 'not_found'
}

export interface UploadedFile {
  jobId: string;
  fileName: string;
  status: FileProcessingStatus;
  fileUrl?: string;
  error?: string;
  validationError?: string;
}

export interface StatusResponse {
  status: string;
  fileUrl?: string;
  error?: {
    message: string;
    validation?: string;
  };
}
