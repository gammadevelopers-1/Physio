import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage, Bucket } from '@google-cloud/storage';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private buckets: {
    public: Bucket;
    private: Bucket;
    trainers: Bucket;
  };

  constructor(private configService: ConfigService) {
    // Initialize Google Cloud Storage
    // In production, uses default credentials from environment
    // Locally, uses GOOGLE_APPLICATION_CREDENTIALS env var
    this.storage = new Storage({
      projectId: this.configService.get('storage.projectId'),
    });

    // Initialize bucket references
    const bucketNames = this.configService.get('storage.buckets');
    this.buckets = {
      public: this.storage.bucket(bucketNames.public),
      private: this.storage.bucket(bucketNames.private),
      trainers: this.storage.bucket(bucketNames.trainers),
    };
  }

  /**
   * Upload a file to the public bucket
   */
  async uploadPublic(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    return this.uploadFile(this.buckets.public, file, filename, contentType, true);
  }

  /**
   * Upload a file to the private bucket
   */
  async uploadPrivate(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    return this.uploadFile(this.buckets.private, file, filename, contentType, false);
  }

  /**
   * Upload a trainer document
   */
  async uploadTrainerDocument(
    file: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    return this.uploadFile(this.buckets.trainers, file, filename, contentType, false);
  }

  /**
   * Get a signed URL for private file access
   */
  async getSignedUrl(
    bucket: 'public' | 'private' | 'trainers',
    filename: string,
  ): Promise<string> {
    const expiration = this.configService.get('storage.signedUrlExpiration') || 60;
    const [url] = await this.buckets[bucket].file(filename).getSignedUrl({
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
    try {
      await this.buckets[bucket].file(filename).delete();
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
    const results: Record<string, boolean> = {};

    for (const [name, bucket] of Object.entries(this.buckets)) {
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
   * Internal upload helper
   */
  private async uploadFile(
    bucket: Bucket,
    file: Buffer,
    filename: string,
    contentType: string,
    isPublic: boolean,
  ): Promise<string> {
    const blob = bucket.file(filename);

    await blob.save(file, {
      contentType,
      public: isPublic,
      metadata: {
        cacheControl: 'public, max-age=31536000', // 1 year cache
      },
    });

    if (isPublic) {
      return `https://storage.googleapis.com/${bucket.name}/${filename}`;
    }

    // Return signed URL for private files
    return this.getSignedUrl(
      bucket.name.includes('private')
        ? 'private'
        : bucket.name.includes('trainers')
          ? 'trainers'
          : 'public',
      filename,
    );
  }
}
