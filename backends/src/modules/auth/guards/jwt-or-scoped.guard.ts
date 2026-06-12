import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Accepts any of:
 *   1. A regular access JWT (signed user, has user-id claim) — sets req.user
 *   2. A scoped trainer-application JWT — sets req.scopedEmail
 *   3. No token at all — allowed through for the public support flow
 *      where a guest (not signed in, no OTP scope yet) attaches a file
 *      to a ticket they're about to submit. The endpoint already has
 *      its own protections (10MB cap, mime allowlist, per-IP throttle),
 *      and the CSRF middleware bypasses storage/upload for the same
 *      cross-origin-cookie reason auth endpoints are bypassed. Without
 *      this third path a true guest can never attach a file.
 *
 * When a token IS present, it must be valid. Garbage tokens are
 * rejected so a stale session token doesn't silently degrade to the
 * anonymous path.
 */
@Injectable()
export class JwtOrScopedGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      // Anonymous path — let the route handler proceed without
      // attaching req.user / req.scopedEmail. The handler must not
      // assume an authenticated user.
      return true;
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Scoped trainer-application tokens — both the original submit
    // purpose and the self-serve portal purpose can attach files. The
    // storage endpoint doesn't care which one; the resubmit handler
    // checks `purpose` more strictly when it matters.
    if (
      (payload?.purpose === 'trainer-application' ||
        payload?.purpose === 'trainer-application-portal') &&
      payload.email
    ) {
      (req as any).scopedEmail = payload.email;
      (req as any).scopedPurpose = payload.purpose;
      return true;
    }

    // Regular user token (set by login). Standard JwtStrategy adds .sub or .userId.
    if (payload?.sub || payload?.userId) {
      (req as any).user = {
        id: payload.userId || payload.sub,
        ...payload,
      };
      return true;
    }

    throw new UnauthorizedException('Token has no recognised purpose');
  }
}
