import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditLogService } from '../audit-logs/audit-logs.service';

interface SourceBucket {
  label: 'public' | 'private' | 'trainers' | 'cms';
  name: string;
}

export interface DeletedFileEntry {
  bucket: string;
  bucketLabel: string;
  name: string;
  generation: string;
  size: number | null;
  deletedAt: string | null;
  contentType: string | null;
}

export interface DeletedFilesListing {
  available: boolean;
  items: DeletedFileEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
}

/**
 * Per-file recovery from the GCS soft-delete window. The 4 upload buckets
 * (public, private, trainers, cms) keep deleted/overwritten objects for
 * 90 days; this service exposes a paginated cross-bucket view and a
 * restore-by-generation action.
 *
 * Restore is non-destructive: it creates a new live version of the object
 * from the soft-deleted historical version. The historical version stays
 * recoverable until the soft-delete window expires.
 */
@Injectable()
export class FileRecoveryService {
  private readonly logger = new Logger(FileRecoveryService.name);

  private readonly enabled = (process.env.STORAGE_DRIVER || 'local') === 'gcp';
  private readonly projectId =
    process.env.GCP_PROJECT_ID || 'nelc-elearning-platform-479319';
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
    {
      label: 'cms',
      name: process.env.STORAGE_CMS_BUCKET || 'physioguidance-cms',
    },
  ];

  private storage: import('@google-cloud/storage').Storage | null = null;

  constructor(private readonly audit: AuditLogService) {}

  // ── Listing ─────────────────────────────────────────────────────

  /**
   * Cross-bucket list of soft-deleted files, freshest deletion first,
   * paginated in memory. Best-effort per bucket: a failure on one bucket
   * does not break the whole listing — that bucket contributes 0 rows
   * and the error is surfaced in the logs.
   */
  async listDeleted(page = 1, limit = 20): Promise<DeletedFilesListing> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const empty: DeletedFilesListing = {
      available: false,
      items: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      totalPages: 1,
    };
    if (!this.enabled) return empty;

    const all: DeletedFileEntry[] = [];
    const storage = this.getStorage();

    for (const src of this.sources) {
      try {
        const bucket = storage.bucket(src.name);
        // Cap at 500 per bucket to keep the round-trip predictable.
        // If real-world usage shows more, swap to streaming/lazy paging.
        const [files] = await bucket.getFiles({
          softDeleted: true,
          autoPaginate: true,
          maxResults: 500,
        });
        for (const f of files) {
          const meta = f.metadata as Record<string, unknown>;
          all.push({
            bucket: src.name,
            bucketLabel: src.label,
            name: f.name,
            generation: String(meta.generation || ''),
            size: meta.size != null ? Number(meta.size) : null,
            deletedAt:
              typeof meta.timeDeleted === 'string'
                ? meta.timeDeleted
                : typeof meta.softDeleteTime === 'string'
                  ? meta.softDeleteTime
                  : null,
            contentType:
              typeof meta.contentType === 'string' ? meta.contentType : null,
          });
        }
      } catch (err) {
        this.logger.warn(
          `listDeleted: bucket ${src.name} failed: ${(err as Error).message}`,
        );
        // continue with the other buckets
      }
    }

    // Sort by deletion time, newest deletion first. Files without a
    // timestamp sink to the bottom.
    all.sort((a, b) => {
      const at = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const bt = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return bt - at;
    });

    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const start = (safePage - 1) * safeLimit;
    const items = all.slice(start, start + safeLimit);

    return {
      available: true,
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  // ── Restore ─────────────────────────────────────────────────────

  /**
   * Restore one soft-deleted object to live state. Identified by bucket
   * label, full object name, and generation (so the admin can only
   * restore the specific historical version they were shown).
   */
  async restore(
    bucketLabel: string,
    name: string,
    generation: string,
    userId: string,
    ip?: string,
  ) {
    this.assertEnabled();

    if (!bucketLabel || !name || !generation) {
      throw new BadRequestException(
        'Missing required fields: bucketLabel, name, generation.',
      );
    }
    // Defensive validation — generation is numeric (GCS uses an int64),
    // bucket label is one of our known labels, and the object name has
    // a reasonable upper bound.
    if (!/^\d+$/.test(generation)) {
      throw new BadRequestException('Invalid generation value.');
    }
    if (name.length > 1024) {
      throw new BadRequestException('Object name too long.');
    }
    const src = this.sources.find((s) => s.label === bucketLabel);
    if (!src) {
      throw new BadRequestException(
        `Unknown bucket label "${bucketLabel}". Expected one of: ${this.sources
          .map((s) => s.label)
          .join(', ')}.`,
      );
    }

    const startedAt = Date.now();
    try {
      const storage = this.getStorage();
      const file = storage.bucket(src.name).file(name);
      // file.restore() resolves once GCS has re-created the live object
      // from the soft-deleted generation. The returned File's .metadata
      // is NOT guaranteed to be hydrated, so fetch it explicitly for the
      // size field. Best-effort: failure to read size after restore is
      // not a failure of the restore itself.
      await file.restore({ generation: Number(generation) });
      let sizeNum: number | null = null;
      try {
        const [meta] = await file.getMetadata();
        if (meta && meta.size != null) sizeNum = Number(meta.size);
      } catch (metaErr) {
        this.logger.warn(
          `restore ${src.name}/${name}: metadata fetch after restore failed: ${
            metaErr instanceof Error ? metaErr.message : String(metaErr)
          }`,
        );
      }

      await this.audit.log({
        entityType: 'backup',
        entityId: src.name,
        action: 'files.recovered',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          bucket: src.name,
          bucketLabel: src.label,
          name,
          generation,
          restoredSize: sizeNum,
          durationMs: Date.now() - startedAt,
        },
      });

      return {
        ok: true,
        bucket: src.name,
        bucketLabel: src.label,
        name,
        size: sizeNum,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`restore ${src.name}/${name}@${generation}: ${message}`);
      await this.audit.log({
        entityType: 'backup',
        entityId: src.name,
        action: 'files.recover_failed',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          bucket: src.name,
          bucketLabel: src.label,
          name,
          generation,
          error: message.slice(0, 500),
        },
      });
      // 404 from the API translates to "not found / already expired".
      if (/not\s*found|no such object|404/i.test(message)) {
        throw new NotFoundException(
          'That deleted file is no longer available — the soft-delete window may have expired.',
        );
      }
      throw new ServiceUnavailableException(`Restore failed: ${message}`);
    }
  }

  // ── Internals ───────────────────────────────────────────────────

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'File recovery is only available in the production environment.',
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
