import { db } from '../../database';
import { sql } from 'drizzle-orm';

// ─── Check result shape ─────────────────────────────────────
//
// Each checker returns either:
//   • { status: '...' } — we successfully measured the component
//   • { error: '...' } — the check itself failed (we couldn't tell)
//
// For network-bound checks (statuspage) an error means "we couldn't
// reach the upstream" — NOT that the component is down. The cron
// records auto_error but keeps the previous auto_status, since we
// have no evidence to overwrite it.

export type CheckResult =
  | { status: ComponentStatus; error?: never }
  | { status?: never; error: string };

export type ComponentStatus =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance';

// ─── 1) internal_db ─────────────────────────────────────────
//
// Pings our own DB with SELECT 1. Powers the Platform component:
// if the DB is unreachable our app effectively IS down, so it's
// safe to flip auto_status to major_outage when this fails.

export async function checkInternalDb(): Promise<CheckResult> {
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    const elapsedMs = Date.now() - start;
    // Mark degraded if even a single SELECT 1 takes >1.5s — Cloud SQL
    // healthy roundtrip is ~10ms, anything that high is a clear signal.
    if (elapsedMs > 1500) {
      return { status: 'degraded' };
    }
    return { status: 'operational' };
  } catch (err) {
    return { status: 'major_outage' };
  }
}

// ─── 2) statuspage ──────────────────────────────────────────
//
// Atlassian Statuspage API (used by Zoom, Resend, Stripe, GitHub,
// most SaaS): GET <host>/api/v2/status.json returns:
//   { status: { indicator: 'none|minor|major|critical|maintenance',
//               description: 'All Systems Operational' } }
// We map their 5-state indicator to ours 1:1.

const STATUSPAGE_TIMEOUT_MS = 8000;

const INDICATOR_MAP: Record<string, ComponentStatus> = {
  none: 'operational',
  minor: 'degraded',
  major: 'partial_outage',
  critical: 'major_outage',
  maintenance: 'maintenance',
};

export async function checkStatuspage(
  config: Record<string, unknown> | null,
): Promise<CheckResult> {
  const url = config && typeof config.url === 'string' ? config.url : null;
  if (!url) {
    return { error: 'No statuspage URL configured' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    STATUSPAGE_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // We don't want to follow auth-style redirects to a login page
      // — Statuspage hosts are always direct JSON.
      redirect: 'follow',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return { error: `Statuspage returned HTTP ${res.status}` };
    }

    const body = (await res.json()) as {
      status?: { indicator?: string };
    };

    const indicator = body?.status?.indicator;
    if (!indicator || typeof indicator !== 'string') {
      return { error: 'Statuspage response missing status.indicator' };
    }

    const mapped = INDICATOR_MAP[indicator.toLowerCase()];
    if (!mapped) {
      return {
        error: `Unrecognised statuspage indicator '${indicator}'`,
      };
    }

    return { status: mapped };
  } catch (err) {
    const e = err as Error & { name?: string };
    if (e?.name === 'AbortError') {
      return { error: `Statuspage timed out after ${STATUSPAGE_TIMEOUT_MS}ms` };
    }
    return { error: e?.message ?? 'Statuspage fetch failed' };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Dispatcher ─────────────────────────────────────────────
//
// One entry point the cron calls. Returns CheckResult or null when
// the component opts out (checkType='manual') so the cron can skip
// it without special-casing the call site.

export async function runCheck(
  checkType: string,
  config: Record<string, unknown> | null,
): Promise<CheckResult | null> {
  switch (checkType) {
    case 'internal_db':
      return checkInternalDb();
    case 'statuspage':
      return checkStatuspage(config);
    case 'manual':
      return null;
    default:
      return { error: `Unknown check_type '${checkType}'` };
  }
}
