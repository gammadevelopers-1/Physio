/**
 * Captures per-request context (client IP + user agent) into an
 * AsyncLocalStorage store so services deep in the request chain —
 * notably AuditLogService — can include it on every write without
 * the call site plumbing it through.
 *
 * Wiring: applied via app.use() in main.ts BEFORE any other
 * middleware that might fork the async chain (cookieParser is safe;
 * route handlers are the consumers). Must be a closure over the
 * shared RequestContextService instance so all reads land in the
 * same store.
 *
 * IP resolution:
 *   - Behind Cloud Run / a load balancer, `req.ip` resolves to the
 *     proxy unless `app.set('trust proxy', ...)` is configured. We
 *     prefer the first non-empty entry of `X-Forwarded-For` so the
 *     audit log records the real client IP, not the LB.
 *   - Falls back to `req.socket.remoteAddress` if no forwarding
 *     header is present (e.g. local dev hitting the backend direct).
 */

import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './request-context.service';

function resolveClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    // X-Forwarded-For is a comma-separated chain; the leftmost
    // entry is the original client. Trim whitespace because some
    // proxies pad with a space.
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}

export function createRequestContextMiddleware(ctx: RequestContextService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ipAddress = resolveClientIp(req);
    const userAgentHeader = req.headers['user-agent'];
    const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : undefined;
    ctx.run({ ipAddress, userAgent }, () => next());
  };
}
