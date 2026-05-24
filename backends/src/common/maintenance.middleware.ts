/**
 * Maintenance-mode middleware.
 *
 * When `system_settings.maintenance.enabled` is true, returns HTTP 503
 * with a localized message for everyone EXCEPT:
 *   - Auth endpoints (`/api/auth/*`) — admins still need to log in
 *   - Admin endpoints (`/api/admin/*`) — so the toggle can be turned
 *     off again from the dashboard
 *   - Webhook endpoints (`/api/zoom/webhook`, `/api/payments/webhook`)
 *     — external systems can't read maintenance state and would
 *     interpret 503 as us being broken
 *   - Health endpoint (`/api/health`) — k8s/Cloud Run liveness probes
 *
 * Mounted globally in main.ts after the body parser but before the
 * controllers fire.
 *
 * Status: 503 + Retry-After: 1800 so well-behaved clients back off
 * for 30 min rather than hammering the API during the window.
 */

import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
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

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private readonly settings: AdminSettingsService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (BYPASS_PREFIXES.some((p) => req.path.startsWith(p))) {
      return next();
    }

    try {
      const status = await this.settings.getMaintenanceStatus();
      if (!status.enabled) return next();

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
