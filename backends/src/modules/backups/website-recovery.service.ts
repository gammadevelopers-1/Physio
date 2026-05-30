import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { randomUUID } from 'crypto';
import { AuditLogService } from '../audit-logs/audit-logs.service';

const RUN_API = 'https://run.googleapis.com/v2';

interface RunRevisionApi {
  name: string;
  uid?: string;
  createTime?: string;
  containers?: Array<{ image?: string }>;
  conditions?: Array<{ type?: string; state?: string; message?: string }>;
}

interface RunServiceApi {
  name?: string;
  traffic?: Array<{
    type?: string;
    revision?: string;
    percent?: number;
    tag?: string;
  }>;
  trafficStatuses?: Array<{
    type?: string;
    revision?: string;
    percent?: number;
  }>;
}

export interface WebsiteRevision {
  name: string;
  shortName: string;
  createdAt: string | null;
  image: string | null;
  percent: number;
  isLive: boolean;
  ageDays: number | null;
}

export interface WebsiteRevisionsListing {
  available: boolean;
  items: WebsiteRevision[];
  currentRevision: string | null;
  service: string;
  region: string;
  error?: string;
}

/**
 * Website application recovery — list Cloud Run revisions for the frontend
 * service and let an admin roll traffic back to any prior revision.
 *
 * This wraps the Cloud Run Admin REST API (v2) the same way BackupsService
 * wraps Cloud SQL Admin: ADC token via google-auth-library, no SDK.
 *
 * Safety model: rollback is gated by (a) admin role on the controller,
 * (b) STORAGE_DRIVER=gcp environment, and (c) a server-side type-domain
 * confirmation. The rollback only swaps traffic on the existing service —
 * it never deletes or modifies a revision. Database, files, and config
 * are untouched.
 */
@Injectable()
export class WebsiteRecoveryService {
  private readonly logger = new Logger(WebsiteRecoveryService.name);

  private readonly enabled = (process.env.STORAGE_DRIVER || 'local') === 'gcp';
  private readonly projectId =
    process.env.GCP_PROJECT_ID || 'nelc-elearning-platform-479319';
  private readonly region = process.env.GCP_REGION || 'us-central1';
  private readonly service =
    process.env.WEB_SERVICE_NAME || 'physioguidance-web';
  private readonly confirmDomain =
    process.env.WEB_CONFIRM_DOMAIN || 'physioguidance.org';
  private readonly maxRevisions = 20;

  private auth: GoogleAuth | null = null;

  constructor(private readonly audit: AuditLogService) {}

  // ── Public posture ──────────────────────────────────────────────

  getConfig() {
    return {
      enabled: this.enabled,
      service: this.service,
      region: this.region,
      confirmDomain: this.confirmDomain,
    };
  }

  // ── Listing ─────────────────────────────────────────────────────

  /**
   * Cloud Run revisions for the frontend service, freshest first, merged
   * with the live traffic split. Best-effort: returns available:false
   * (never throws) so the tab still loads if the API is unreachable.
   */
  async listRevisions(): Promise<WebsiteRevisionsListing> {
    const empty: WebsiteRevisionsListing = {
      available: false,
      items: [],
      currentRevision: null,
      service: this.service,
      region: this.region,
    };
    if (!this.enabled) return empty;

    try {
      const token = await this.getAccessToken();

      // 1) Current service state — gives us the active traffic split.
      const svcUrl = `${RUN_API}/projects/${this.projectId}/locations/${this.region}/services/${this.service}`;
      const svcRes = await fetch(svcUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!svcRes.ok) {
        const body = await svcRes.text();
        this.logger.error(`services.get ${svcRes.status}: ${body}`);
        return { ...empty, error: `Cloud Run API ${svcRes.status}` };
      }
      const svc = (await svcRes.json()) as RunServiceApi;
      // trafficStatuses reflects what is actually serving right now;
      // traffic reflects the latest desired spec. Prefer the status.
      const trafficSplit =
        (svc.trafficStatuses && svc.trafficStatuses.length
          ? svc.trafficStatuses
          : svc.traffic) || [];
      const percentByRevision = new Map<string, number>();
      let currentRevision: string | null = null;
      let latestAllocationActive = false;
      for (const t of trafficSplit) {
        const pct = t.percent || 0;
        // Cloud Run can route via a LATEST pointer ("always serve newest")
        // without naming a specific revision. We detect that flag here and
        // resolve to the newest revision after we have the sorted list.
        if (
          (t.type || '').includes('LATEST') &&
          pct === 100 &&
          !t.revision
        ) {
          latestAllocationActive = true;
          continue;
        }
        if (!t.revision) continue;
        percentByRevision.set(t.revision, pct);
        if (pct === 100) currentRevision = t.revision;
      }

      // 2) Revision list — most recent first, capped.
      const revUrl = `${RUN_API}/projects/${this.projectId}/locations/${this.region}/services/${this.service}/revisions?pageSize=${this.maxRevisions}`;
      const revRes = await fetch(revUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!revRes.ok) {
        const body = await revRes.text();
        this.logger.error(`revisions.list ${revRes.status}: ${body}`);
        return { ...empty, error: `Cloud Run API ${revRes.status}` };
      }
      const revData = (await revRes.json()) as { revisions?: RunRevisionApi[] };
      const now = Date.now();
      const items: WebsiteRevision[] = (revData.revisions || [])
        .map((r) => {
          const shortName = r.name.split('/').pop() || r.name;
          const percent = percentByRevision.get(shortName) || 0;
          const created = r.createTime ? new Date(r.createTime).getTime() : null;
          const ageDays =
            created !== null ? Math.floor((now - created) / 86_400_000) : null;
          return {
            name: r.name,
            shortName,
            createdAt: r.createTime || null,
            image: r.containers?.[0]?.image || null,
            percent,
            isLive: percent === 100,
            ageDays,
          };
        })
        .sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });

      // If the service uses a LATEST allocation (no specific revision named
      // in traffic), the newest revision in our sorted list IS the live one.
      // Mark it so the UI shows the badge and the rollback button is hidden.
      if (!currentRevision && latestAllocationActive && items.length > 0) {
        items[0].percent = 100;
        items[0].isLive = true;
        currentRevision = items[0].shortName;
      }

      return {
        available: true,
        items,
        currentRevision,
        service: this.service,
        region: this.region,
      };
    } catch (err) {
      this.logger.error('listRevisions failed', err as Error);
      return {
        ...empty,
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }

  // ── Rollback ────────────────────────────────────────────────────

  /**
   * Roll traffic back to a prior revision. Atomic at the LB layer
   * (Cloud Run revisions are immutable; only traffic routing changes).
   * Every attempt writes two audit entries (initiated + completed/failed)
   * sharing a correlation id so a forensic trail exists even if the
   * Cloud Run API call hangs.
   */
  async rollback(
    revisionShortName: string,
    confirmDomain: string,
    userId: string,
    ip?: string,
  ) {
    this.assertEnabled();

    // Server-side gate: client UI also enforces this, but the server
    // must not trust the client. Compare case-insensitively but exactly.
    if (
      !confirmDomain ||
      confirmDomain.trim().toLowerCase() !==
        this.confirmDomain.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        'Confirmation text does not match. Type the domain exactly to confirm.',
      );
    }

    // Defensive validation — the revision name lands in a URL path.
    // Cloud Run revision names are kebab-case alnum.
    if (
      !revisionShortName ||
      revisionShortName.length > 200 ||
      !/^[a-z0-9-]+$/i.test(revisionShortName)
    ) {
      throw new BadRequestException('Invalid revision name');
    }

    // Correlation id ties initiated → completed/failed rows together.
    const correlationId = randomUUID();

    await this.audit.log({
      entityType: 'website_rollback',
      entityId: correlationId,
      action: 'website.rollback_initiated',
      performedBy: userId,
      ipAddress: ip,
      metadata: { targetRevision: revisionShortName, service: this.service },
    });

    const startedAt = Date.now();
    try {
      const token = await this.getAccessToken();

      // Fetch current state for the "from" side of the audit metadata
      // and to refuse a no-op rollback to the already-live revision.
      const svcUrl = `${RUN_API}/projects/${this.projectId}/locations/${this.region}/services/${this.service}`;
      const svcRes = await fetch(svcUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!svcRes.ok) {
        const body = await svcRes.text();
        throw new Error(`services.get ${svcRes.status}: ${body}`);
      }
      const svc = (await svcRes.json()) as RunServiceApi;
      const liveStatus =
        (svc.trafficStatuses && svc.trafficStatuses.length
          ? svc.trafficStatuses
          : svc.traffic) || [];
      const previousRevision =
        liveStatus.find((t) => (t.percent || 0) === 100)?.revision || null;
      if (previousRevision === revisionShortName) {
        throw new BadRequestException(
          'This revision is already serving 100% of traffic.',
        );
      }

      // PATCH the service with a single 100% traffic target.
      const patchUrl = `${svcUrl}?updateMask=traffic`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          traffic: [
            {
              type: 'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',
              revision: revisionShortName,
              percent: 100,
            },
          ],
        }),
      });
      if (!patchRes.ok) {
        const body = await patchRes.text();
        if (patchRes.status === 404) {
          throw new NotFoundException(
            `Revision ${revisionShortName} not found on service ${this.service}.`,
          );
        }
        throw new Error(`services.patch ${patchRes.status}: ${body}`);
      }
      const op = (await patchRes.json()) as { name?: string };
      const durationMs = Date.now() - startedAt;

      await this.audit.log({
        entityType: 'website_rollback',
        entityId: correlationId,
        action: 'website.rollback_completed',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          targetRevision: revisionShortName,
          previousRevision,
          durationMs,
          operation: op.name,
          service: this.service,
        },
      });

      return {
        ok: true,
        correlationId,
        targetRevision: revisionShortName,
        previousRevision,
        operation: op.name ?? null,
        durationMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.audit.log({
        entityType: 'website_rollback',
        entityId: correlationId,
        action: 'website.rollback_failed',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          targetRevision: revisionShortName,
          error: message.slice(0, 1000),
          service: this.service,
          durationMs: Date.now() - startedAt,
        },
      });
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      throw new ServiceUnavailableException(`Rollback failed: ${message}`);
    }
  }

  // ── Internals ───────────────────────────────────────────────────

  private assertEnabled() {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Website rollback is only available in the production environment.',
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
}
