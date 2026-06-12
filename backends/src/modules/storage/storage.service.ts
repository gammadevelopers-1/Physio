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
   * Restore the most recent soft-deleted generation of an object so
   * that the object becomes live again at the same path. Used by the
   * admin material recovery flow — when we restore the DB row, we
   * also bring the underlying GCS bytes back from the 90-day window.
   *
   * No-op on local storage: there is no soft-delete concept locally,
   * and deletes already short-circuit if the file is gone.
   */
  async restoreLatestSoftDeleted(
    bucket: 'public' | 'private' | 'trainers',
    filename: string,
  ): Promise<{ generation: string } | null> {
    if (this.useLocal) {
      // No soft-delete in local mode; nothing to do.
      return null;
    }

    const b = this.buckets![bucket];

    // If the live object already exists (e.g. it was never actually
    // deleted because of an earlier failure), there is nothing to
    // restore — return that as a success.
    try {
      const [liveExists] = await b.file(filename).exists();
      if (liveExists) {
        const [meta] = await b.file(filename).getMetadata();
        return { generation: String(meta.generation ?? '') };
      }
    } catch {
      // fall through to soft-delete lookup
    }

    // Find the most recently soft-deleted generation for this exact
    // object name. softDeleted=true + prefix narrows the scan.
    const [files] = await b.getFiles({
      softDeleted: true,
      prefix: filename,
      autoPaginate: true,
      maxResults: 50,
    });

    const exact = files.filter((f) => f.name === filename);
    if (exact.length === 0) {
      throw new Error(
        `No soft-deleted generations found for ${bucket}/${filename}. ` +
          `The 90-day window may have expired.`,
      );
    }

    // Sort by softDeleteTime/timeDeleted descending and pick newest.
    exact.sort((a, b2) => {
      const m1 = a.metadata as Record<string, unknown>;
      const m2 = b2.metadata as Record<string, unknown>;
      const t1 =
        typeof m1.timeDeleted === 'string'
          ? new Date(m1.timeDeleted).getTime()
          : typeof m1.softDeleteTime === 'string'
            ? new Date(m1.softDeleteTime).getTime()
            : 0;
      const t2 =
        typeof m2.timeDeleted === 'string'
          ? new Date(m2.timeDeleted).getTime()
          : typeof m2.softDeleteTime === 'string'
            ? new Date(m2.softDeleteTime).getTime()
            : 0;
      return t2 - t1;
    });

    const latest = exact[0];
    const meta = latest.metadata as Record<string, unknown>;
    const generation = String(meta.generation ?? '');
    if (!generation) {
      throw new Error(
        `Soft-deleted entry for ${bucket}/${filename} is missing a generation id.`,
      );
    }

    await b.file(filename).restore({ generation: Number(generation) });
    this.logger.log(
      `Restored ${bucket}/${filename} (generation ${generation})`,
    );
    return { generation };
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
   * Read the malware-scan verdict produced by the Eventarc-triggered
   * scanner ([infra/malware-scanner/main.js](infra/malware-scanner/main.js)).
   *
   * Verdict source of truth lives on the GCS object metadata:
   *   - `malware-scan: clean` + `malware-scan-at: <iso>`  → object scanned and passed
   *   - object missing entirely                          → moved to the quarantine
   *                                                          bucket (= infected)
   *   - metadata absent on a present object              → still scanning, or
   *                                                          skipped (>50 MiB)
   *
   * Local-storage driver has no scanner, so we report `clean` to avoid
   * false alarms in dev.
   */
  async getScanStatus(
    bucket: 'public' | 'private' | 'trainers',
    filename: string,
  ): Promise<{
    status: 'clean' | 'pending' | 'quarantined' | 'unknown';
    scannedAt: string | null;
  }> {
    if (this.useLocal || !this.buckets) {
      return { status: 'clean', scannedAt: null };
    }

    const file = this.buckets[bucket].file(filename);
    try {
      const [meta] = await file.getMetadata();
      const custom =
        (meta.metadata as Record<string, string | undefined>) || {};
      const verdict = custom['malware-scan'];
      const scannedAt = custom['malware-scan-at'] || null;
      if (verdict === 'clean') return { status: 'clean', scannedAt };
      // Object exists but no verdict yet → scan still running, or it
      // was skipped because it exceeded the scanner size cap. Either
      // way, treat as pending so the UI shows a "scan in progress"
      // chip rather than silently allowing the download.
      return { status: 'pending', scannedAt: null };
    } catch (err) {
      // getMetadata throws 404 when the object isn't in this bucket.
      // The scanner moves infected files to the quarantine bucket, so
      // a missing object on an attachment URL that was once valid
      // means it got yanked.
      const code = (err as { code?: number })?.code;
      if (code === 404) return { status: 'quarantined', scannedAt: null };
      this.logger.warn(
        `Scan-status lookup failed for ${bucket}/${filename}: ${err}`,
      );
      return { status: 'unknown', scannedAt: null };
    }
  }

  /**
   * Download a file as a Buffer given its URL (local or GCS).
   * Handles both local file paths and GCS-backed URLs.
   */
  async downloadBuffer(fileUrl: string): Promise<Buffer> {
    // If the URL is a local storage URL, read the file directly
    if (this.useLocal) {
      // Extract bucket and filename from URL like .../storage/files/{bucket}/{filename}
      const match = fileUrl.match(/\/storage\/files\/(public|private|trainers)\/(.+)/);
      if (match) {
        const [, bucket, filename] = match;
        const filePath = path.join(this.localDir, bucket, filename);
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath);
        }
      }
    }

    // For GCS or external URLs, fetch via HTTP
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
