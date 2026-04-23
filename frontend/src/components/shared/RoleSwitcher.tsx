"use client";

import { useState } from "react";
import { useAuth } from "@/contexts";
import { useTranslations } from "next-intl";
import {
  GraduationCap,
  BookOpen,
  Shield,
  Briefcase,
  DollarSign,
  Headphones,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ROLE_ICONS: Record<string, LucideIcon> = {
  STUDENT: GraduationCap,
  INSTRUCTOR: BookOpen,
  ADMIN: Shield,
  SUPER_ADMIN: Shield,
  MANAGER: Briefcase,
  FINANCE: DollarSign,
  SUPPORT: Headphones,
};

/**
 * Role switcher items for desktop navbar dropdown menus.
 * Shows other available roles the user can switch to.
 * Only renders if user has more than one role.
 */
export function RoleSwitcherDropdownItems({ onSwitch }: { onSwitch?: () => void }) {
  const { switchRole, user } = useAuth();
  const t = useTranslations("roleSwitcher");
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);

  const roles = user?.roles || [];
  const activeRole = user?.activeRole;

  if (roles.length <= 1) return null;

  const otherRoles = roles.filter((r) => r !== activeRole);

  const handleSwitch = async (role: string) => {
    setSwitchingRole(role);
    try {
      await switchRole(role);
      onSwitch?.();
    } finally {
      setSwitchingRole(null);
    }
  };

  const getRoleLabel = (role: string) => {
    const key = role.toLowerCase();
    try {
      return t(`roles.${key}`);
    } catch {
      return role.charAt(0) + role.slice(1).toLowerCase();
    }
  };

  return (
    <>
      <div className="border-t border-[var(--outline-subtle)] my-1" />
      <p className="px-4 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] text-start">
        {t("switchDashboard")}
      </p>
      {otherRoles.map((role) => {
        const Icon = ROLE_ICONS[role] || Shield;
        const isSwitching = switchingRole === role;

        return (
          <button
            key={role}
            onClick={() => handleSwitch(role)}
            disabled={isSwitching}
            className="flex items-center justify-start gap-2 px-4 py-2 w-full text-sm text-start text-[#002D87] hover:bg-[#F0F7FF] transition-colors disabled:opacity-50"
          >
            {isSwitching ? (
              <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            ) : (
              <Icon className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">{getRoleLabel(role)}</span>
          </button>
        );
      })}
    </>
  );
}

/**
 * Role switcher section for mobile menus.
 * Shows a horizontal section with role switch buttons.
 * Only renders if user has more than one role.
 */
export function RoleSwitcherMobileSection({ onSwitch }: { onSwitch?: () => void }) {
  const { switchRole, user } = useAuth();
  const t = useTranslations("roleSwitcher");
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);

  const roles = user?.roles || [];
  const activeRole = user?.activeRole;

  if (roles.length <= 1) return null;

  const otherRoles = roles.filter((r) => r !== activeRole);

  const handleSwitch = async (role: string) => {
    setSwitchingRole(role);
    try {
      await switchRole(role);
      onSwitch?.();
    } finally {
      setSwitchingRole(null);
    }
  };

  const getRoleLabel = (role: string) => {
    const key = role.toLowerCase();
    try {
      return t(`roles.${key}`);
    } catch {
      return role.charAt(0) + role.slice(1).toLowerCase();
    }
  };

  return (
    <>
      <div className="border-t border-[var(--outline-subtle)] my-2" />
      <div className="py-2">
        <p className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] uppercase flex items-center gap-1.5">
          <ArrowLeftRight className="w-3.5 h-3.5" />
          {t("switchDashboard")}
        </p>
        <div className="space-y-1">
          {otherRoles.map((role) => {
            const Icon = ROLE_ICONS[role] || Shield;
            const isSwitching = switchingRole === role;

            return (
              <button
                key={role}
                onClick={() => handleSwitch(role)}
                disabled={isSwitching}
                className="flex items-center justify-start gap-3 px-3 py-2.5 w-full text-start text-[#002D87] bg-[#F0F7FF] hover:bg-[#E0EFFF] rounded-lg transition-colors disabled:opacity-50"
              >
                {isSwitching ? (
                  <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{getRoleLabel(role)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
