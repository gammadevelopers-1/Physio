import { AuthenticatedUser } from '../modules/auth/strategies/jwt.strategy';

/** True for ADMIN and SUPER_ADMIN only — full system access, no scoping */
export function isGlobalAdmin(user: AuthenticatedUser): boolean {
  return user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
}

/** True for MANAGER role only */
export function isManager(user: AuthenticatedUser): boolean {
  return user.roles.includes('MANAGER');
}

/** True for MANAGER, ADMIN, or SUPER_ADMIN */
export function isManagerOrAbove(user: AuthenticatedUser): boolean {
  return isGlobalAdmin(user) || isManager(user);
}

/** True for TEACHING_ASSISTANT role */
export function isTA(user: AuthenticatedUser): boolean {
  return user.roles.includes('TEACHING_ASSISTANT');
}
