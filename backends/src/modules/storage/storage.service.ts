import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly useLocal: boolean;
  private readonly localDir: string;
  private readonly baseUrl: string;

  // GCP fields — only initialized when driver=gcp
  private storage: import('@google-cloud/storage').Storage | null = null;
  private buckets: {
    public: import('@google-cloud/storage').Bucket;
    private: import('@google-cloud/storage').Bucket;
    trainers: import('@google-cloud/storage').Bucket;
  } | null = null;

  constructor(private configService: ConfigService) {
    const driver = this.configService.get<string>('storage.driver') || 'local';
    this.useLocal = driver === 'local';

    const port = this.configService.get<number>('PORT', 8080);
    const apiPrefix = this.configService.get<string>('API_PREFIX', 'api');
    const appUrl = this.configService.get<string>('APP_URL');
    this.baseUrl = appUrl || `http://localhost:${port}/${apiPrefix}`;
    this.localDir = this.configService.get<string>('storage.localDir') || './uploads';

    if (this.useLocal) {
      // Ensure local upload directories exist
      const dirs = ['public', 'private', 'trainers'].map((d) =>
        path.join(this.localDir, d),
      );
      for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.logger.log(`Local storage configured → ${path.resolve(this.localDir)}`);
    } else {
      // Initialize Google Cloud Storage
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Storage } = require('@google-cloud/storage');
      this.storage = new Storage({
        projectId: this.configService.get('storage.projectId'),
      });

      const bucketNames = this.configService.get('storage.buckets');
      this.buckets = {
        public: this.storage!.bucket(bucketNames.public),
        private: this.storage!.bucket(bucketNames.private),
        trainers: this.storage!.bucket(bucketNames.trainers),
      };
      this.logger.log('GCP Cloud Storage configured');
    }
  }

  /**
   * Upload a file to the public bucket
   */
  async uploadPublic(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    if (this.useLocal) {
      return this.uploadLocal('public', file, filename);
    }
    return this.uploadGcp(this.buckets!.public, file, filename, contentType, true);
  }

  /**
   * Upload a file to the private bucket
   */
  async uploadPrivate(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    if (this.useLocal) {
      return this.uploadLocal('private', file, filename);
    }
    return this.uploadGcp(this.buckets!.private, file, filename, contentType, false);
  }

  /**
   * Upload a trainer document
   */
  async uploadTrainerDocument(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    if (this.useLocal) {
      return this.uploadLocal('trainers', file, filename);
    }
    return this.uploadGcp(this.buckets!.trainers, file, filename, contentType, false);
  }

  /**
   * Get a signed URL for private file access (GCP only; local returns direct URL)
   */
  async getSignedUrl(
    bucket: 'public' | 'private' | 'trainers',
    filename: string,
  ): Promise<string> {
    if (this.useLocal) {
      return `${this.baseUrl}/storage/files/${bucket}/${filename}`;
    }
    const expiration = this.configService.get('storage.signedUrlExpiration') || 60;
    const [url] = await this.buckets![bucket].file(filename).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiration * 60 * 1000,
    });
    return url;
  }

  /**
   * Delete a file
   */
  async deleteFile(
    bucket: 'public' | 'private' | 'trainers',
    filename: string,
  ): Promise<void> {
    if (this.useLocal) {
      const filePath = path.join(this.localDir, bucket, filename);
      try {
        fs.unlinkSync(filePath);
        this.logger.log(`Deleted local file: ${filePath}`);
      } catch (error) {
        this.logger.error(`Failed to delete local file: ${filePath}`, error);
      }
      return;
    }
    try {
      await this.buckets![bucket].file(filename).delete();
      this.logger.log(`Deleted file: ${filename} from ${bucket}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Check if storage is configured and accessible
   */
  async healthCheck(): Promise<{ status: string; buckets: Record<string, boolean> }> {
    if (this.useLocal) {
      const results: Record<string, boolean> = {};
      for (const name of ['public', 'private', 'trainers']) {
        results[name] = fs.existsSync(path.join(this.localDir, name));
      }
      return {
        status: Object.values(results).every((v) => v) ? 'ok' : 'partial',
        buckets: results,
      };
    }

    const results: Record<string, boolean> = {};
    for (const [name, bucket] of Object.entries(this.buckets!)) {
      try {
        await bucket.exists();
        results[name] = true;
      } catch {
        results[name] = false;
      }
    }
    return {
      status: Object.values(results).every((v) => v) ? 'ok' : 'partial',
      buckets: results,
    };
  }

  /**
   * Resolve a local file path (for serving files in dev)
   */
  getLocalFilePath(bucket: string, filename: string): string | null {
    if (!this.useLocal) return null;
    const filePath = path.join(this.localDir, bucket, filename);
    return fs.existsSync(filePath) ? filePath : null;
  }

  /**
   * Whether we're using local storage
   */
  get isLocal(): boolean {
    return this.useLocal;
  }

  /**
   * Get the GCS bucket name for a given bucket type
   */
  getBucketName(bucket: 'public' | 'private' | 'trainers'): string | null {
    if (this.useLocal || !this.buckets) return null;
    return this.buckets[bucket].name;
  }

  /**
   * Get a readable stream for a file from GCS (for proxying files through the backend)
   */
  async getFileStream(
    bucket: 'public' | 'private' | 'trainers',
    filename: string,
  ): Promise<import('stream').Readable | null> {
    if (this.useLocal || !this.buckets) return null;

    const file = this.buckets[bucket].file(filename);
    const [exists] = await file.exists();
    if (!exists) return null;

    return file.createReadStream();
  }

  /**
   * Get a file's contents as a Buffer
   */
  async getFileBuffer(
    bucket: 'public' | 'private' | 'trainers',
    filename: string,
  ): Promise<Buffer | null> {
    if (this.useLocal) {
      const filePath = this.getLocalFilePath(bucket, filename);
      if (!filePath) return null;
      return fs.readFileSync(filePath);
    }

    const stream = await this.getFileStream(bucket, filename);
    if (!stream) return null;

    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  // ── Private helpers ──

  private async uploadLocal(
    bucket: string,
    file: Buffer,
    filename: string,
  ): Promise<string> {
    const dir = path.join(this.localDir, bucket, path.dirname(filename));
    fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(this.localDir, bucket, filename);
    fs.writeFileSync(filePath, file);
    this.logger.log(`Saved local file: ${filePath}`);

    return `${this.baseUrl}/storage/files/${bucket}/${filename}`;
  }

  private async uploadGcp(
    bucket: import('@google-cloud/storage').Bucket,
    file: Buffer,
    filename: string,
    contentType: string,
    _isPublic: boolean,
  ): Promise<string> {
    const blob = bucket.file(filename);

    await blob.save(file, {
      contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      },
    });

    // Always return a backend-served URL so files are served via our
    // storage controller (which generates signed URLs for GCS).
    // This avoids needing public bucket ACLs that org policies may block.
    const bucketType = bucket.name.includes('private')
      ? 'private'
      : bucket.name.includes('trainers')
        ? 'trainers'
        : 'public';
    return `${this.baseUrl}/storage/files/${bucketType}/${filename}`;
  }
}
