'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth, useHasMultipleRoles } from '@/contexts';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  LogOut,
  GraduationCap,
  Users,
  Briefcase,
  Shield,
  DollarSign,
  HeadphonesIcon,
  Crown,
  Check,
  Loader2,
  LayoutDashboard,
  UserCheck,
} from 'lucide-react';

// ===========================================
// Role Icons and Colors
// ===========================================
const ROLE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  STUDENT: { icon: GraduationCap, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  INSTRUCTOR: { icon: Users, color: 'text-green-600', bgColor: 'bg-green-100' },
  TEACHING_ASSISTANT: { icon: UserCheck, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  MANAGER: { icon: Briefcase, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  ADMIN: { icon: Shield, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  FINANCE: { icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  SUPPORT: { icon: HeadphonesIcon, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
  SUPER_ADMIN: { icon: Crown, color: 'text-red-600', bgColor: 'bg-red-100' },
};

function getRoleConfig(role: string) {
  return (
    ROLE_CONFIG[role] || {
      icon: GraduationCap,
      color: 'text-[var(--color-text-secondary)]',
      bgColor: 'bg-[var(--color-border-subtle)]',
    }
  );
}

// Dashboard paths
const ROLE_DASHBOARD_PATHS: Record<string, string> = {
  STUDENT: '/dashboard/student',
  INSTRUCTOR: '/dashboard/instructor',
  TEACHING_ASSISTANT: '/dashboard/teaching-assistant',
  MANAGER: '/dashboard/manager',
  ADMIN: '/dashboard/admin',
  FINANCE: '/dashboard/finance',
  SUPPORT: '/dashboard/support',
  SUPER_ADMIN: '/dashboard/admin',
};

// ===========================================
// User Menu Component
// ===========================================
export function UserMenu() {
  const { user, logout, switchRole, isLoading } = useAuth();
  const hasMultipleRoles = useHasMultipleRoles();
  const locale = useLocale();
  const t = useTranslations('userMenu');
  const [switching, setSwitching] = useState(false);

  const isRTL = locale === 'ar';

  if (!user) {
    return null;
  }

  const activeConfig = getRoleConfig(user.activeRole);
  const ActiveIcon = activeConfig.icon;
  const dashboardPath = ROLE_DASHBOARD_PATHS[user.activeRole] || '/dashboard/student';

  const getRoleLabel = (role: string) => {
    const key = role.toLowerCase();
    try {
      return t(`roles.${key}`);
    } catch {
      return role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  };

  const handleSwitchRole = async (role: string) => {
    if (role === user.activeRole) return;
    setSwitching(true);
    try {
      await switchRole(role);
    } catch (error) {
      console.error('Failed to switch role:', error);
    } finally {
      setSwitching(false);
    }
  };

  const initials =
    (user.firstName?.[0] || '') + (user.lastName?.[0] || user.email[0]);

  return (
    // modal={false} — Radix's default modal mode locks body scroll
    // (adds `overflow: hidden`) while the menu is open, which makes
    // <body> a scroll container and breaks `position: sticky` on the
    // navbar (nav sticks to body instead of viewport → disappears).
    // A navbar avatar menu isn't a true modal; outside-click still
    // closes it, and interaction under the menu stays live.
    <DropdownMenu dir={isRTL ? 'rtl' : 'ltr'} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          disabled={switching || isLoading}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
        >
          <div
            className={`w-8 h-8 rounded-full ${activeConfig.bgColor} flex items-center justify-center flex-shrink-0`}
          >
            <span className={`text-sm font-medium ${activeConfig.color}`}>
              {initials.toUpperCase()}
            </span>
          </div>
          <div className={`hidden md:flex flex-col ${isRTL ? 'items-end' : 'items-start'}`}>
            <span className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">
              {user.firstName || user.email.split('@')[0]}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1 leading-tight">
              <ActiveIcon className={`w-3 h-3 ${activeConfig.color}`} />
              {getRoleLabel(user.activeRole)}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 rounded-xl py-2"
      >
        {/* User Info Header */}
        <div className={`px-4 py-3 border-b border-[var(--color-border)] ${isRTL ? 'text-right' : 'text-left'}`}>
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">{user.email}</p>
        </div>

        {/* Dashboard Link */}
        <DropdownMenuItem asChild>
          <Link
            href={`/${locale}${dashboardPath}`}
            className="flex items-center gap-3 px-4 py-2 text-[var(--color-text-primary)]"
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{t('dashboard')}</span>
          </Link>
        </DropdownMenuItem>

        {/* Role Switcher Section */}
        {hasMultipleRoles && (
          <>
            <DropdownMenuSeparator />
            <div className={`px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('switchRole')}
            </div>
            {user.roles.map((role) => {
              const config = getRoleConfig(role);
              const Icon = config.icon;
              const isActive = role === user.activeRole;

              return (
                <DropdownMenuItem
                  key={role}
                  onClick={() => handleSwitchRole(role)}
                  disabled={switching}
                  className={`flex items-center gap-3 px-4 py-2 ${isActive ? 'bg-[var(--color-surface-page)]' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
                    {getRoleLabel(role)}
                  </span>
                  {isActive && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                  {switching && role !== user.activeRole && (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-icon)] flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        {/* Logout */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          danger
          onClick={async () => { await logout(); }}
          className="flex items-center gap-3 px-4 py-2"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
