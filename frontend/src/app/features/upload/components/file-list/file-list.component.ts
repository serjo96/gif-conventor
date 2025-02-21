import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { UploadedFile, FileProcessingStatus } from '../../types/upload.types';

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './file-list.component.html',
  styleUrls: ['./file-list.component.scss'],
})
export class FileListComponent {
  @Input() files: UploadedFile[] = [];

  FileProcessingStatus = FileProcessingStatus;

  getStatusMessage(status: FileProcessingStatus): string {
    const messages = {
      [FileProcessingStatus.QUEUED]: 'Queued',
      [FileProcessingStatus.PROCESSING]: 'Processing...',
      [FileProcessingStatus.COMPLETED]: 'Completed',
      [FileProcessingStatus.FAILED]: 'Failed',
      [FileProcessingStatus.NOT_FOUND]: 'Not Found',
    };
    return messages[status] || 'Unknown status';
  }

  isProcessing(status: FileProcessingStatus): boolean {
    return [FileProcessingStatus.QUEUED, FileProcessingStatus.PROCESSING].includes(status);
  }
}
