'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth, useHasMultipleRoles } from '@/contexts';
import {
  ChevronDown,
  GraduationCap,
  Users,
  Briefcase,
  Shield,
  DollarSign,
  HeadphonesIcon,
  Crown,
  Check,
  Loader2,
} from 'lucide-react';

// ===========================================
// Role Icons and Labels
// ===========================================
const ROLE_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  STUDENT: {
    icon: GraduationCap,
    label: 'Student',
    color: 'text-blue-600',
  },
  INSTRUCTOR: {
    icon: Users,
    label: 'Instructor',
    color: 'text-green-600',
  },
  MANAGER: {
    icon: Briefcase,
    label: 'Manager',
    color: 'text-purple-600',
  },
  ADMIN: {
    icon: Shield,
    label: 'Admin',
    color: 'text-orange-600',
  },
  FINANCE: {
    icon: DollarSign,
    label: 'Finance',
    color: 'text-emerald-600',
  },
  SUPPORT: {
    icon: HeadphonesIcon,
    label: 'Support',
    color: 'text-cyan-600',
  },
  SUPER_ADMIN: {
    icon: Crown,
    label: 'Super Admin',
    color: 'text-red-600',
  },
};

function getRoleConfig(role: string) {
  return (
    ROLE_CONFIG[role] || {
      icon: GraduationCap,
      label: role,
      color: 'text-gray-600',
    }
  );
}

// ===========================================
// Role Switcher Component
// ===========================================
export function RoleSwitcher() {
  const { user, switchRole, isLoading } = useAuth();
  const hasMultipleRoles = useHasMultipleRoles();
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

  // Don't render if no user or only one role
  if (!user || !hasMultipleRoles) {
    return null;
  }

  const activeConfig = getRoleConfig(user.activeRole);
  const ActiveIcon = activeConfig.icon;

  const handleSwitchRole = async (role: string) => {
    if (role === user.activeRole) {
      setIsOpen(false);
      return;
    }

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching || isLoading}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        {switching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ActiveIcon className={`w-4 h-4 ${activeConfig.color}`} />
        )}
        <span className="text-sm font-medium text-gray-700">
          {activeConfig.label}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
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
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                  isActive ? 'bg-gray-50' : ''
                }`}
              >
                <Icon className={`w-4 h-4 ${config.color}`} />
                <span className="flex-1 text-sm text-gray-700">
                  {config.label}
                </span>
                {isActive && <Check className="w-4 h-4 text-green-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===========================================
// Compact Role Switcher (for mobile)
// ===========================================
export function RoleSwitcherCompact() {
  const { user, switchRole } = useAuth();
  const hasMultipleRoles = useHasMultipleRoles();
  const [switching, setSwitching] = useState(false);

  if (!user || !hasMultipleRoles) {
    return null;
  }

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

  return (
    <div className="flex flex-wrap gap-2">
      {user.roles.map((role) => {
        const config = getRoleConfig(role);
        const Icon = config.icon;
        const isActive = role === user.activeRole;

        return (
          <button
            key={role}
            onClick={() => handleSwitchRole(role)}
            disabled={switching}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              isActive
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {switching && role !== user.activeRole ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

export default RoleSwitcher;
