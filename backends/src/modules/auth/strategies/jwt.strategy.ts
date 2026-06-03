import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { users, userRoles, roles } from '../../../database/schema';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  activeRole: string; // Currently selected role
  roles: string[]; // All user's roles
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  activeRole: string;
  roles: string[];
  isActive: boolean;
  supportSubRole?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-super-secret-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Fetch user from database to ensure they still exist and are active
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        activeRole: users.activeRole,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Get user's current roles from database (in case they changed)
    const userRolesList = await db
      .select({
        roleName: roles.name,
        supportSubRole: userRoles.supportSubRole,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    const roleNames = userRolesList.map((r) => r.roleName);

    // Extract support sub-role if user has SUPPORT role
    const supportEntry = userRolesList.find((r) => r.roleName === 'SUPPORT');
    const supportSubRole = supportEntry?.supportSubRole ?? null;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      activeRole: user.activeRole,
      roles: roleNames,
      isActive: user.isActive,
      supportSubRole,
    };
  }
}
