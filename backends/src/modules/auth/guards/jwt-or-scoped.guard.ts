import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Accepts either:
 *   1. A regular access JWT (signed user, has user-id claim) — sets req.user
 *   2. A scoped trainer-application JWT — sets req.scopedEmail
 *
 * Used by storage uploads so anonymous-but-OTP-verified trainer applicants
 * can attach files to their pending application without holding a full session.
 */
@Injectable()
export class JwtOrScopedGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Scoped trainer-application token
    if (payload?.purpose === 'trainer-application' && payload.email) {
      (req as any).scopedEmail = payload.email;
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
