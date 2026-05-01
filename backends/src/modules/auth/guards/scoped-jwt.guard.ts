import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Guard that validates a short-lived "scoped" JWT — distinct from the
 * regular access token used by JwtAuthGuard.
 *
 * Issued ONLY by the trainer-application OTP-verify endpoint. Carries:
 *   { purpose: 'trainer-application', email: <verified-email> }
 *
 * Used by:
 *   - POST /trainer-applications/submit
 *   - File upload during the public application flow
 *
 * Refuses any token that doesn't carry the expected `purpose` claim, so
 * a regular login JWT cannot be repurposed here and vice versa.
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

    if (payload.purpose !== 'trainer-application' || !payload.email) {
      throw new UnauthorizedException('Token not valid for this action');
    }

    // Attach for downstream handlers
    (req as any).scopedEmail = payload.email;
    return true;
  }
}
