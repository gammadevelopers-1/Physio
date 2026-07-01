import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, eq, gte, sql, desc } from 'drizzle-orm';
import { db } from '../../database';
import {
  xapiStatements,
  xapiTransmissions,
  XAPI_STATEMENT_STATUS,
  type XapiStatementStatus,
} from '../../database/schema';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { LrsClient } from './lrs.client';
import { NelcModeService, type NelcMode } from './nelc-mode.service';
import { XapiService } from './xapi.service';
import {
  XAPI_QUEUE_NAMES,
  XAPI_JOB_NAMES,
  type TransmitStatementJobData,
} from './constants';
import {
  NELC_ACTIVITY_TYPE,
  NELC_LANG,
  NELC_VERB,
  XAPI_VERSION,
} from './nelc-spec';
import { buildLoggedInStatement } from './statement-builders';

/**
 * Admin-only endpoints for the NELC integration page.
 *
 * Restricted to MANAGER / ADMIN / SUPER_ADMIN — same gate as
 * /admin/compliance and /admin/settings. The integration carries real
 * credentials to NELC's staging endpoint; only senior staff see it.
 */
@Controller('admin/integrations/nelc')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  'MANAGER' as UserRole,
  'ADMIN' as UserRole,
  'SUPER_ADMIN' as UserRole,
)
export class XapiAdminController {
  constructor(
    private readonly configService: ConfigService,
    private readonly lrs: LrsClient,
    private readonly xapiService: XapiService,
    private readonly nelcMode: NelcModeService,
    @Optional()
    @InjectQueue(XAPI_QUEUE_NAMES.STATEMENTS)
    private readonly queue: Queue<TransmitStatementJobData> | null,
  ) {}

  // ── Environment mode toggle (staging | production) ───────────────
  // Persisted in system_settings.nelc.mode and resolved fresh on every
  // LRS POST through NelcModeService (30s in-process cache). Default
  // is whatever NELC_LRS_MODE env says, or 'staging' (fail-safe).

  @Get('mode')
  async getMode(): Promise<{
    mode: NelcMode;
    source: 'db' | 'env' | 'default';
    defaultMode: NelcMode;
    endpoints: { staging: string; production: string };
    activeEndpoint: string;
    username: string;
    passwordsAvailable: { staging: boolean; production: boolean };
  }> {
    const active = await this.nelcMode.getActive();
    const defaultMode =
      this.configService.get<NelcMode>('nelc.defaultMode') === 'production'
        ? 'production'
        : 'staging';
    return {
      mode: active.mode,
      source: active.source,
      defaultMode,
      endpoints: {
        staging: this.configService.get<string>('nelc.endpointStaging') || '',
        production: this.configService.get<string>('nelc.endpointProd') || '',
      },
      activeEndpoint: active.endpoint,
      username: active.username,
      passwordsAvailable: {
        staging: Boolean(this.configService.get<string>('nelc.passwordStaging')),
        production: Boolean(this.configService.get<string>('nelc.passwordProd')),
      },
    };
  }

  /** Switch the active LRS environment. Restricted to SUPER_ADMIN —
   *  flipping to production routes every learner statement into NELC's
   *  permanent compliance record. */
  @Post('mode')
  @Roles('SUPER_ADMIN' as UserRole)
  async setMode(
    @Body() body: { mode?: string },
    @CurrentUser() user: { id: string; email?: string },
  ): Promise<{
    mode: NelcMode;
    endpoint: string;
  }> {
    const requested = body?.mode;
    if (requested !== 'staging' && requested !== 'production') {
      throw new BadRequestException(
        `mode must be 'staging' or 'production' (got: ${String(requested)})`,
      );
    }
    try {
      const active = await this.nelcMode.setMode(
        requested,
        user.id,
        user.email,
      );
      return { mode: active.mode, endpoint: active.endpoint };
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  /** Sanitised config view — credentials are masked. Endpoint + password
   *  reflect the ACTIVE mode (staging|production) resolved through
   *  NelcModeService so the integration page always shows where xAPI is
   *  actually flowing. The mode pill is sourced separately via /mode. */
  @Get('config')
  async getConfig(): Promise<{
    enabled: boolean;
    endpoint: string;
    username: string;
    passwordMasked: string;
    mode: NelcMode;
    platformIdentifier: string;
    platformNameEn: string;
    platformNameAr: string;
    lmsUrl: string;
    xapiVersion: string;
    maxAttempts: number;
    timeoutMs: number;
  }> {
    const active = await this.nelcMode.getActive();
    return {
      enabled: !!this.configService.get<boolean>('nelc.enabled'),
      endpoint: active.endpoint,
      username: active.username,
      passwordMasked: active.password
        ? `${'•'.repeat(Math.min(active.password.length, 24))}`
        : '',
      mode: active.mode,
      platformIdentifier:
        this.configService.get<string>('nelc.platformIdentifier') || '',
      platformNameEn: this.configService.get<string>('nelc.platformNameEn') || '',
      platformNameAr: this.configService.get<string>('nelc.platformNameAr') || '',
      lmsUrl: this.configService.get<string>('nelc.lmsUrl') || '',
      xapiVersion: XAPI_VERSION,
      maxAttempts: this.configService.get<number>('nelc.maxAttempts') || 3,
      timeoutMs: this.configService.get<number>('nelc.timeoutMs') || 15_000,
    };
  }

  /** KPIs: total / sent / failed / pending in the last 24h + last
   *  successful sync timestamp. Drives the page header strip. */
  @Get('stats')
  async getStats(): Promise<{
    last24h: { total: number; sent: number; failed: number; pending: number };
    lastSuccessAt: string | null;
    pendingTotal: number;
    failedTotal: number;
  }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [last24] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        sent: sql<number>`SUM(CASE WHEN ${xapiStatements.status} = 'sent' THEN 1 ELSE 0 END)::int`,
        failed: sql<number>`SUM(CASE WHEN ${xapiStatements.status} = 'failed' THEN 1 ELSE 0 END)::int`,
        pending: sql<number>`SUM(CASE WHEN ${xapiStatements.status} = 'pending' THEN 1 ELSE 0 END)::int`,
      })
      .from(xapiStatements)
      .where(gte(xapiStatements.createdAt, since));

    const [lastSent] = await db
      .select({ sentAt: xapiStatements.sentAt })
      .from(xapiStatements)
      .where(eq(xapiStatements.status, XAPI_STATEMENT_STATUS.SENT))
      .orderBy(desc(xapiStatements.sentAt))
      .limit(1);

    const [totals] = await db
      .select({
        pending: sql<number>`SUM(CASE WHEN ${xapiStatements.status} = 'pending' THEN 1 ELSE 0 END)::int`,
        failed: sql<number>`SUM(CASE WHEN ${xapiStatements.status} = 'failed' THEN 1 ELSE 0 END)::int`,
      })
      .from(xapiStatements);

    return {
      last24h: {
        total: Number(last24?.total ?? 0),
        sent: Number(last24?.sent ?? 0),
        failed: Number(last24?.failed ?? 0),
        pending: Number(last24?.pending ?? 0),
      },
      lastSuccessAt: lastSent?.sentAt ? lastSent.sentAt.toISOString() : null,
      pendingTotal: Number(totals?.pending ?? 0),
      failedTotal: Number(totals?.failed ?? 0),
    };
  }

  /** Paginated transmission log. Returns one row per xapi_statements
   *  row, with the most-recent transmission's status info inlined. */
  @Get('log')
  async getLog(
    @Query('status') status?: XapiStatementStatus,
    @Query('verb') verb?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{
    rows: Array<{
      id: string;
      verb: string;
      objectActivityId: string;
      objectType: string;
      actorUserId: string | null;
      courseId: string | null;
      status: string;
      createdAt: string;
      sentAt: string | null;
      lastHttpStatus: number | null;
      lastError: string | null;
      attemptCount: number;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 50));

    const where = and(
      status ? eq(xapiStatements.status, status) : undefined,
      verb ? eq(xapiStatements.verb, verb) : undefined,
    );

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(xapiStatements)
      .where(where);

    // Most-recent transmission per statement via a correlated subquery.
    // Cheaper than a window-fn join for the page sizes we expect here.
    const rows = await db
      .select({
        id: xapiStatements.id,
        verb: xapiStatements.verb,
        objectActivityId: xapiStatements.objectActivityId,
        objectType: xapiStatements.objectType,
        actorUserId: xapiStatements.actorUserId,
        courseId: xapiStatements.courseId,
        status: xapiStatements.status,
        createdAt: xapiStatements.createdAt,
        sentAt: xapiStatements.sentAt,
        lastHttpStatus: sql<number | null>`(
          SELECT t.http_status FROM ${xapiTransmissions} t
           WHERE t.statement_id = ${xapiStatements.id}
           ORDER BY t.sent_at DESC LIMIT 1
        )`,
        lastError: sql<string | null>`(
          SELECT t.error_text FROM ${xapiTransmissions} t
           WHERE t.statement_id = ${xapiStatements.id}
           ORDER BY t.sent_at DESC LIMIT 1
        )`,
        attemptCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${xapiTransmissions} t
           WHERE t.statement_id = ${xapiStatements.id}
        )`,
      })
      .from(xapiStatements)
      .where(where)
      .orderBy(desc(xapiStatements.createdAt))
      .limit(ps)
      .offset((p - 1) * ps);

    return {
      rows: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        lastHttpStatus: r.lastHttpStatus ?? null,
        lastError: r.lastError ?? null,
        attemptCount: Number(r.attemptCount ?? 0),
      })),
      total: Number(count ?? 0),
      page: p,
      pageSize: ps,
    };
  }

  /** Full payload + all transmission attempts for one statement.
   *  Used by the "view JSON" drawer in the admin log table. */
  @Get('log/:id')
  async getLogDetail(@Param('id') id: string): Promise<{
    id: string;
    payload: unknown;
    transmissions: Array<{
      attemptNo: number;
      httpStatus: number | null;
      responseBody: string | null;
      errorText: string | null;
      sentAt: string;
    }>;
  } | null> {
    const [row] = await db
      .select({
        id: xapiStatements.id,
        payload: xapiStatements.payload,
      })
      .from(xapiStatements)
      .where(eq(xapiStatements.id, id))
      .limit(1);
    if (!row) return null;

    const transmissions = await db
      .select({
        attemptNo: xapiTransmissions.attemptNo,
        httpStatus: xapiTransmissions.httpStatus,
        responseBody: xapiTransmissions.responseBody,
        errorText: xapiTransmissions.errorText,
        sentAt: xapiTransmissions.sentAt,
      })
      .from(xapiTransmissions)
      .where(eq(xapiTransmissions.statementId, id))
      .orderBy(desc(xapiTransmissions.sentAt));

    return {
      id: row.id,
      payload: row.payload,
      transmissions: transmissions.map((t) => ({
        attemptNo: t.attemptNo,
        httpStatus: t.httpStatus,
        responseBody: t.responseBody,
        errorText: t.errorText,
        sentAt: t.sentAt.toISOString(),
      })),
    };
  }

  /** Re-enqueue a failed statement. The processor will record a new
   *  attempt row regardless of outcome, so the log keeps full history. */
  @Post('retry/:id')
  async retry(@Param('id') id: string): Promise<{ enqueued: boolean }> {
    const [row] = await db
      .select({ status: xapiStatements.status })
      .from(xapiStatements)
      .where(eq(xapiStatements.id, id))
      .limit(1);
    if (!row) return { enqueued: false };
    if (row.status === XAPI_STATEMENT_STATUS.SENT) {
      // Already sent — don't double-emit.
      return { enqueued: false };
    }
    if (!this.queue) return { enqueued: false };

    // Flip failed → pending so the row visibly enters the retry path
    // even before the worker runs (UI reflects state in < 1s).
    if (row.status === XAPI_STATEMENT_STATUS.FAILED) {
      await db
        .update(xapiStatements)
        .set({ status: XAPI_STATEMENT_STATUS.PENDING })
        .where(eq(xapiStatements.id, id));
    }
    await this.queue.add(
      XAPI_JOB_NAMES.TRANSMIT_STATEMENT,
      { statementId: id },
      { attempts: 1, removeOnComplete: 100, removeOnFail: 200 },
    );
    return { enqueued: true };
  }

  /** POST a minimal valid statement (logged-in for the requesting user)
   *  to the LRS and return the result. Persists no DB row — this is
   *  a connectivity / credential probe, not an event. */
  @Post('test-connection')
  async testConnection(@Body() _body: unknown): Promise<{
    ok: boolean;
    httpStatus: number | null;
    responseBody: string;
    errorText: string | null;
    endpoint: string;
  }> {
    const enabled = this.configService.get<boolean>('nelc.enabled');
    if (!enabled) {
      return {
        ok: false,
        httpStatus: null,
        responseBody: '',
        errorText: 'NELC_LRS_ENABLED is false — flip it to true before testing',
        endpoint: this.configService.get<string>('nelc.endpoint') || '',
      };
    }

    // Build a self-contained probe statement — uses the configured
    // platform identity and a placeholder actor that doesn't touch the
    // users table. NELC's LRS validates the shape, not the identity,
    // so a deterministic placeholder is fine.
    const platform = {
      identifier:
        this.configService.get<string>('nelc.platformIdentifier') || '',
      nameEn: this.configService.get<string>('nelc.platformNameEn') || '',
      nameAr: this.configService.get<string>('nelc.platformNameAr') || '',
    };
    const statement = buildLoggedInStatement(
      {
        actor: {
          email: 'connection-test@physioguidance.org',
          nationalId: '0000000000',
        },
        instructor: { email: '', name: '' },
        activity: {
          url: this.configService.get<string>('nelc.lmsUrl') || platform.identifier,
          title: platform.nameEn || 'PhysioGuidance',
          activityType: NELC_ACTIVITY_TYPE.MODULE,
          language: NELC_LANG.ENGLISH,
        },
        language: NELC_LANG.ENGLISH,
      },
      platform,
    );

    const result = await this.lrs.postStatement(statement);
    return {
      ok: result.ok,
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      errorText: result.errorText,
      endpoint: this.configService.get<string>('nelc.endpoint') || '',
    };
  }

  /** Send the NELC "joined" administrative trigger statement. Per
   *  NELC's LMS Provider Entities guide, this MUST be sent once when
   *  the platform is wired up — before any learner activity. The
   *  statement is persisted and transmitted via the normal queue. */
  @Post('trigger/joined')
  async triggerJoined(
    @CurrentUser() user: { email?: string; firstName?: string; lastName?: string },
  ): Promise<{ ok: boolean; statementId: string | null }> {
    const id = await this.xapiService.emitProviderJoined({
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    });
    return { ok: id !== null, statementId: id };
  }

  /** Send the NELC "left" trigger — counterpart to `joined`. Sent
   *  when the platform is offboarding from NELC. */
  @Post('trigger/left')
  async triggerLeft(
    @CurrentUser() user: { email?: string; firstName?: string; lastName?: string },
  ): Promise<{ ok: boolean; statementId: string | null }> {
    const id = await this.xapiService.emitProviderLeft({
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
    });
    return { ok: id !== null, statementId: id };
  }
}

// Re-export verb constants for the frontend dropdown filter without
// reaching into the nelc-spec module from the lib/api layer.
export const NELC_VERB_FILTER_OPTIONS = Object.values(NELC_VERB);
