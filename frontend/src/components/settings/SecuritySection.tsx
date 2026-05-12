"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Key, Eye, EyeOff, Loader2 } from "lucide-react";
import { profileApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";

interface SecuritySectionProps {
  /** ID prefix for input ids (avoids collisions when multiple settings sections are rendered) */
  idPrefix?: string;
}

export default function SecuritySection({ idPrefix = "settings" }: SecuritySectionProps) {
  const t = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { logout } = useAuth();
  const security = useSecuritySettings();

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error(t("passwordRequired"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("passwordMinLength"));
      return;
    }
    setChanging(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success(t("passwordChanged"));
      // Backend revokes refresh tokens + trusted devices on password change.
      // Force a clean logout so the user re-authenticates with the new password.
      await logout();
      window.location.href = `/${locale}/signin`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("passwordError");
      toast.error(msg);
      setChanging(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Change Password */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          {t("changePassword")}
        </h4>
        <div className="space-y-4 max-w-md">
          <PasswordField
            id={`${idPrefix}-current-password`}
            label={t("currentPassword")}
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            isRTL={isRTL}
          />
          <PasswordField
            id={`${idPrefix}-new-password`}
            label={t("newPassword")}
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            isRTL={isRTL}
          />
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={changing || !currentPassword || !newPassword}
            className="px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {changing && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("updatePassword")}
          </button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <TwoFactorToggle
        enabled={security.twoFactorEnabled}
        toggling={security.toggling}
        onToggle={security.handleToggle2FA}
      />

      {/* Trusted Devices */}
      {security.loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : (
        <TrustedDevicesSection
          devices={security.devices}
          revokingId={security.revokingId}
          revokingAll={security.revokingAll}
          showRevokeAllConfirm={security.showRevokeAllConfirm}
          onRevokeDevice={security.handleRevokeDevice}
          onRevokeAll={security.handleRevokeAll}
          onShowRevokeAllConfirm={security.setShowRevokeAllConfirm}
        />
      )}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  isRTL,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  isRTL: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Key
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
        />
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder="••••••••"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] ${
            isRTL ? "pr-10 pl-10" : "pl-10 pr-10"
          }`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className={`absolute top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] ${isRTL ? "left-3" : "right-3"}`}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
