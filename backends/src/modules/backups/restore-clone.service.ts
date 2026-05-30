import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GoogleAuth } from 'google-auth-library';
import { and, eq, desc, lt, count, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  backups,
  restoreClones,
  users,
  RESTORE_CLONE_STATUS,
  RESTORE_CLONE_LIMITS,
} from '../../database/schema';
import { AuditLogService } from '../audit-logs/audit-logs.service';

const SQLADMIN = 'https://sqladmin.googleapis.com/v1';

/**
 * Phase 2D — Admin restore-to-clone (sandbox).
 *
 * Reconstitutes a chosen backup export into a brand-new database on
 * the live Cloud SQL instance, leaving the live `physioguidance` DB
 * completely untouched. The admin uses Cloud SQL Studio (or psql) to
 * inspect the sandbox, extract specific rows, then manually applies
 * the fix to live. A cron drops the sandbox past its expiresAt.
 *
 * Why no in-place restore: see [[backup-system-decision]].
 *
 * Cloud SQL Admin REST API calls used:
 *   POST /databases       create the empty sandbox DB
 *   POST /import          import the SQL dump from GCS
 *   DELETE /databases/X   drop the sandbox DB
 *   GET  /operations/X    poll long-running operations
 */
@Injectable()
export class RestoreCloneService {
  private readonly logger = new Logger(RestoreCloneService.name);

  private readonly enabled = (process.env.STORAGE_DRIVER || 'local') === 'gcp';
  private readonly projectId =
    process.env.GCP_PROJECT_ID || 'nelc-elearning-platform-479319';
  private readonly region = process.env.GCP_REGION || 'us-central1';
  private readonly instance =
    process.env.CLOUD_SQL_INSTANCE || 'physioguidance-db';
  private readonly bucket =
    process.env.BACKUPS_BUCKET || 'physioguidance-backups';

  private auth: GoogleAuth | null = null;

  constructor(private readonly audit: AuditLogService) {}

  // ── Listing ─────────────────────────────────────────────────────

  /**
   * Active + recent sandboxes, freshest first. Status is auto-synced
   * on read so the UI sees fresh import progress without a cron.
   */
  async list(page = 1, limit = 20) {
    await this.syncRunning();

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const offset = (safePage - 1) * safeLimit;

    const rows = await db
      .select({
        id: restoreClones.id,
        backupId: restoreClones.backupId,
        dbName: restoreClones.dbName,
        status: restoreClones.status,
        error: restoreClones.error,
        createdAt: restoreClones.createdAt,
        expiresAt: restoreClones.expiresAt,
        droppedAt: restoreClones.droppedAt,
        backupCreatedAt: backups.createdAt,
        backupMode: backups.mode,
        backupGcsObject: backups.gcsObject,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
        createdByEmail: users.email,
      })
      .from(restoreClones)
      .leftJoin(backups, eq(restoreClones.backupId, backups.id))
      .leftJoin(users, eq(restoreClones.createdBy, users.id))
      .orderBy(desc(restoreClones.createdAt))
      .limit(safeLimit)
      .offset(offset);

    const [totalRow] = await db
      .select({ count: count() })
      .from(restoreClones);

    const total = Number(totalRow?.count ?? 0);

    return {
      items: rows.map((r) => ({
        id: r.id,
        backupId: r.backupId,
        backupCreatedAt: r.backupCreatedAt
          ? r.backupCreatedAt.toISOString()
          : null,
        backupMode: r.backupMode,
        backupObject: r.backupGcsObject,
        dbName: r.dbName,
        status: r.status,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        droppedAt: r.droppedAt ? r.droppedAt.toISOString() : null,
        createdBy: {
          name:
            `${r.createdByFirstName ?? ''} ${r.createdByLastName ?? ''}`.trim() ||
            null,
          email: r.createdByEmail ?? null,
        },
        // Cloud SQL Studio deep link — opens the sandbox DB in the
        // GCP console, signed in as whoever the admin is signed in
        // as. No shared credentials surfaced anywhere.
        cloudStudioUrl: this.cloudStudioUrl(r.dbName),
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      // Surface the live caps so the UI can disable the create
      // button + render the right warning copy.
      caps: {
        maxConcurrent: RESTORE_CLONE_LIMITS.MAX_CONCURRENT,
        defaultLifetimeHours: RESTORE_CLONE_LIMITS.DEFAULT_LIFETIME_HOURS,
        maxLifetimeHours: RESTORE_CLONE_LIMITS.MAX_LIFETIME_HOURS,
      },
    };
  }

  // ── Creating ────────────────────────────────────────────────────

  async createFromBackup(backupId: string, userId: string, ip?: string) {
    this.assertEnabled();

    const [source] = await db
      .select()
      .from(backups)
      .where(eq(backups.id, backupId))
      .limit(1);
    if (!source) throw new NotFoundException('Backup not found.');
    if (source.mode !== 'export') {
      throw new BadRequestException(
        'Only SQL export backups can be restored to a sandbox. Snapshots are restore points used by Cloud SQL itself.',
      );
    }
    if (source.status !== 'completed') {
      throw new BadRequestException(
        'Backup is not yet completed — wait for it to finish before restoring.',
      );
    }
    if (!source.gcsObject) {
      throw new BadRequestException(
        'Backup has no associated export object — cannot restore.',
      );
    }

    // Concurrency cap (cost + IAM-call rate-limit guard)
    const activeStatuses = [
      RESTORE_CLONE_STATUS.CREATING,
      RESTORE_CLONE_STATUS.IMPORTING,
      RESTORE_CLONE_STATUS.READY,
    ];
    const [activeRow] = await db
      .select({ count: count() })
      .from(restoreClones)
      .where(inArray(restoreClones.status, activeStatuses));
    const active = Number(activeRow?.count ?? 0);
    if (active >= RESTORE_CLONE_LIMITS.MAX_CONCURRENT) {
      throw new BadRequestException(
        `Maximum of ${RESTORE_CLONE_LIMITS.MAX_CONCURRENT} active sandboxes allowed. Drop an existing one first.`,
      );
    }

    // Generate a unique, readable, lowercase database name. Postgres
    // identifiers max out at 63 chars; we comfortably stay under.
    const stamp = new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, '')
      .slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 8);
    const dbName = `pgrestore_${stamp}_${suffix}`;

    const expiresAt = new Date(
      Date.now() +
        RESTORE_CLONE_LIMITS.DEFAULT_LIFETIME_HOURS * 60 * 60 * 1000,
    );

    const [record] = await db
      .insert(restoreClones)
      .values({
        backupId: source.id,
        dbName,
        status: RESTORE_CLONE_STATUS.CREATING,
        createdBy: userId,
        expiresAt,
      })
      .returning();

    const startedAt = Date.now();

    try {
      // Step 1: create the empty database via Cloud SQL Admin REST.
      const token = await this.getAccessToken();
      const createUrl = `${SQLADMIN}/projects/${this.projectId}/instances/${this.instance}/databases`;
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: dbName }),
      });
      if (!createRes.ok) {
        const body = await createRes.text();
        throw new Error(
          `Cloud SQL databases.insert ${createRes.status}: ${body}`,
        );
      }
      // databases.insert returns an Operation but completes fast — wait
      // for OK and assume the DB exists. We DO NOT wait for the
      // operation to fully resolve here; the import step below will
      // implicitly serialize on the database existing.

      // Step 2: kick off the import. This is a long-running op (1-5
      // min depending on dump size) — we store the operation name
      // and poll via syncRunning() from list() calls.
      const importUrl = `${SQLADMIN}/projects/${this.projectId}/instances/${this.instance}/import`;
      const uri = `gs://${source.gcsBucket || this.bucket}/${source.gcsObject}`;
      const importRes = await fetch(importUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          importContext: {
            kind: 'sql#importContext',
            fileType: 'SQL',
            uri,
            database: dbName,
          },
        }),
      });
      if (!importRes.ok) {
        const body = await importRes.text();
        throw new Error(`Cloud SQL instances.import ${importRes.status}: ${body}`);
      }
      const op = (await importRes.json()) as { name?: string };

      await db
        .update(restoreClones)
        .set({
          status: RESTORE_CLONE_STATUS.IMPORTING,
          sqlOperationName: op.name || null,
        })
        .where(eq(restoreClones.id, record.id));

      await this.audit.log({
        entityType: 'restore_clone',
        entityId: record.id,
        action: 'restore_clone.created',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          backupId: source.id,
          backupObject: source.gcsObject,
          dbName,
          operationName: op.name,
          expiresAt: expiresAt.toISOString(),
          startupMs: Date.now() - startedAt,
        },
      });

      return {
        id: record.id,
        dbName,
        status: RESTORE_CLONE_STATUS.IMPORTING,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`createFromBackup ${record.id}: ${message}`);
      await db
        .update(restoreClones)
        .set({
          status: RESTORE_CLONE_STATUS.FAILED,
          error: message.slice(0, 2000),
        })
        .where(eq(restoreClones.id, record.id));
      await this.audit.log({
        entityType: 'restore_clone',
        entityId: record.id,
        action: 'restore_clone.failed',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          dbName,
          stage: 'create_or_import',
          error: message.slice(0, 500),
        },
      });
      throw new ServiceUnavailableException(
        `Failed to start sandbox: ${message}`,
      );
    }
  }

  // ── Extending ───────────────────────────────────────────────────

  async extend(id: string, userId: string, ip?: string) {
    const [clone] = await db
      .select()
      .from(restoreClones)
      .where(eq(restoreClones.id, id))
      .limit(1);
    if (!clone) throw new NotFoundException('Sandbox not found.');
    if (clone.status !== RESTORE_CLONE_STATUS.READY) {
      throw new BadRequestException('Only ready sandboxes can be extended.');
    }

    const maxExpiry = new Date(
      clone.createdAt.getTime() +
        RESTORE_CLONE_LIMITS.MAX_LIFETIME_HOURS * 60 * 60 * 1000,
    );
    const proposed = new Date(
      clone.expiresAt.getTime() +
        RESTORE_CLONE_LIMITS.DEFAULT_LIFETIME_HOURS * 60 * 60 * 1000,
    );
    const newExpiry = proposed > maxExpiry ? maxExpiry : proposed;

    if (newExpiry.getTime() <= clone.expiresAt.getTime()) {
      throw new BadRequestException(
        `Sandbox is already at the maximum lifetime of ${RESTORE_CLONE_LIMITS.MAX_LIFETIME_HOURS}h since creation.`,
      );
    }

    await db
      .update(restoreClones)
      .set({ expiresAt: newExpiry })
      .where(eq(restoreClones.id, id));

    await this.audit.log({
      entityType: 'restore_clone',
      entityId: id,
      action: 'restore_clone.extended',
      performedBy: userId,
      ipAddress: ip,
      metadata: {
        dbName: clone.dbName,
        previousExpiresAt: clone.expiresAt.toISOString(),
        newExpiresAt: newExpiry.toISOString(),
      },
    });

    return { id, expiresAt: newExpiry.toISOString() };
  }

  // ── Dropping ────────────────────────────────────────────────────

  async drop(id: string, userId: string, ip?: string) {
    const [clone] = await db
      .select()
      .from(restoreClones)
      .where(eq(restoreClones.id, id))
      .limit(1);
    if (!clone) throw new NotFoundException('Sandbox not found.');
    if (clone.droppedAt) {
      throw new BadRequestException('Sandbox has already been dropped.');
    }
    await this.dropDatabase(clone.dbName, id, userId, ip, 'restore_clone.dropped');
    return { id, status: RESTORE_CLONE_STATUS.DROPPED };
  }

  // ── Auto-purge cron ─────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired(): Promise<void> {
    if (!this.enabled) return;
    try {
      const expired = await db
        .select({ id: restoreClones.id, dbName: restoreClones.dbName })
        .from(restoreClones)
        .where(
          and(
            inArray(restoreClones.status, [
              RESTORE_CLONE_STATUS.READY,
              RESTORE_CLONE_STATUS.IMPORTING,
            ]),
            lt(restoreClones.expiresAt, new Date()),
          ),
        );
      if (expired.length === 0) return;

      this.logger.log(`purgeExpired: dropping ${expired.length} sandbox(es)`);
      for (const c of expired) {
        try {
          await this.dropDatabase(
            c.dbName,
            c.id,
            null,
            undefined,
            'restore_clone.expired',
          );
        } catch (err) {
          this.logger.warn(
            `purgeExpired: drop failed for ${c.dbName}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.error('purgeExpired cron failed', err as Error);
    }
  }

  // ── Internals ───────────────────────────────────────────────────

  /**
   * Refresh sandboxes whose import is still running by polling the
   * stored Cloud SQL operation name. Mirrors BackupsService.syncRunning.
   */
  private async syncRunning() {
    if (!this.enabled) return;
    const running = await db
      .select()
      .from(restoreClones)
      .where(eq(restoreClones.status, RESTORE_CLONE_STATUS.IMPORTING));
    if (!running.length) return;

    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err) {
      this.logger.warn(
        `syncRunning: token fetch failed: ${(err as Error).message}`,
      );
      return;
    }

    for (const r of running) {
      if (!r.sqlOperationName) continue;
      try {
        const res = await fetch(
          `${SQLADMIN}/projects/${this.projectId}/operations/${r.sqlOperationName}`,
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
            .update(restoreClones)
            .set({
              status: RESTORE_CLONE_STATUS.FAILED,
              error: JSON.stringify(op.error).slice(0, 2000),
            })
            .where(eq(restoreClones.id, r.id));
          await this.audit.log({
            entityType: 'restore_clone',
            entityId: r.id,
            action: 'restore_clone.failed',
            performedBy: r.createdBy,
            metadata: {
              dbName: r.dbName,
              stage: 'import',
              error: JSON.stringify(op.error).slice(0, 500),
            },
          });
        } else {
          await db
            .update(restoreClones)
            .set({ status: RESTORE_CLONE_STATUS.READY })
            .where(eq(restoreClones.id, r.id));
          await this.audit.log({
            entityType: 'restore_clone',
            entityId: r.id,
            action: 'restore_clone.ready',
            performedBy: r.createdBy,
            metadata: { dbName: r.dbName },
          });
        }
      } catch (err) {
        this.logger.warn(
          `syncRunning: op poll failed for ${r.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  /**
   * Drop the underlying Cloud SQL database and mark the row as
   * dropped / expired. Safe to call against an already-missing DB
   * (logs a warning, still marks the row terminal).
   *
   * @param action 'restore_clone.dropped' (admin) or 'restore_clone.expired' (cron)
   * @param userId null when invoked by the cron — uses the original creator's id
   *   so the audit feed has a person attached.
   */
  private async dropDatabase(
    dbName: string,
    cloneId: string,
    userId: string | null,
    ip: string | undefined,
    action: 'restore_clone.dropped' | 'restore_clone.expired',
  ) {
    let dropOk = true;
    let dropError: string | null = null;
    try {
      const token = await this.getAccessToken();
      const url = `${SQLADMIN}/projects/${this.projectId}/instances/${this.instance}/databases/${encodeURIComponent(dbName)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 404) {
        const body = await res.text();
        dropOk = false;
        dropError = `Cloud SQL databases.delete ${res.status}: ${body}`;
        this.logger.warn(dropError);
      }
    } catch (err) {
      dropOk = false;
      dropError = err instanceof Error ? err.message : String(err);
      this.logger.warn(`dropDatabase ${dbName}: ${dropError}`);
    }

    // Always mark the row terminal — even if the GCP call failed,
    // the next purge cycle will retry. The status reflects intent.
    const terminalStatus =
      action === 'restore_clone.expired'
        ? RESTORE_CLONE_STATUS.EXPIRED
        : RESTORE_CLONE_STATUS.DROPPED;

    const [row] = await db
      .select({ createdBy: restoreClones.createdBy })
      .from(restoreClones)
      .where(eq(restoreClones.id, cloneId))
      .limit(1);

    await db
      .update(restoreClones)
      .set({
        status: terminalStatus,
        droppedAt: new Date(),
        droppedBy: userId,
        error: dropError,
      })
      .where(eq(restoreClones.id, cloneId));

    await this.audit.log({
      entityType: 'restore_clone',
      entityId: cloneId,
      action,
      // For cron-driven expiry there's no acting user, so attribute
      // to the original creator so the feed has a person attached.
      performedBy: userId || row?.createdBy || '',
      ipAddress: ip,
      metadata: {
        dbName,
        dropOk,
        dropError: dropError ? dropError.slice(0, 500) : null,
      },
    });
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Restore sandboxes are only available in the production environment.',
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

  /** GCP console deep link to Cloud SQL Studio for a database. */
  private cloudStudioUrl(dbName: string): string {
    return (
      `https://console.cloud.google.com/sql/instances/${this.instance}/studio` +
      `?project=${this.projectId}&database=${encodeURIComponent(dbName)}`
    );
  }
}
