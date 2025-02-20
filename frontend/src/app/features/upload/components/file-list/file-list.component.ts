import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {UploadedFile} from '../upload/upload.component';
import {FileProcessingStatus} from '../upload/upload.component'

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './file-list.component.html',
  styleUrls: ['./file-list.component.scss']
})
export class FileListComponent {
  @Input() files: UploadedFile[] = [];

  FileProcessingStatus = FileProcessingStatus;

  getStatusMessage(status: FileProcessingStatus): string {
    const messages = {
      [FileProcessingStatus.WAITING]: 'Waiting...',
      [FileProcessingStatus.PROCESSING]: 'Processing...',
      [FileProcessingStatus.COMPLETED]: 'Completed',
      [FileProcessingStatus.ERROR]: 'Error'
    };
    return messages[status];
  }
}
