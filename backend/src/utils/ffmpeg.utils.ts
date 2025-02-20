import { spawn } from 'child_process';
import { ApiError } from '../types/api.types';
import path from 'path';

export class FFmpegConverter {
  static readonly OUTPUT_FPS = 5;
  static readonly OUTPUT_HEIGHT = 400;

  static async convertToGif(
    inputPath: string,
    jobId: string,
    originalName: string
  ): Promise<string> {
    console.log('FFMPEG_CONVERTER_INPUTS:', {
      inputPath,
      jobId,
      originalName
    });
    const outputPath = path.join('uploads/output', `${jobId}-${originalName}.gif`);
    console.log('FFMPEG_OUTPUT_PATH:', outputPath);

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i',
        inputPath,
        '-vf',
        `fps=${this.OUTPUT_FPS},scale=-1:${this.OUTPUT_HEIGHT}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        '-y',
        outputPath
      ]);

      let errorOutput = '';
      let stdoutOutput = '';

      ffmpeg.stdout.on('data', (data) => {
        stdoutOutput += data.toString();
      });

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          console.error('FFmpeg error output:', errorOutput);
          reject(new ApiError(500, `FFmpeg conversion failed: ${errorOutput.split('\n')[0]}`));
          return;
        }
        resolve(outputPath);
      });

      ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err);
        reject(new ApiError(500, 'Failed to start FFmpeg process. Is FFmpeg installed?'));
      });
    });
  }
}
