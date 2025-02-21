import { Component, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';
import { UploadService, UploadProgress } from '../../services/upload.service';
import { Subscription } from 'rxjs';
import { FileListComponent } from '../file-list/file-list.component';
import { environment } from '../../../../../environments/environment';
import { FileStatusService } from '../../services/file-status.service';
import { FileProcessingStatus, StatusResponse, UploadedFile } from '../../types/upload.types';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressBarModule, FileListComponent],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
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
  readonly STATUS_CHECK_INTERVAL = 3000; // Changed from 10000 to 3000 ms
  isFileValid = false;

  constructor(
    private uploadService: UploadService,
    private fileStatusService: FileStatusService
  ) {}

  ngOnDestroy(): void {
    this.cancelUpload();
    this.clearStatusCheck();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      this.isFileValid = this.validateFile(file);
      if (this.isFileValid) {
        this.selectedFile = file;
        this.uploadStatus = '';
      } else {
        this.selectedFile = null;
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
      error: this.handleUploadError.bind(this),
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
      status: FileProcessingStatus.QUEUED,
    });

    this.startProcessingCheck(jobId);
  }

  private handleUploadError(error: any): void {
    this.isUploading = false;
    this.uploadProgress = 0;
    this.uploadSubscription = null;
    this.processingStatus = FileProcessingStatus.FAILED;

    // Add file to uploadedFiles with error status
    this.uploadedFiles.push({
      jobId: 'error',
      fileName: this.selectedFile?.name || 'Unknown file',
      status: FileProcessingStatus.FAILED,
      error: error.error?.error?.message || error.error?.message || 'File upload error',
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

  private handleStatusUpdate(status: StatusResponse, jobId: string): void {
    const fileIndex = this.uploadedFiles.findIndex((f) => f.jobId === jobId);
    if (fileIndex === -1) return;

    const updatedFile = this.fileStatusService.updateFileStatus(
      this.uploadedFiles[fileIndex],
      status
    );

    this.uploadedFiles = this.uploadedFiles.map((file, index) =>
      index === fileIndex ? updatedFile : file
    );

    if (status.status === 'completed') {
      this.uploadStatus = '';
    }
  }

  private handleStatusError(): void {
    this.processingStatus = FileProcessingStatus.FAILED;
    this.uploadStatus = 'Error checking status';
    this.clearStatusCheck();
  }

  private clearStatusCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
  }

  private startProcessingCheck(jobId: string): void {
    this.clearStatusCheck();

    const existingFile = this.uploadedFiles.find(
      (f) => f.jobId === jobId && f.status === FileProcessingStatus.COMPLETED
    );

    if (existingFile) return;

    this.statusCheckInterval = setInterval(() => {
      const pendingFiles = this.uploadedFiles.filter((f) =>
        this.fileStatusService.isPending(f.status)
      );

      if (pendingFiles.length === 0) {
        this.clearStatusCheck();
        return;
      }

      this.checkPendingFilesStatus(pendingFiles);
    }, this.STATUS_CHECK_INTERVAL);
  }

  private checkPendingFilesStatus(pendingFiles: UploadedFile[]): void {
    const jobIds = pendingFiles.map((f) => f.jobId);
    this.uploadService.getBatchStatus(jobIds).subscribe({
      next: (statuses) => {
        statuses.forEach((status, index) => {
          this.handleStatusUpdate(status, pendingFiles[index].jobId);
        });
      },
      error: this.handleStatusError.bind(this),
    });
  }

  getFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
