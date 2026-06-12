import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Allowed `purpose` claims on a trainer-application scoped JWT. Each
 * value corresponds to a distinct user flow:
 *
 *   - 'trainer-application'         submit a brand-new application
 *   - 'trainer-application-portal'  self-serve status + resubmit
 *
 * The OTP-verify endpoint issues exactly ONE of these per request, so
 * a token meant for the portal cannot be replayed against the submit
 * endpoint and vice versa. The handler is responsible for asserting
 * `req.scopedPurpose` matches the action.
 */
const ALLOWED_SCOPED_PURPOSES = new Set<string>([
  'trainer-application',
  'trainer-application-portal',
]);

/**
 * Guard that validates a short-lived "scoped" JWT — distinct from the
 * regular access token used by JwtAuthGuard.
 *
 * Issued by the trainer-application OTP-verify endpoint after the
 * applicant proves they own an email address. Carries:
 *   { purpose: <one of the values above>, email: <verified-email> }
 *
 * The handler is responsible for verifying that `req.scopedPurpose`
 * matches the action it's about to perform (e.g. the resubmit
 * endpoint must reject a 'trainer-application-status' token). The
 * guard only checks the token is a known scoped purpose so a regular
 * login JWT can't be repurposed here.
 */
@Injectable()
export class ScopedJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Missing scoped token');
    }

    let payload: { purpose?: string; email?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired scoped token');
    }

    if (!payload.purpose || !ALLOWED_SCOPED_PURPOSES.has(payload.purpose)) {
      throw new UnauthorizedException('Token not valid for this action');
    }

    if (!payload.email) {
      throw new UnauthorizedException('Token missing verified email');
    }

    // Attach for downstream handlers
    (req as any).scopedEmail = payload.email;
    (req as any).scopedPurpose = payload.purpose;
    return true;
  }
}
