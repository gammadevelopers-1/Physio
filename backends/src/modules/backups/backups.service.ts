import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { eq, desc, inArray, count, and, or } from 'drizzle-orm';
import { db } from '../../database';
import { backups, users, auditLogs } from '../../database/schema';
import { AuditLogService } from '../audit-logs/audit-logs.service';

const SQLADMIN = 'https://sqladmin.googleapis.com/v1';

/**
 * Backup management for the admin dashboard.
 *
 * This wraps the Cloud SQL Admin REST API (no SDK — we mint an access
 * token from the runtime service account via ADC and call REST directly,
 * which avoids pulling in the heavy `googleapis` package). Two kinds of
 * admin-initiated backups:
 *
 *   snapshot → Cloud SQL on-demand backup run (a restore point)
 *   export   → SQL dump written to the backups GCS bucket, downloadable
 *              via a short-lived signed URL
 *
 * Cloud SQL's OWN automated daily backups + PITR run independently at the
 * infra layer; this service never disables or replaces them. There is
 * deliberately NO in-place restore here — restore is a guarded
 * restore-to-clone operation handled outside the app.
 */
@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  private readonly enabled = (process.env.STORAGE_DRIVER || 'local') === 'gcp';
  private readonly projectId =
    process.env.GCP_PROJECT_ID || 'nelc-elearning-platform-479319';
  private readonly region = process.env.GCP_REGION || 'us-central1';
  private readonly instance = process.env.CLOUD_SQL_INSTANCE || 'physioguidance-db';
  private readonly database = process.env.DATABASE_NAME || 'physioguidance';
  private readonly bucket = process.env.BACKUPS_BUCKET || 'physioguidance-backups';
  private readonly signedUrlExpMinutes = parseInt(
    process.env.BACKUPS_SIGNED_URL_EXP || '30',
    10,
  );

  private auth: GoogleAuth | null = null;
  private storage: import('@google-cloud/storage').Storage | null = null;

  // ── Public posture (no external calls) ──────────────────────────

  getOverview() {
    return {
      enabled: this.enabled,
      instance: this.instance,
      database: this.database,
      region: this.region,
      bucket: this.bucket,
      // Recovery posture we guarantee at the infra layer:
      automatedDaily: true,
      pitrDays: 7,
      encryptedAtRest: true,
      malwareScanned: true,
      signedDownloadExpiryMinutes: this.signedUrlExpMinutes,
    };
  }

  // ── Listing ─────────────────────────────────────────────────────

  /** Our on-demand backup records, freshest first, status auto-synced. */
  async list() {
    await this.syncRunning();
    const rows = await db
      .select({
        id: backups.id,
        type: backups.type,
        mode: backups.mode,
        status: backups.status,
        gcsObject: backups.gcsObject,
        fileSizeBytes: backups.fileSizeBytes,
        error: backups.error,
        createdAt: backups.createdAt,
        completedAt: backups.completedAt,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
        createdByEmail: users.email,
      })
      .from(backups)
      .leftJoin(users, eq(backups.createdBy, users.id))
      .orderBy(desc(backups.createdAt))
      .limit(50);
    return rows;
  }

  /**
   * Cloud SQL's own backup runs — the real recovery inventory (automated
   * daily + on-demand). Best-effort: returns available:false (never
   * throws) when not on GCP or the API call fails, so the tab still loads.
   */
  async listRestorePoints(): Promise<{
    available: boolean;
    items: Array<Record<string, unknown>>;
    error?: string;
  }> {
    if (!this.enabled) return { available: false, items: [] };
    try {
      const token = await this.getAccessToken();
      const url = `${SQLADMIN}/projects/${this.projectId}/instances/${this.instance}/backupRuns?maxResults=50`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`backupRuns.list ${res.status}: ${body}`);
        return { available: false, items: [], error: `Cloud SQL API ${res.status}` };
      }
      const data = (await res.json()) as { items?: Array<Record<string, any>> };
      const items = (data.items || []).map((b) => ({
        id: b.id,
        status: b.status,
        type: b.type, // AUTOMATED | ON_DEMAND
        startTime: b.startTime || b.windowStartTime || null,
        endTime: b.endTime || null,
        description: b.description || null,
      }));
      return { available: true, items };
    } catch (err) {
      this.logger.error('listRestorePoints failed', err as Error);
      return {
        available: false,
        items: [],
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }

  // ── Audit history ───────────────────────────────────────────────

  /**
   * Restore / backup activity feed — every backup-related and rollback-
   * related audit event, paginated, joined to the performer's user row
   * so the UI can show "by Jane Doe" without an extra fetch. This is
   * what powers the "Restore History" panel; the events also live in
   * the broader /audit-logs/admin endpoints unchanged.
   */
  async listAuditHistory(page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const offset = (page - 1) * safeLimit;

    // The "Restore History" feed shows every recovery-relevant event:
    // backup ops, website rollbacks, and content material soft-deletes
    // and restores. Other material actions (approve/reject/etc.) are
    // intentionally NOT in this feed — they have their own surfaces.
    const recoveryFilter = or(
      inArray(auditLogs.entityType, ['backup', 'website_rollback']),
      and(
        eq(auditLogs.entityType, 'material'),
        inArray(auditLogs.action, ['material.soft_deleted', 'material.restored']),
      )!,
    )!;

    const data = await db
      .select({
        id: auditLogs.id,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        performedBy: auditLogs.performedBy,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        performerFirstName: users.firstName,
        performerLastName: users.lastName,
        performerEmail: users.email,
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.performedBy, users.id))
      .where(recoveryFilter)
      .orderBy(desc(auditLogs.createdAt))
      .limit(safeLimit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(recoveryFilter);

    const total = countResult?.count || 0;
    return {
      data,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  // ── Creating ────────────────────────────────────────────────────

  /** On-demand Cloud SQL native backup run (a restore point). */
  async createSnapshot(userId: string, ip?: string) {
    this.assertEnabled();
    const [record] = await db
      .insert(backups)
      .values({ type: 'database', mode: 'snapshot', status: 'running', createdBy: userId })
      .returning();
    try {
      const token = await this.getAccessToken();
      const url = `${SQLADMIN}/projects/${this.projectId}/instances/${this.instance}/backupRuns`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `On-demand backup via admin dashboard (${userId})`,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Cloud SQL backupRuns.insert ${res.status}: ${body}`);
      }
      const op = (await res.json()) as { name?: string };
      await db
        .update(backups)
        .set({ operationName: op.name || null })
        .where(eq(backups.id, record.id));
      await this.audit.log({
        entityType: 'backup',
        entityId: record.id,
        action: 'backup.created',
        performedBy: userId,
        ipAddress: ip,
        metadata: { mode: 'snapshot', operation: op.name },
      });
      return { id: record.id, status: 'running', operation: op.name };
    } catch (err) {
      await this.markFailed(record.id, err);
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'Backup failed to start',
      );
    }
  }

  /** SQL dump exported to the backups bucket (downloadable). */
  async createExport(userId: string, ip?: string) {
    this.assertEnabled();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const objectName = `db/${this.database}-${stamp}.sql.gz`;
    const uri = `gs://${this.bucket}/${objectName}`;
    const [record] = await db
      .insert(backups)
      .values({
        type: 'database',
        mode: 'export',
        status: 'running',
        gcsBucket: this.bucket,
        gcsObject: objectName,
        createdBy: userId,
      })
      .returning();
    try {
      const token = await this.getAccessToken();
      const url = `${SQLADMIN}/projects/${this.projectId}/instances/${this.instance}/export`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exportContext: {
            fileType: 'SQL',
            uri,
            databases: [this.database],
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Cloud SQL instances.export ${res.status}: ${body}`);
      }
      const op = (await res.json()) as { name?: string };
      await db
        .update(backups)
        .set({ operationName: op.name || null })
        .where(eq(backups.id, record.id));
      await this.audit.log({
        entityType: 'backup',
        entityId: record.id,
        action: 'backup.exported',
        performedBy: userId,
        ipAddress: ip,
        metadata: { mode: 'export', uri, operation: op.name },
      });
      return { id: record.id, status: 'running', object: objectName, operation: op.name };
    } catch (err) {
      await this.markFailed(record.id, err);
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'Export failed to start',
      );
    }
  }

  // ── Download ────────────────────────────────────────────────────

  /** Short-lived signed URL for a completed export object. */
  async getDownloadUrl(id: string, userId: string, ip?: string) {
    this.assertEnabled();
    const [record] = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
    if (!record) throw new NotFoundException('Backup not found');
    if (
      (record.mode !== 'export' && record.mode !== 'files_export') ||
      !record.gcsObject
    ) {
      throw new NotFoundException('This backup is not a downloadable export');
    }
    if (record.status !== 'completed') {
      throw new ServiceUnavailableException('Backup is not ready to download yet');
    }
    const [url] = await this.getStorage()
      .bucket(record.gcsBucket || this.bucket)
      .file(record.gcsObject)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + this.signedUrlExpMinutes * 60 * 1000,
      });
    await this.audit.log({
      entityType: 'backup',
      entityId: record.id,
      action: 'backup.downloaded',
      performedBy: userId,
      ipAddress: ip,
      metadata: { object: record.gcsObject },
    });
    return { url, expiresInMinutes: this.signedUrlExpMinutes };
  }

  // ── Internals ───────────────────────────────────────────────────

  constructor(private readonly audit: AuditLogService) {}

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Backups are only available in the production environment.',
      );
    }
  }

  private getAuth(): GoogleAuth {
    if (!this.auth) {
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }
    return this.auth;
  }

  private async getAccessToken(): Promise<string> {
    const client = await this.getAuth().getClient();
    const res = await client.getAccessToken();
    if (!res.token) throw new Error('Failed to obtain GCP access token');
    return res.token;
  }

  private getStorage(): import('@google-cloud/storage').Storage {
    if (!this.storage) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Storage } = require('@google-cloud/storage');
      this.storage = new Storage({ projectId: this.projectId });
    }
    return this.storage!;
  }

  private async markFailed(id: string, err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    this.logger.error(`Backup ${id} failed: ${message}`);
    await db
      .update(backups)
      .set({ status: 'failed', error: message.slice(0, 1000), completedAt: new Date() })
      .where(eq(backups.id, id));
  }

  /**
   * Refresh any still-running operations by polling Cloud SQL. Called
   * lazily from list() so the UI shows fresh status without a cron.
   */
  private async syncRunning() {
    if (!this.enabled) return;
    const running = await db.select().from(backups).where(eq(backups.status, 'running'));
    if (!running.length) return;
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err) {
      this.logger.warn(`syncRunning: token fetch failed: ${(err as Error).message}`);
      return;
    }
    // 15-minute stale window: Files Backups typically complete in
    // 1-3 min on this dataset; anything past 15 min is almost certainly
    // a dead container or a connection that gave up silently.
    const staleCutoff = Date.now() - 15 * 60 * 1000;
    for (const r of running) {
      // Rows without a Cloud SQL operation (e.g. files_export) are owned by
      // the originating process. If they've been running too long, the
      // owning container is presumed gone — mark them failed so the UI
      // shows the truth instead of a perpetual spinner.
      if (!r.operationName) {
        if (new Date(r.createdAt).getTime() < staleCutoff) {
          await db
            .update(backups)
            .set({
              status: 'failed',
              error:
                'Backup did not complete within the expected time window.',
              completedAt: new Date(),
            })
            .where(eq(backups.id, r.id));
        }
        continue;
      }
      try {
        const res = await fetch(
          `${SQLADMIN}/projects/${this.projectId}/operations/${r.operationName}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) continue;
        const op = (await res.json()) as {
          status?: string;
          error?: unknown;
        };
        if (op.status !== 'DONE') continue;
        if (op.error) {
          await db
            .update(backups)
            .set({
              status: 'failed',
              error: JSON.stringify(op.error).slice(0, 1000),
              completedAt: new Date(),
            })
            .where(eq(backups.id, r.id));
          continue;
        }
        let size: number | null = null;
        if (r.mode === 'export' && r.gcsObject) {
          try {
            const [meta] = await this.getStorage()
              .bucket(r.gcsBucket || this.bucket)
              .file(r.gcsObject)
              .getMetadata();
            size = meta.size ? Number(meta.size) : null;
          } catch {
            // size is best-effort
          }
        }
        await db
          .update(backups)
          .set({ status: 'completed', completedAt: new Date(), fileSizeBytes: size })
          .where(eq(backups.id, r.id));
      } catch (err) {
        this.logger.warn(`syncRunning: op poll failed for ${r.id}: ${(err as Error).message}`);
      }
    }
  }
}
