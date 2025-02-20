import { Component, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';
import { UploadService, UploadProgress } from '../../services/upload.service';
import { Subscription } from 'rxjs';
import {FileListComponent} from '../file-list/file-list.component';
import {environment} from '../../../../../environments/environment';

export enum FileProcessingStatus {
  WAITING = 'waiting',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface UploadedFile {
  jobId: string;
  fileName: string;
  status: FileProcessingStatus;
  fileUrl?: string;
  error?: string;
  validationError?: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressBarModule,
    FileListComponent
  ],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent implements OnDestroy {
  selectedFile: File | null = null;
  isUploading = false;
  uploadStatus = '';
  uploadProgress = 0;
  readonly MAX_FILE_SIZE = environment.maxFileSize;
  private uploadSubscription: Subscription | null = null;
  processingStatus: FileProcessingStatus | null = null;
  downloadUrl: string | null = null;
  private statusCheckInterval: any;
  uploadedFiles: UploadedFile[] = [];
  readonly STATUS_CHECK_INTERVAL = 10000; // 10 seconds

  constructor(private uploadService: UploadService) {}

  ngOnDestroy(): void {
    this.cancelUpload();
    this.clearStatusCheck();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      if (this.validateFile(file)) {
        this.selectedFile = file;
        this.uploadStatus = '';
      }
    }
  }

  private validateFile(file: File): boolean {
    if (!file.type.includes('video/mp4')) {
      this.uploadStatus = 'Error: Only MP4 files are allowed';
      return false;
    }

    if (file.size > this.MAX_FILE_SIZE) {
      this.uploadStatus = `Error: File size should not exceed ${this.MAX_FILE_SIZE / 1024 / 1024}MB`;
      return false;
    }

    return true;
  }

  onUpload(): void {
    if (!this.selectedFile) return;

    this.resetUploadState();
    this.uploadSubscription = this.uploadService.uploadVideo(this.selectedFile).subscribe({
      next: (event: UploadProgress) => {
        if (event.type === 'progress') {
          this.uploadProgress = event.progress ?? 0;
        } else if (event.type === 'complete' && event.jobId) {
          this.handleUploadComplete(event.jobId);
        }
      },
      error: this.handleUploadError.bind(this)
    });
  }

  private resetUploadState(): void {
    this.isUploading = true;
    this.uploadProgress = 0;
    this.processingStatus = null;
    this.downloadUrl = null;
    this.uploadStatus = '';
  }

  private handleUploadComplete(jobId: string): void {
    this.uploadStatus = 'File uploaded successfully';
    this.isUploading = false;
    this.uploadSubscription = null;

    this.uploadedFiles.push({
      jobId,
      fileName: this.selectedFile?.name || 'Unknown file',
      status: FileProcessingStatus.WAITING
    });

    console.log(this.uploadedFiles);

    this.startProcessingCheck(jobId);
  }

  private handleUploadError(error: any): void {
    this.isUploading = false;
    this.uploadProgress = 0;
    this.uploadSubscription = null;
    this.processingStatus = FileProcessingStatus.ERROR;

    // Add file to uploadedFiles with error status
    this.uploadedFiles.push({
      jobId: 'error',
      fileName: this.selectedFile?.name || 'Unknown file',
      status: FileProcessingStatus.ERROR,
      error: error.error?.error?.message || error.error?.message || 'File upload error'
    });

    this.uploadStatus = ''; // Clear the upload status since we're showing error in the list
  }

  cancelUpload(): void {
    if (this.uploadSubscription) {
      this.uploadSubscription.unsubscribe();
      this.uploadSubscription = null;
      this.isUploading = false;
      this.uploadProgress = 0;
      this.uploadStatus = 'Upload cancelled';
    }
  }

  private startProcessingCheck(jobId: string): void {
    this.clearStatusCheck();

    const existingFile = this.uploadedFiles.find(f =>
      f.jobId === jobId &&
      (f.status === FileProcessingStatus.COMPLETED || f.fileUrl)
    );

    if (existingFile) {
      return;
    }

    this.processingStatus = FileProcessingStatus.WAITING;

    this.statusCheckInterval = setInterval(() => {
      const pendingFiles = this.uploadedFiles.filter(f =>
        f.status !== FileProcessingStatus.COMPLETED &&
        f.status !== FileProcessingStatus.ERROR
      );

      if (pendingFiles.length === 0) {
        this.clearStatusCheck();
        return;
      }

      const jobIds = pendingFiles.map(f => f.jobId);
      console.log('JOB_IDS',jobIds);
      this.uploadService.getBatchStatus(jobIds).subscribe({
        next: (statuses) => {
          console.log('STATUS_UPDATES',statuses);
          statuses.forEach((status, index) => {
            this.handleStatusUpdate(status, pendingFiles[index].jobId);
          });
        },
        error: this.handleStatusError.bind(this)
      });
    }, this.STATUS_CHECK_INTERVAL);
  }

  private handleStatusUpdate(status: any, jobId: string): void {
    const fileIndex = this.uploadedFiles.findIndex(f => f.jobId === jobId);
    if (fileIndex === -1) return;

    const file = this.uploadedFiles[fileIndex];

    const statusMap: Record<string, FileProcessingStatus> = {
      'queued': FileProcessingStatus.WAITING,
      'processing': FileProcessingStatus.PROCESSING,
      'completed': FileProcessingStatus.COMPLETED,
      'failed': FileProcessingStatus.ERROR,
      'not_found': FileProcessingStatus.ERROR
    };

    file.status = statusMap[status.status as keyof typeof statusMap] || FileProcessingStatus.ERROR;
    console.log('FILE_STATUS',file);
    console.log('STATUS',status);
    if (status.status === 'completed') {
      file.fileUrl = status.fileUrl;
      file.error = undefined;
      this.uploadStatus = '';
    } else if (status.status === 'failed' || status.status === 'not_found') {
      file.error = status.error?.message || 'File processing error';
      if (status.error?.validation) {
        file.validationError = status.error.validation;
      }
      this.uploadStatus = file.error || 'File upload error';
    }

    this.uploadedFiles = [...this.uploadedFiles];
    console.log('Updated file:', file);
  }

  private handleStatusError(): void {
    this.processingStatus = FileProcessingStatus.ERROR;
    this.uploadStatus = 'Error checking status';
    this.clearStatusCheck();
  }

  private clearStatusCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  getFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
