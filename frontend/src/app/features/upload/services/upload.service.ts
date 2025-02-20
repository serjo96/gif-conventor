import { Injectable } from '@angular/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ConversionStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
  fileUrl?: string;
  error?: string;
}

export interface UploadProgress {
  type: 'progress' | 'complete';
  progress?: number;
  jobId?: string;
}

export interface ConversionResponse {
  success: boolean;
  data: {
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
    outputUrl?: string;
    error?: string;
  };
}

interface BatchStatusResponse {
  jobs: Array<{
    jobId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
    outputUrl?: string;
    error?: {
      message: string;
      code: string;
    };
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  uploadVideo(file: File): Observable<UploadProgress> {
    const formData = new FormData();
    formData.append('video', file);

    return this.http
      .post(`${this.apiUrl}/conversion/upload`, formData, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        map((event: HttpEvent<any>): UploadProgress => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = Math.round((100 * event.loaded) / (event.total ?? event.loaded));
            return { type: 'progress', progress };
          }

          if (event.type === HttpEventType.Response) {
            return {
              type: 'complete',
              jobId: event.body.data.jobId,
            };
          }

          return { type: 'progress', progress: 0 };
        })
      );
  }

  getStatus(jobId: string): Observable<ConversionStatus> {
    return this.http.get<ConversionResponse>(`${this.apiUrl}/conversion/status/${jobId}`).pipe(
      map((response) => ({
        status: response.data.status,
        fileUrl: response.data.outputUrl,
        error: response.data.error,
      }))
    );
  }

  getBatchStatus(jobIds: string[]): Observable<ConversionStatus[]> {
    return this.http
      .post<ApiResponse<BatchStatusResponse>>(`${this.apiUrl}/conversion/status`, { jobIds })
      .pipe(
        map((response) =>
          response.data.jobs.map((job) => ({
            status: job.status === 'not_found' ? 'failed' : job.status,
            fileUrl: job.outputUrl,
            error: job.error?.message,
          }))
        )
      );
  }
}
