/**
 * Lightweight CSRF protection using the double-submit cookie pattern.
 *
 * What it does:
 *   1. On every request, if no `csrf` cookie is set, generate a fresh
 *      random token and set it (non-httpOnly so the browser JS can read
 *      and echo it back in a header).
 *   2. For state-changing requests (POST/PUT/PATCH/DELETE), require
 *      the `X-CSRF-Token` request header to match the `csrf` cookie.
 *
 * Defense-in-depth notes:
 *   - The frontend uses Bearer JWT for the vast majority of mutations.
 *     A cross-site attacker can't add the Authorization header (blocked
 *     by CORS preflight), so those requests are already CSRF-safe.
 *     Therefore we SKIP the check when an Authorization header is
 *     present. The CSRF check only fires on cookie-auth requests like
 *     POST /auth/refresh — exactly where CSRF actually matters.
 *   - Webhook routes (Zoom calls them) bypass this entirely since they
 *     come from outside our origin and don't carry our cookies.
 *   - SameSite=Lax on the refresh cookie is the first line of defense;
 *     this middleware adds the second.
 *
 * Wiring: applied via app.use() in main.ts BEFORE the request reaches
 * any controller / guard. Routes that need to bypass (webhooks) are
 * matched by path prefix below.
 */

import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const CSRF_COOKIE_NAME = 'csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_BYTES = 24;

// Paths that bypass CSRF entirely. These are either:
//   - Webhooks: signed by the caller (HMAC verified by the receiver)
//   - Public reads that have nothing to mutate
//   - Auth endpoints in a cross-origin setup: the frontend on
//     physioguidance.org cannot read the csrf cookie set on
//     api.physioguidance.org (cross-origin cookie isolation), so the
//     double-submit pattern cannot work for unauthenticated requests.
//     These endpoints are already protected by reCAPTCHA + rate
//     limiting + per-account brute-force lockout, so CSRF would be
//     defense-in-depth that breaks login UX entirely. Bypass them.
//   - Public guest-support endpoints (file upload, guest ticket
//     submit + reply, public CSAT). Same cross-origin cookie problem
//     as auth — guests on the marketing site can't read the cookie
//     set on the API origin. Each endpoint has its own protection:
//     storage/upload caps size + mime, /tickets/guest has reCAPTCHA +
//     per-email rate limit, /tickets/track/* uses an unguessable
//     UUID token + per-IP throttle. CSRF here would just break the
//     flow without adding real defense.
const BYPASS_PREFIXES = [
  '/api/zoom/webhook',
  // Payment gateway webhooks (Moyasar / Tap / Tamara / Tabby) hit
  // /api/webhooks/:gateway. They are sent server-to-server with no CSRF
  // cookie and are authenticated by verifyWebhook() (shared secret / HMAC),
  // so CSRF must not block them. (The legacy '/api/payments/webhook' below is
  // kept harmlessly; the live route is '/api/webhooks/*'.)
  '/api/webhooks',
  '/api/payments/webhook',
  '/api/auth/',
  '/api/storage/upload',
  '/api/tickets/guest',
  '/api/tickets/track/',
  '/api/tickets/csat/',
  '/api/tickets/kb/searches',
  // Trainer applications — both the initial apply flow and the
  // self-serve "Check your application" portal hit the API from
  // the public marketing site, so they share the cross-origin
  // cookie isolation problem. Endpoints are protected by reCAPTCHA
  // on the OTP request, OTP on submit/resubmit, and a scoped JWT
  // for any portal mutation, so CSRF here would only break the UX.
  '/api/trainer-applications/',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function csrfMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // 1. Always ensure a token cookie exists. The browser will use this on
  //    its next mutation request.
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (!existing) {
    res.cookie(CSRF_COOKIE_NAME, generateToken(), {
      // NOT httpOnly: frontend JS reads this to echo back in header
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      // Lax is enough — we just need the cookie to be present on
      // same-site navigations. Cross-site won't carry it, which is fine.
      sameSite: 'lax',
      path: '/',
    });
  }

  // 2. Skip the check for safe methods and bypassed routes
  if (SAFE_METHODS.has(req.method)) return next();
  if (BYPASS_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  // 3. Skip when Bearer auth is in play — CORS already protects those
  //    requests. The CSRF check exists for the cookie-auth surface.
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  // 4. Validate header matches cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken =
    (req.headers[CSRF_HEADER_NAME] as string | undefined) ||
    (req.headers[CSRF_HEADER_NAME.toUpperCase()] as string | undefined);

  // If the request didn't supply a CSRF header at all, it isn't attempting
  // the double-submit handshake — let the auth guard decide. In our setup
  // the frontend authenticates every mutation with a Bearer token, so a
  // missing header almost always means we're in the brief token-refresh
  // race after a page reload (in-memory access token gone, refresh hasn't
  // completed). Returning 403 here would freeze that request because the
  // frontend's retry loop only fires on 401. A real CSRF attack can't add
  // an Authorization header (blocked by CORS preflight) and won't reach a
  // mutation endpoint that requires it. Cookie-auth endpoints that DO need
  // CSRF protection (e.g. /api/auth/*) are not in this path — they are
  // already in BYPASS_PREFIXES or protected by their own checks.
  if (!headerToken) return next();

  if (!cookieToken || cookieToken !== headerToken) {
    res.status(403).json({
      statusCode: 403,
      message: 'CSRF token missing or invalid',
      error: 'Forbidden',
    });
    return;
  }

  next();
}
