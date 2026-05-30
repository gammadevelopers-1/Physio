import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { backups } from '../../database/schema';
import { AuditLogService } from '../audit-logs/audit-logs.service';

interface SourceBucket {
  label: 'public' | 'private' | 'trainers';
  name: string;
}

interface BuildResult {
  bytes: number;
  fileCount: number;
  skipped: number;
}

/**
 * Files backup management — produces a single downloadable .zip of every
 * uploaded file across the three upload buckets (public, private, trainers).
 *
 * Streaming pipeline: each file is piped GCS read → archiver → GCS write.
 * No local disk, no in-memory buffering of file contents. Memory stays
 * flat regardless of total upload size.
 *
 * Job model: the controller returns immediately with a 202-style row.
 * A background promise does the streaming work and updates the row's
 * status on completion or failure. Container restarts that orphan a
 * 'running' row are reaped by markStaleAsFailed() on the next list().
 */
@Injectable()
export class FilesBackupService {
  private readonly logger = new Logger(FilesBackupService.name);

  private readonly enabled = (process.env.STORAGE_DRIVER || 'local') === 'gcp';
  private readonly projectId =
    process.env.GCP_PROJECT_ID || 'nelc-elearning-platform-479319';
  private readonly bucket =
    process.env.BACKUPS_BUCKET || 'physioguidance-backups';
  private readonly sources: SourceBucket[] = [
    {
      label: 'public',
      name: process.env.STORAGE_BUCKET_PUBLIC || 'physioguidance-public',
    },
    {
      label: 'private',
      name: process.env.STORAGE_BUCKET_PRIVATE || 'physioguidance-private',
    },
    {
      label: 'trainers',
      name: process.env.STORAGE_BUCKET_TRAINERS || 'physioguidance-trainers',
    },
  ];

  private storage: import('@google-cloud/storage').Storage | null = null;

  constructor(private readonly audit: AuditLogService) {}

  // ── Posture ─────────────────────────────────────────────────────

  getOverview() {
    return {
      enabled: this.enabled,
      sourceBuckets: this.sources.map((s) => s.name),
      destinationBucket: this.bucket,
    };
  }

  // ── Create ──────────────────────────────────────────────────────

  /**
   * Kick off a files-export job. Inserts the row, schedules the
   * background pipeline, returns the row id immediately. Polling is
   * via the existing /admin/backups list endpoint.
   */
  async createFilesExport(userId: string, ip?: string) {
    this.assertEnabled();

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const objectName = `files/files-backup-${stamp}.zip`;

    const [record] = await db
      .insert(backups)
      .values({
        type: 'files',
        mode: 'files_export',
        status: 'running',
        gcsBucket: this.bucket,
        gcsObject: objectName,
        createdBy: userId,
      })
      .returning();

    await this.audit.log({
      entityType: 'backup',
      entityId: record.id,
      action: 'backup.files_export_started',
      performedBy: userId,
      ipAddress: ip,
      metadata: { mode: 'files_export', object: objectName },
    });

    // Fire-and-forget. We deliberately do NOT await — the request must
    // return promptly. Any thrown error is caught and persisted.
    void this.runExport(record.id, objectName, userId, ip);

    return { id: record.id, status: 'running', object: objectName };
  }

  // ── Background pipeline ─────────────────────────────────────────

  private async runExport(
    rowId: string,
    objectName: string,
    userId: string,
    ip?: string,
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.buildAndUpload(objectName);
      await db
        .update(backups)
        .set({
          status: 'completed',
          completedAt: new Date(),
          fileSizeBytes: result.bytes,
        })
        .where(eq(backups.id, rowId));
      await this.audit.log({
        entityType: 'backup',
        entityId: rowId,
        action: 'backup.files_export_completed',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          object: objectName,
          fileCount: result.fileCount,
          skipped: result.skipped,
          bytes: result.bytes,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Files export ${rowId} failed: ${message}`);
      await db
        .update(backups)
        .set({
          status: 'failed',
          error: message.slice(0, 1000),
          completedAt: new Date(),
        })
        .where(eq(backups.id, rowId));
      await this.audit.log({
        entityType: 'backup',
        entityId: rowId,
        action: 'backup.files_export_failed',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          object: objectName,
          error: message.slice(0, 500),
          durationMs: Date.now() - startedAt,
        },
      });
    }
  }

  /**
   * Streams every file in every source bucket into a single zip and
   * uploads it to the backups bucket. Streaming all the way: nothing
   * buffers in memory or hits local disk.
   */
  private async buildAndUpload(objectName: string): Promise<BuildResult> {
    const storage = this.getStorage();
    const destBucket = storage.bucket(this.bucket);
    const destFile = destBucket.file(objectName);

    // resumable: true uses GCS's resumable upload protocol — survives
    // transient network blips by checkpointing chunks instead of failing
    // the whole upload. Critical when the archive is large enough to take
    // more than a few seconds (videos especially).
    const writeStream = destFile.createWriteStream({
      resumable: true,
      metadata: {
        contentType: 'application/zip',
        cacheControl: 'private, max-age=0',
      },
    });

    // archiver v8+ is a pure ESM package, so it can only be loaded from
    // our CJS-compiled NestJS code via dynamic `import()`. v8 also dropped
    // the `archiver('zip', ...)` factory function in favour of named
    // format classes — we instantiate ZipArchive directly.
    const archiverMod = (await import('archiver')) as unknown as {
      ZipArchive: new (options: {
        zlib?: { level?: number };
      }) => import('archiver').Archiver;
    };
    const archive = new archiverMod.ZipArchive({
      zlib: { level: 6 },
      // Most uploads (images, PDFs) are already compressed; level 6 still
      // saves on text-y assets without much CPU cost.
    });

    let fileCount = 0;
    let skipped = 0;

    // Wire failure propagation so a single broken stream fails the job
    // rather than silently truncating.
    const uploadDone = new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (warn) => {
        if ((warn as NodeJS.ErrnoException).code !== 'ENOENT') reject(warn);
      });
    });

    archive.pipe(writeStream);

    for (const src of this.sources) {
      const bucket = storage.bucket(src.name);
      let pageToken: string | undefined;
      do {
        // getFiles with manual paging keeps the file-name array small
        // even if the bucket has tens of thousands of objects.
        const [pageFiles, , apiResp] = await bucket.getFiles({
          maxResults: 1000,
          pageToken,
          autoPaginate: false,
        });
        for (const f of pageFiles) {
          // Skip "directories" (GCS placeholder objects ending with /).
          if (f.name.endsWith('/')) continue;
          // Download the file to a buffer (with retries on transient
          // network errors), then append the buffer to the archive. We
          // intentionally avoid streaming from GCS through archiver
          // because a stream error mid-file aborts the whole archive —
          // buffering isolates failures per file. Memory stays bounded
          // because archiver processes appends sequentially.
          const buf = await this.downloadWithRetry(f, src.label);
          if (buf === null) {
            skipped++;
            continue;
          }
          archive.append(buf, { name: `${src.label}/${f.name}` });
          fileCount++;
        }
        pageToken = (apiResp as { nextPageToken?: string })?.nextPageToken;
      } while (pageToken);
    }

    await archive.finalize();
    await uploadDone;

    // archive.pointer() can be unreliable depending on archiver version
    // and the timing of the resumable upload's final ack. The uploaded
    // object's own metadata.size is the source of truth — quick lookup
    // after the writeStream has already finished.
    let bytes = archive.pointer();
    try {
      const [meta] = await destFile.getMetadata();
      if (meta.size) bytes = Number(meta.size);
    } catch {
      // best-effort: fall back to archive.pointer() if metadata fetch fails
    }

    return {
      bytes,
      fileCount,
      skipped,
    };
  }

  /**
   * Download one GCS object to a Buffer, retrying on transient network
   * errors (ECONNRESET, ETIMEDOUT, socket hang up). Returns null after
   * the final retry fails so the caller can skip the file and continue.
   */
  private async downloadWithRetry(
    file: import('@google-cloud/storage').File,
    bucketLabel: string,
    maxAttempts = 3,
  ): Promise<Buffer | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const [buf] = await file.download();
        return buf;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === maxAttempts) {
          this.logger.warn(
            `download failed for ${bucketLabel}/${file.name} after ${maxAttempts} attempts: ${msg}`,
          );
          return null;
        }
        // Linear backoff is plenty for transient network blips.
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    return null;
  }

  // ── Internals ───────────────────────────────────────────────────

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Files backup is only available in the production environment.',
      );
    }
  }

  private getStorage(): import('@google-cloud/storage').Storage {
    if (!this.storage) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Storage } = require('@google-cloud/storage');
      this.storage = new Storage({ projectId: this.projectId });
    }
    return this.storage!;
  }
}
