'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useAuth, useHasMultipleRoles } from '@/contexts';
import {
  ChevronDown,
  User,
  Settings,
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
// Role Icons and Labels
// ===========================================
const ROLE_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
  STUDENT: {
    icon: GraduationCap,
    label: 'Student',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  INSTRUCTOR: {
    icon: Users,
    label: 'Instructor',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  TEACHING_ASSISTANT: {
    icon: UserCheck,
    label: 'Teaching Assistant',
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
  MANAGER: {
    icon: Briefcase,
    label: 'Manager',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  ADMIN: {
    icon: Shield,
    label: 'Admin',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  FINANCE: {
    icon: DollarSign,
    label: 'Finance',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  SUPPORT: {
    icon: HeadphonesIcon,
    label: 'Support',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  SUPER_ADMIN: {
    icon: Crown,
    label: 'Super Admin',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
};

function getRoleConfig(role: string) {
  return (
    ROLE_CONFIG[role] || {
      icon: GraduationCap,
      label: role,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
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
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return null;
  }

  const activeConfig = getRoleConfig(user.activeRole);
  const ActiveIcon = activeConfig.icon;
  const dashboardPath = ROLE_DASHBOARD_PATHS[user.activeRole] || '/dashboard/student';

  const handleSwitchRole = async (role: string) => {
    if (role === user.activeRole) return;

    setSwitching(true);
    try {
      await switchRole(role);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch role:', error);
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  const initials =
    (user.firstName?.[0] || '') + (user.lastName?.[0] || user.email[0]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching || isLoading}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full ${activeConfig.bgColor} flex items-center justify-center`}
        >
          <span className={`text-sm font-medium ${activeConfig.color}`}>
            {initials.toUpperCase()}
          </span>
        </div>

        {/* Name & Role - Hidden on mobile */}
        <div className="hidden md:flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900">
            {user.firstName || user.email.split('@')[0]}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <ActiveIcon className={`w-3 h-3 ${activeConfig.color}`} />
            {activeConfig.label}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>

          {/* Dashboard Link */}
          <div className="py-1">
            <Link
              href={`/${locale}${dashboardPath}`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm">Dashboard</span>
            </Link>
          </div>

          {/* Role Switcher Section */}
          {hasMultipleRoles && (
            <div className="py-1 border-t border-gray-100">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Switch Role
              </div>
              {user.roles.map((role) => {
                const config = getRoleConfig(role);
                const Icon = config.icon;
                const isActive = role === user.activeRole;

                return (
                  <button
                    key={role}
                    onClick={() => handleSwitchRole(role)}
                    disabled={switching}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <span className="flex-1 text-sm text-gray-700">
                      {config.label}
                    </span>
                    {isActive && <Check className="w-4 h-4 text-green-600" />}
                    {switching && role !== user.activeRole && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Settings & Logout */}
          <div className="py-1 border-t border-gray-100">
            <Link
              href={`/${locale}/settings`}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
