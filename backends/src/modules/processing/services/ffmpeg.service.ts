import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
}

export interface ResolutionConfig {
  label: string;
  width: number;
  height: number;
  videoBitrate: string;
  audioBitrate: string;
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);
  private readonly tempDir: string;
  private readonly resolutions: ResolutionConfig[];

  constructor(private configService: ConfigService) {
    this.tempDir = this.configService.get<string>('processing.tempDir') || '/tmp/physio-processing';
    this.resolutions = this.configService.get<ResolutionConfig[]>('processing.ffmpeg.resolutions') || [];
  }

  isEnabled(): boolean {
    return this.configService.get<boolean>('processing.ffmpeg.enabled') !== false;
  }

  getResolutions(): ResolutionConfig[] {
    return this.resolutions;
  }

  async ensureTempDir(materialId: string): Promise<string> {
    const dir = path.join(this.tempDir, materialId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  async cleanupTempDir(materialId: string): Promise<void> {
    const dir = path.join(this.tempDir, materialId);
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup temp dir: ${dir}`, error);
    }
  }

  /**
   * Get video metadata (duration, width, height).
   */
  getVideoInfo(inputPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        if (!videoStream) return reject(new Error('No video stream found'));

        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
        });
      });
    });
  }

  /**
   * Transcode video to a specific resolution.
   * Returns the output file path and file size.
   */
  transcodeToResolution(
    inputPath: string,
    outputPath: string,
    config: ResolutionConfig,
  ): Promise<{ fileSize: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-vf scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease,pad=${config.width}:${config.height}:(ow-iw)/2:(oh-ih)/2`,
          `-b:v ${config.videoBitrate}`,
          `-b:a ${config.audioBitrate}`,
          '-c:v libx264',
          '-c:a aac',
          '-movflags +faststart',
          '-preset medium',
        ])
        .output(outputPath)
        .on('end', async () => {
          try {
            const stats = await stat(outputPath);
            resolve({ fileSize: stats.size });
          } catch (e) {
            reject(e);
          }
        })
        .on('error', reject)
        .run();
    });
  }

  /**
   * Extract audio from video as MP3.
   * Whisper API accepts mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25MB).
   */
  extractAudio(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  /**
   * Write a buffer to a temp file.
   */
  async writeBufferToTemp(materialId: string, filename: string, buffer: Buffer): Promise<string> {
    const dir = await this.ensureTempDir(materialId);
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  /**
   * Read a file as buffer.
   */
  async readFileAsBuffer(filePath: string): Promise<Buffer> {
    return fs.readFileSync(filePath);
  }

  /**
   * Delete a single temp file.
   */
  async deleteTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch {
      // best-effort cleanup
    }
  }
}
