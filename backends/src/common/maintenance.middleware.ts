/**
 * Maintenance-mode middleware.
 *
 * When `system_settings.maintenance.enabled` is true, returns HTTP 503
 * with a localized message for everyone EXCEPT:
 *   - Auth endpoints (`/api/auth/*`) — admins still need to log in
 *   - Admin endpoints (`/api/admin/*`) — so the toggle can be turned
 *     off again from the dashboard
 *   - Public endpoints (`/api/public/*`) — locale settings, maintenance
 *     status itself, and the maintenance page's data fetches need to
 *     stay reachable
 *   - Webhook endpoints (`/api/zoom/webhook`, `/api/payments/webhook`)
 *     — external systems can't read maintenance state and would
 *     interpret 503 as us being broken
 *   - Health endpoint (`/api/health`) — k8s/Cloud Run liveness probes
 *   - **Any authenticated admin / super-admin** — by inspecting the
 *     `Authorization: Bearer` JWT (or fallback to refreshToken cookie
 *     if access token is absent). This lets the admin keep working
 *     end-to-end during maintenance (e.g. navbar's useSiteSettings
 *     fetch, audit logs, etc.) without bypassing the actual gate for
 *     regular users.
 *
 * Mounted globally in main.ts after the body parser but before the
 * controllers fire.
 *
 * Status: 503 + Retry-After: 1800 so well-behaved clients back off
 * for 30 min rather than hammering the API during the window.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { AdminSettingsService } from '../modules/admin-settings/admin-settings.service';

const BYPASS_PREFIXES = [
  '/api/auth/',
  '/api/admin/',
  '/api/public/',
  '/api/zoom/webhook',
  '/api/payments/webhook',
  '/api/health',
];

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

interface AccessTokenPayload {
  sub?: string;
  email?: string;
  activeRole?: string;
  roles?: string[];
}

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(
    private readonly settings: AdminSettingsService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Inspect the request's Authorization header (or refresh-token
   * cookie as a backup) and return true if it belongs to an
   * authenticated ADMIN / SUPER_ADMIN user. Verifies the JWT
   * signature so forged tokens cannot bypass the gate.
   */
  private isAdminRequest(req: Request): boolean {
    try {
      const authHeader = req.headers['authorization'];
      if (
        typeof authHeader === 'string' &&
        authHeader.toLowerCase().startsWith('bearer ')
      ) {
        const token = authHeader.slice(7).trim();
        if (token) {
          const payload = this.jwtService.verify<AccessTokenPayload>(token);
          const roles = Array.isArray(payload.roles) ? payload.roles : [];
          if (roles.some((r) => ADMIN_ROLES.has(r))) return true;
          if (payload.activeRole && ADMIN_ROLES.has(payload.activeRole)) return true;
        }
      }
    } catch {
      // Invalid / expired token — fall through; user is treated as
      // unauthenticated for the purposes of maintenance bypass.
    }
    return false;
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // NestJS strips the `setGlobalPrefix('api')` from `req.path` before
    // this middleware sees it, so `/api/public/...` arrives as just
    // `/public/...`. Use `req.originalUrl` which keeps the full path,
    // and check against both forms so future refactors that mount the
    // middleware differently still match.
    const fullPath = req.originalUrl.split('?')[0];
    const matchesBypass = BYPASS_PREFIXES.some(
      (p) => fullPath.startsWith(p) || req.path.startsWith(p),
    );
    if (matchesBypass) {
      return next();
    }

    try {
      const status = await this.settings.getMaintenanceStatus();
      if (!status.enabled) return next();

      // Authenticated admin → bypass entirely so they can keep
      // working through maintenance (navbar fetches, exports, etc.).
      if (this.isAdminRequest(req)) {
        return next();
      }

      // Pick locale from header / query so the message reads naturally
      // to whoever's blocked. Fall back to English.
      const isArabic =
        req.headers['accept-language']?.toString().toLowerCase().includes('ar') ||
        (req.query.locale && String(req.query.locale).toLowerCase() === 'ar');

      res.setHeader('Retry-After', '1800');
      res.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message: isArabic ? status.messageAr : status.messageEn,
        maintenance: true,
      });
      return;
    } catch {
      // If the settings table read fails, fail OPEN — better to keep
      // the platform up than to take it down on a transient DB hiccup.
      return next();
    }
  }
}
