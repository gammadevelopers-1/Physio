import { AuthenticatedUser } from '../modules/auth/strategies/jwt.strategy';

/** True for ADMIN and SUPER_ADMIN only — full system access, no scoping */
export function isGlobalAdmin(user: AuthenticatedUser): boolean {
  return user.activeRole === 'ADMIN' || user.activeRole === 'SUPER_ADMIN';
}

/** True when active role is MANAGER */
export function isManager(user: AuthenticatedUser): boolean {
  return user.activeRole === 'MANAGER';
}

/** True when active role is MANAGER, ADMIN, or SUPER_ADMIN */
export function isManagerOrAbove(user: AuthenticatedUser): boolean {
  return isGlobalAdmin(user) || isManager(user);
}

/** True when active role is TEACHING_ASSISTANT */
export function isTA(user: AuthenticatedUser): boolean {
  return user.activeRole === 'TEACHING_ASSISTANT';
}

/** True if user has the given role in their roles array (regardless of active role) */
export function hasRole(user: AuthenticatedUser, role: string): boolean {
  return user.roles.includes(role);
}
