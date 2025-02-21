import { ApiError } from '../types/api.types';
import { spawn } from 'child_process';
import path from 'path';

export class FileValidator {
  static readonly MAX_WIDTH = 1024;
  static readonly MAX_HEIGHT = 768;
  static readonly MAX_DURATION = 10;

  static async validateVideoFile(file: Express.Multer.File): Promise<void> {
    this.validateFileType(file.path);

    await Promise.all([
      this.validateVideoDimensions(file.path),
      this.validateVideoDuration(file.path)
    ]);
  }

  private static validateFileType(filePath: string): void {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.mp4', '.m4v'].includes(ext)) {
      throw new ApiError(400, 'Only MP4 files are allowed');
    }
  }

  private static async validateVideoDimensions(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'json',
        filePath
      ]);

      let output = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new ApiError(500, 'Failed to probe video dimensions'));
          return;
        }

        try {
          const { streams } = JSON.parse(output);
          const { width, height } = streams[0];

          if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
            reject(
              new ApiError(
                400,
                `Video dimensions must not exceed ${this.MAX_WIDTH}x${this.MAX_HEIGHT}`
              )
            );
            return;
          }

          resolve();
        } catch (error) {
          reject(new ApiError(500, 'Failed to parse video metadata'));
        }
      });
    });
  }

  private static async validateVideoDuration(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'json',
        filePath
      ]);

      let output = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new ApiError(500, 'Failed to probe video duration'));
          return;
        }

        try {
          const { format } = JSON.parse(output);
          const duration = parseFloat(format.duration);

          if (duration > this.MAX_DURATION) {
            reject(
              new ApiError(400, `Video duration must not exceed ${this.MAX_DURATION} seconds`)
            );
            return;
          }

          resolve();
        } catch (error) {
          reject(new ApiError(500, 'Failed to parse video metadata'));
        }
      });
    });
  }
}
