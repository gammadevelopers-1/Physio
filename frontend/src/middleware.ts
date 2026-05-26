import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Dashboard paths that require authentication
const PROTECTED_PREFIX = '/dashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

interface CachedLocaleSettings {
  defaultLanguage: 'en' | 'ar';
  allowedLanguages: ('en' | 'ar')[];
  fetchedAt: number;
}

interface CachedMaintenance {
  enabled: boolean;
  fetchedAt: number;
}

// Tiny in-process caches so we don't hammer the API on every request.
let cached: CachedLocaleSettings | null = null;
let cachedMaint: CachedMaintenance | null = null;
const TTL_MS = 60_000;
// Maintenance refreshes faster so admins flipping the toggle off see
// the site come back within ~30 seconds.
const MAINT_TTL_MS = 30_000;

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
      };
      return cachedMaint;
    }
  } catch {
    // ignore — fall open
  }
  cachedMaint = { enabled: false, fetchedAt: Date.now() };
  return cachedMaint;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    return NextResponse.next();
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

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)',],
};
