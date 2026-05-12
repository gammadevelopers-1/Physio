"use client";

import { ReactNode, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail, Phone, Loader2, Save } from "lucide-react";
import { profileApi } from "@/lib/api";
import { useAuth, useUser } from "@/contexts/AuthContext";
import AvatarUploader from "./AvatarUploader";

export interface ProfileSectionExtraField {
  /** Form-state key under `profileApi.update()` payload */
  key: string;
  /** Current value */
  value: string;
  /** Setter */
  onChange: (v: string) => void;
}

interface ProfileSectionProps {
  /** Show first/last name in Arabic alongside English. Default: true. */
  showArabicNames?: boolean;
  /** Show phone field. Default: true. */
  showPhone?: boolean;
  /** ID prefix for input ids (e.g. "student", "instructor"). */
  idPrefix?: string;
  /**
   * Slot for role-specific fields rendered after the standard grid.
   * Must include their own labels + inputs. Values rendered here are NOT
   * automatically saved — pass them via `extraFieldsData` for save handling.
   */
  extraFields?: ReactNode;
  /**
   * Additional payload merged into the profileApi.update() call when Save is clicked.
   * Use for role-specific fields (SCFHS, national ID, gender, etc.).
   */
  extraSavePayload?: Record<string, unknown>;
}

export default function ProfileSection({
  showArabicNames = true,
  showPhone = true,
  idPrefix = "settings",
  extraFields,
  extraSavePayload,
}: ProfileSectionProps) {
  const t = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const user = useUser();
  const { refreshUser } = useAuth();

  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    firstNameAr: "",
    lastNameAr: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      firstNameAr: user.firstNameAr || "",
      lastNameAr: user.lastNameAr || "",
      email: user.email || "",
      phone: user.phone || "",
    });
  }, [user]);

  const displayName = (
    isRTL && (data.firstNameAr || data.lastNameAr)
      ? `${data.firstNameAr} ${data.lastNameAr}`
      : `${data.firstName} ${data.lastName}`
  ).trim();

  const handleSave = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        firstName: data.firstName,
        lastName: data.lastName,
        ...(showArabicNames && {
          firstNameAr: data.firstNameAr,
          lastNameAr: data.lastNameAr,
        }),
        ...(showPhone && { phone: data.phone }),
        ...extraSavePayload,
      });
      await refreshUser();
      toast.success(t("profileSaved"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("profileError");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <AvatarUploader
        avatarUrl={user?.avatar}
        displayName={displayName || data.email}
        secondaryLine={data.email}
      />

      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
          {t("personalInfo")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            id={`${idPrefix}-first-name`}
            label={t("firstName")}
            value={data.firstName}
            onChange={(v) => setData({ ...data, firstName: v })}
          />
          <Field
            id={`${idPrefix}-last-name`}
            label={t("lastName")}
            value={data.lastName}
            onChange={(v) => setData({ ...data, lastName: v })}
          />
          {showArabicNames && (
            <>
              <Field
                id={`${idPrefix}-first-name-ar`}
                label={t("firstNameAr")}
                value={data.firstNameAr}
                onChange={(v) => setData({ ...data, firstNameAr: v })}
                dir="rtl"
              />
              <Field
                id={`${idPrefix}-last-name-ar`}
                label={t("lastNameAr")}
                value={data.lastNameAr}
                onChange={(v) => setData({ ...data, lastNameAr: v })}
                dir="rtl"
              />
            </>
          )}

          {/* Email — always disabled */}
          <Field
            id={`${idPrefix}-email`}
            label={t("email")}
            value={data.email}
            onChange={() => {}}
            disabled
            icon={<Mail className="w-4 h-4 text-[var(--color-text-secondary)]" />}
            isRTL={isRTL}
          />

          {showPhone && (
            <Field
              id={`${idPrefix}-phone`}
              label={t("phone")}
              type="tel"
              value={data.phone}
              onChange={(v) => setData({ ...data, phone: v })}
              icon={<Phone className="w-4 h-4 text-[var(--color-text-secondary)]" />}
              isRTL={isRTL}
            />
          )}
        </div>
      </div>

      {extraFields}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  dir,
  disabled,
  icon,
  isRTL,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  dir?: "rtl" | "ltr";
  disabled?: boolean;
  icon?: ReactNode;
  isRTL?: boolean;
}) {
  const hasIcon = !!icon;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
      </label>
      <div className="relative">
        {hasIcon && (
          <span className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-3" : "left-3"}`}>
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          dir={dir}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] ${
            disabled
              ? "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] cursor-not-allowed"
              : ""
          } ${hasIcon ? (isRTL ? "pr-10 pl-3" : "pl-10 pr-3") : "px-3"}`}
        />
      </div>
    </div>
  );
}
