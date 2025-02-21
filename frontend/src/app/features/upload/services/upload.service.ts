import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { FileProcessingStatus, StatusResponse } from '../types/upload.types';

export interface UploadProgress {
  type: 'progress' | 'complete';
  progress?: number;
  jobId?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface UploadResponseData {
  jobId: string;
}

interface BatchStatusResponse {
  jobs: Array<{
    jobId: string;
    status: FileProcessingStatus;
    outputUrl?: string;
    error?: {
      message: string;
      code: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  uploadVideo(file: File): Observable<UploadProgress> {
    const formData = new FormData();
    formData.append('video', file);

    return this.http
      .post<ApiResponse<UploadResponseData>>(`${this.apiUrl}/conversion/upload`, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event: HttpEvent<ApiResponse<UploadResponseData>>): UploadProgress => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = Math.round((100 * event.loaded) / (event.total ?? event.loaded));
            return { type: 'progress', progress };
          }

          if (event.type === HttpEventType.Response && event.body) {
            return {
              type: 'complete',
              jobId: event.body.data.jobId,
            };
          }

          return { type: 'progress', progress: 0 };
        })
      );
  }

  getStatus(jobId: string): Observable<StatusResponse> {
    return this.http
      .get<
        ApiResponse<{ status: FileProcessingStatus; outputUrl?: string; error?: string }>
      >(`${this.apiUrl}/conversion/status/${jobId}`)
      .pipe(
        map((response) => ({
          status: response.data.status,
          fileUrl: response.data.outputUrl,
          error: response.data.error ? { message: response.data.error } : undefined,
        }))
      );
  }

  getBatchStatus(jobIds: string[]): Observable<StatusResponse[]> {
    return this.http
      .post<ApiResponse<BatchStatusResponse>>(`${this.apiUrl}/conversion/status`, { jobIds })
      .pipe(
        map((response) =>
          response.data.jobs.map((job) => ({
            status:
              job.status === FileProcessingStatus.NOT_FOUND
                ? FileProcessingStatus.FAILED
                : job.status,
            fileUrl: job.outputUrl,
            error: job.error ? { message: job.error.message } : undefined,
          }))
        )
      );
  }
}
