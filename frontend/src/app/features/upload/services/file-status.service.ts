import { Injectable } from '@angular/core';
import { StatusResponse } from '../types/upload.types';
import { UploadedFile } from '../types/upload.types';
import { FileProcessingStatus } from '../types/upload.types';


@Injectable({
  providedIn: 'root'
})
export class FileStatusService {
  private readonly statusMap: Record<string, FileProcessingStatus> = {
    queued: FileProcessingStatus.QUEUED,
    processing: FileProcessingStatus.PROCESSING,
    completed: FileProcessingStatus.COMPLETED,
    failed: FileProcessingStatus.FAILED,
    not_found: FileProcessingStatus.NOT_FOUND
  };

  updateFileStatus(file: UploadedFile, status: StatusResponse): UploadedFile {
    const newStatus = this.statusMap[status.status] || FileProcessingStatus.FAILED;
    
    return {
      ...file,
      status: newStatus,
      fileUrl: status.status === 'completed' ? status.fileUrl : file.fileUrl,
      error: this.getErrorMessage(status),
      validationError: status.error?.validation
    };
  }

  private getErrorMessage(status: StatusResponse): string | undefined {
    if (status.status === 'completed') {
      return undefined;
    }
    return status.status === 'failed' || status.status === 'not_found' 
      ? status.error?.message || 'File processing error'
      : undefined;
  }

  isPending(status: FileProcessingStatus): boolean {
    return ![FileProcessingStatus.COMPLETED, FileProcessingStatus.FAILED].includes(status);
  }
} 