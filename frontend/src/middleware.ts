import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Dashboard paths that require authentication
const PROTECTED_PREFIX = '/dashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
const IS_PROD = process.env.NODE_ENV === 'production';

// ===========================================
// Content-Security-Policy
// ===========================================
// Rolled out in Report-Only first: the browser reports violations to the
// console but blocks nothing, so we can confirm every legit resource is
// allowed before enforcing. Flip CSP_REPORT_ONLY to false to enforce.
const CSP_REPORT_ONLY = false;
const CSP_RESPONSE_HEADER = CSP_REPORT_ONLY
  ? 'content-security-policy-report-only'
  : 'content-security-policy';

function apiOrigin(): string {
  try {
    return new URL(API_URL).origin;
  } catch {
    return '';
  }
}

// Strong, app-specific CSP. script-src uses a per-request nonce +
// 'strict-dynamic' (modern browsers ignore the host allowlist / 'unsafe-inline'
// fallbacks, which exist only for old browsers). Everything the app actually
// loads — GTM/GA4/Meta Pixel, reCAPTCHA, Leaflet/OSM, Strapi+GCS media,
// admin-entered video/PDF embeds — is accounted for below.
function buildCsp(nonce: string): string {
  const cms = 'https://cms.physioguidance.org';
  const connect = [
    "'self'",
    apiOrigin(),
    cms,
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://analytics.google.com',
    'https://stats.g.doubleclick.net',
    'https://connect.facebook.net',
    'https://www.facebook.com',
    'https://www.google.com',
    'https://www.gstatic.com',
    // Sentry frontend error ingest. Project lives in the EU region
    // (de.sentry.io); subdomain is the numeric org id which can change
    // if the org is moved, so we whitelist the full ingest subdomain
    // pattern rather than a specific host.
    'https://*.ingest.de.sentry.io',
    'https://*.ingest.sentry.io',
  ];
  if (!IS_PROD) {
    connect.push('http://localhost:8080', 'http://localhost:*', 'ws://localhost:*');
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect.filter(Boolean).join(' ')}`,
    // Iframes we embed: reCAPTCHA, GTM noscript, admin-entered videos
    // (YouTube/Vimeo/etc.) and PDF previews from our media hosts.
    "frame-src 'self' https:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "manifest-src 'self'",
  ];
  if (IS_PROD) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

// Build a render response that (a) forwards the nonce to the React render so
// Next can tag its own scripts, and (b) carries the CSP for the browser. Used
// only on non-redirect paths.
function renderWithCsp(
  request: NextRequest,
  nonce: string,
  csp: string,
): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next reads the nonce from the request CSP header to tag its scripts. This
  // header never reaches the browser; the browser only sees the response one.
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CSP_RESPONSE_HEADER, csp);
  return response;
}

// next-intl owns the i18n rewrite. We run it, then re-issue its rewrite with
// the nonce merged into the forwarded request headers (so the render sees it),
// preserving next-intl's own request-header overrides + response cookies.
function intlWithCsp(
  request: NextRequest,
  nonce: string,
  csp: string,
): NextResponse {
  const intlResponse = intlMiddleware(request);

  // next-intl redirected (e.g. added a locale prefix) — redirects don't carry
  // a rendered body, so no nonce/CSP needed; the target gets it on its render.
  if (intlResponse.headers.get('location')) {
    return intlResponse;
  }

  // Merge next-intl's request-header overrides with our nonce + CSP.
  const merged = new Headers(request.headers);
  const overrides = intlResponse.headers.get('x-middleware-override-headers');
  if (overrides) {
    for (const name of overrides.split(',').map((s) => s.trim()).filter(Boolean)) {
      const value = intlResponse.headers.get(`x-middleware-request-${name}`);
      if (value !== null) merged.set(name, value);
    }
  }
  merged.set('x-nonce', nonce);
  merged.set('content-security-policy', csp);

  const rewrite = intlResponse.headers.get('x-middleware-rewrite');
  const response = rewrite
    ? NextResponse.rewrite(new URL(rewrite, request.url), {
        request: { headers: merged },
      })
    : NextResponse.next({ request: { headers: merged } });

  // Preserve next-intl's response cookies (NEXT_LOCALE) and Vary/Link.
  intlResponse.cookies.getAll().forEach((c) => {
    response.cookies.set(c);
  });
  const vary = intlResponse.headers.get('vary');
  if (vary) response.headers.set('vary', vary);
  const link = intlResponse.headers.get('link');
  if (link) response.headers.set('link', link);

  response.headers.set(CSP_RESPONSE_HEADER, csp);
  return response;
}

interface CachedLocaleSettings {
  defaultLanguage: 'en' | 'ar';
  allowedLanguages: ('en' | 'ar')[];
  fetchedAt: number;
}

interface CachedMaintenance {
  enabled: boolean;
  fetchedAt: number;
  /** True only when the last value came from a successful API read.
   *  Used to keep the gate sticky across transient API errors. */
  trusted: boolean;
}

// Tiny in-process caches so we don't hammer the API on every request.
let cached: CachedLocaleSettings | null = null;
let cachedMaint: CachedMaintenance | null = null;
const TTL_MS = 60_000;
// Maintenance refreshes faster so admins flipping the toggle off see
// the site come back within ~30 seconds.
const MAINT_TTL_MS = 30_000;
// Stickiness window for the last KNOWN-true maintenance read. If the
// API hiccups during an active maintenance window we keep enforcing it
// for up to this long — fail-closed instead of accidentally exposing
// the site mid-incident. After this window we re-evaluate (and if the
// API is still down, fall open as a last resort so admins aren't
// locked out forever by an API outage).
const MAINT_STICKY_MS = 5 * 60_000;

async function getLocaleSettings(): Promise<CachedLocaleSettings> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached;
  }
  try {
    const res = await fetch(`${API_URL}/public/locale-settings`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const allowed = Array.isArray(data.allowedLanguages)
        ? data.allowedLanguages.filter((l: string) => l === 'en' || l === 'ar')
        : ['en', 'ar'];
      const def: 'en' | 'ar' =
        data.defaultLanguage === 'ar' ? 'ar' : 'en';
      cached = {
        defaultLanguage: allowed.includes(def) ? def : (allowed[0] as 'en' | 'ar') || 'en',
        allowedLanguages: allowed.length ? allowed : ['en', 'ar'],
        fetchedAt: Date.now(),
      };
      return cached;
    }
  } catch {
    // ignore — fall through to safe defaults
  }
  cached = {
    defaultLanguage: 'en',
    allowedLanguages: ['en', 'ar'],
    fetchedAt: Date.now(),
  };
  return cached;
}

async function getMaintenance(): Promise<CachedMaintenance> {
  if (cachedMaint && Date.now() - cachedMaint.fetchedAt < MAINT_TTL_MS) {
    return cachedMaint;
  }
  try {
    const res = await fetch(`${API_URL}/public/maintenance-status`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      cachedMaint = {
        enabled: !!data.enabled,
        fetchedAt: Date.now(),
        trusted: true,
      };
      return cachedMaint;
    }
    console.warn(
      `[middleware] maintenance-status non-OK: ${res.status} — falling open`,
    );
  } catch (e) {
    console.warn(
      `[middleware] maintenance-status fetch failed: ${
        e instanceof Error ? e.message : 'unknown'
      } — applying sticky/fail-open logic`,
    );
  }
  // Sticky fail-closed: if we last saw enabled=true via a trusted read
  // within the stickiness window, keep enforcing maintenance. Better to
  // wrongly keep the site down for 5 min than to wrongly open it
  // mid-incident.
  if (
    cachedMaint?.trusted &&
    cachedMaint.enabled &&
    Date.now() - cachedMaint.fetchedAt < MAINT_STICKY_MS
  ) {
    // Refresh the timestamp so the TTL gate above doesn't keep us
    // re-fetching every request during the sticky window.
    cachedMaint = { ...cachedMaint, fetchedAt: Date.now(), trusted: false };
    return cachedMaint;
  }
  cachedMaint = { enabled: false, fetchedAt: Date.now(), trusted: false };
  return cachedMaint;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Per-request CSP nonce shared across every render path below.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Maintenance check FIRST — runs ahead of auth so a logged-in
  // student/instructor/manager sees the maintenance page just like a
  // logged-out visitor. Admins keep their dashboard, sign-in/password
  // routes stay reachable so an admin can log in and turn it off, and
  // the maintenance page itself is obviously reachable. Authenticated
  // admins (via pg_roles cookie) skip the gate entirely — they can
  // browse anywhere while maintenance is on so they don't lock
  // themselves out mid-fix.
  const maint = await getMaintenance();
  if (maint.enabled) {
    const isAdminUser = (() => {
      const rolesRaw = request.cookies.get('pg_roles')?.value;
      if (!rolesRaw) return false;
      try {
        const roles = decodeURIComponent(rolesRaw).split(',').filter(Boolean);
        return roles.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN');
      } catch {
        return false;
      }
    })();

    const isAdminDashboard = /^\/(en|ar)\/dashboard\/admin(\/|$)/.test(pathname);
    const isAuthRoute = /^\/(en|ar)\/(signin|set-password|forgot-password|reset-password|verify)(\/|$)/.test(
      pathname,
    );
    const isMaintenancePage = /^\/(en|ar)\/maintenance(\/|$)/.test(pathname);
    const firstSeg = pathname.split('/').filter(Boolean)[0];
    const localeForRedirect: 'en' | 'ar' =
      firstSeg === 'ar' ? 'ar' : 'en';

    if (!isAdminUser && !isAdminDashboard && !isAuthRoute && !isMaintenancePage) {
      return NextResponse.redirect(
        new URL(`/${localeForRedirect}/maintenance`, request.url),
      );
    }
    // Admin dashboard during maintenance still requires the auth check
    // below, so fall through to the auth gate.
  }

  // Protected dashboard routes — auth-gate.
  if (pathname.includes(PROTECTED_PREFIX)) {
    const session = request.cookies.get('session');

    if (!session?.value) {
      const locale = pathname.split('/')[1] || 'en';
      const redirectUrl = encodeURIComponent(pathname);
      return NextResponse.redirect(
        new URL(`/${locale}/signin?redirect=${redirectUrl}`, request.url)
      );
    }
    return renderWithCsp(request, nonce, csp);
  }

  // Locale-aware redirects honoring admin Settings.
  const settings = await getLocaleSettings();
  const firstSeg = pathname.split('/').filter(Boolean)[0];

  // Root → default locale
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(`/${settings.defaultLanguage}`, request.url),
    );
  }

  // Disallowed locale → default locale (preserving path tail)
  if (
    (firstSeg === 'en' || firstSeg === 'ar') &&
    !settings.allowedLanguages.includes(firstSeg as 'en' | 'ar')
  ) {
    const tail = pathname.replace(/^\/(en|ar)/, '');
    return NextResponse.redirect(
      new URL(`/${settings.defaultLanguage}${tail}`, request.url),
    );
  }

  return intlWithCsp(request, nonce, csp);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)',],
};
