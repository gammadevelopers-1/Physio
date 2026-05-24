"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Shield,
  ShieldCheck,
  Smartphone,
  Clock,
  Settings as SettingsIcon,
} from "lucide-react";
import { toast } from "sonner";
import { profileApi, ApiError } from "@/lib/api";
import { useUser } from "@/contexts";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import PreferencesInline from "@/components/settings/PreferencesInline";
import PasswordPolicyHint from "@/components/shared/PasswordPolicyHint";
import { usePasswordPolicy, checkPasswordAgainstPolicy } from "@/hooks/usePasswordPolicy";
import { FmtDate } from "@/components/ui/Fmt";
import { TabShell } from "./TabShell";

/**
 * "My Security" — admin-personal settings tab. Top strip surfaces
 * the three signals an admin glances at first (2FA status, trusted
 * device count, last sign-in). Cards below let them act.
 */
export default function MySecurityTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const user = useUser();

  const { policy } = usePasswordPolicy();
  const {
    twoFactorEnabled,
    devices,
    loading: securityLoading,
    toggling,
    revokingId,
    revokingAll,
    showRevokeAllConfirm,
    setShowRevokeAllConfirm,
    handleToggle2FA,
    handleRevokeDevice,
    handleRevokeAll,
    handleLogout,
  } = useSecuritySettings();

  // Change password — inline form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("mySecurity.passwordMismatch"));
      return;
    }
    const policyErrors = checkPasswordAgainstPolicy(newPassword, policy);
    if (policyErrors.length) {
      toast.error(policyErrors[0]);
      return;
    }
    setChanging(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success(t("mySecurity.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t("mySecurity.passwordChangeFailed"));
      }
    } finally {
      setChanging(false);
    }
  };

  return (
    <TabShell
      title={t("mySecurity.title")}
      description={t("mySecurity.subtitle")}
      loading={securityLoading}
      saving={false}
      dirty={false}
      onSave={() => {}}
      noSaveBar
    >
      {/* ── Security Overview Strip ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 2FA status tile */}
        <div
          className={`rounded-xl p-4 border ${
            twoFactorEnabled
              ? "bg-gradient-to-br from-green-50 to-emerald-50/50 border-green-200"
              : "bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                  twoFactorEnabled ? "text-green-700" : "text-amber-700"
                }`}
              >
                {t("mySecurity.overview.twoFactorLabel")}
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {twoFactorEnabled
                  ? t("mySecurity.overview.enabled")
                  : t("mySecurity.overview.notEnabled")}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {twoFactorEnabled
                  ? t("mySecurity.overview.twoFactorOnHint")
                  : t("mySecurity.overview.twoFactorOffHint")}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                twoFactorEnabled
                  ? "bg-green-100 text-green-600"
                  : "bg-amber-100 text-amber-600"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Trusted devices tile */}
        <div className="rounded-xl p-4 border bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-blue-700">
                {t("mySecurity.overview.devicesLabel")}
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {devices.length}{" "}
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {devices.length === 1
                    ? t("mySecurity.overview.deviceSingular")
                    : t("mySecurity.overview.devicePlural")}
                </span>
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t("mySecurity.overview.devicesHint")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Last sign-in tile */}
        <div className="rounded-xl p-4 border bg-gradient-to-br from-slate-50 to-gray-50/50 border-[var(--color-border)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-[var(--color-text-secondary)]">
                {t("mySecurity.overview.lastSignInLabel")}
              </p>
              <p className="text-base font-bold text-[var(--color-text-primary)] truncate">
                {user?.lastLoginAt ? (
                  <FmtDate
                    value={user.lastLoginAt}
                    variant="readable"
                    includeTime
                  />
                ) : (
                  t("mySecurity.overview.never")
                )}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                {user?.lastLoginIp ?? t("mySecurity.overview.ipUnknown")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Change Password Card ────────────────────────────────── */}
      <SecurityCard
        icon={<KeyRound className="w-5 h-5" />}
        title={t("mySecurity.changePassword")}
        subtitle={t("mySecurity.changePasswordHint")}
        accent="primary"
      >
        <div className="space-y-4 max-w-2xl">
          {/* Current password — full width */}
          <PasswordInput
            label={t("mySecurity.currentPassword")}
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />

          {/* New + Confirm — side-by-side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <PasswordInput
                label={t("mySecurity.newPassword")}
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggleShow={() => setShowNew((v) => !v)}
                autoComplete="new-password"
              />
              <PasswordPolicyHint password={newPassword} />
            </div>
            <PasswordInput
              label={t("mySecurity.confirmPassword")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
            />
          </div>

          <button
            type="button"
            onClick={handleChangePassword}
            disabled={
              changing ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {changing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {t("mySecurity.updatePassword")}
          </button>
        </div>
      </SecurityCard>

      {/* ── 2FA Card ─────────────────────────────────────────────── */}
      <SecurityCard
        icon={<ShieldCheck className="w-5 h-5" />}
        title={t("mySecurity.twoFactorCardTitle")}
        subtitle={t("mySecurity.twoFactorCardHint")}
        accent={twoFactorEnabled ? "success" : "warning"}
        statusBadge={
          twoFactorEnabled
            ? { label: t("mySecurity.overview.enabled"), tone: "success" }
            : { label: t("mySecurity.overview.notEnabled"), tone: "warning" }
        }
      >
        <TwoFactorToggle
          enabled={twoFactorEnabled}
          toggling={toggling}
          onToggle={handleToggle2FA}
        />
      </SecurityCard>

      {/* ── Trusted Devices Card ─────────────────────────────────── */}
      <SecurityCard
        icon={<Smartphone className="w-5 h-5" />}
        title={t("mySecurity.devicesCardTitle")}
        subtitle={t("mySecurity.devicesCardHint")}
        accent="info"
      >
        <TrustedDevicesSection
          devices={devices}
          revokingId={revokingId}
          revokingAll={revokingAll}
          showRevokeAllConfirm={showRevokeAllConfirm}
          onRevokeDevice={handleRevokeDevice}
          onRevokeAll={handleRevokeAll}
          onShowRevokeAllConfirm={setShowRevokeAllConfirm}
          onLogout={handleLogout}
        />
      </SecurityCard>

      {/* ── My Preferences Card ─────────────────────────────────── */}
      <SecurityCard
        icon={<SettingsIcon className="w-5 h-5" />}
        title={t("mySecurity.preferencesCardTitle")}
        subtitle={t("mySecurity.preferencesCardHint")}
        accent="neutral"
      >
        <PreferencesInline />
      </SecurityCard>
    </TabShell>
  );
}

// ─── Reusable card with icon header + accent stripe ─────────────

type CardAccent = "primary" | "success" | "warning" | "info" | "neutral";

const ACCENT_RING: Record<CardAccent, string> = {
  primary: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-slate-100 text-slate-700",
};

interface SecurityCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent: CardAccent;
  statusBadge?: { label: string; tone: "success" | "warning" };
  children: React.ReactNode;
}

function SecurityCard({
  icon,
  title,
  subtitle,
  accent,
  statusBadge,
  children,
}: SecurityCardProps) {
  return (
    <section className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <header className="flex items-start gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${ACCENT_RING[accent]}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {title}
            </h3>
            {statusBadge && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  statusBadge.tone === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {statusBadge.label}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ─── Reusable labeled password input ────────────────────────────

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: PasswordInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 pe-10 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
