"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Upload, Loader2, User as UserIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { profileApi } from "@/lib/api";
import { useAuth, useUser } from "@/contexts";
import { usePlatformGeneral } from "@/contexts/PlatformGeneralContext";
import Select from "../Select";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";

interface GeneralSettings extends Record<string, unknown> {
  platformName: string;
  platformNameAr: string;
  contactEmail: string;
  supportPhone: string;
  timezone: string;
  whatsappNumber: string;
  whatsappCompanyName: string;
  whatsappGreeting: string;
  whatsappReplyTime: string;
}

const FALLBACK: GeneralSettings = {
  platformName: "",
  platformNameAr: "",
  contactEmail: "",
  supportPhone: "",
  timezone: "Asia/Riyadh",
  whatsappNumber: "",
  whatsappCompanyName: "",
  whatsappGreeting: "",
  whatsappReplyTime: "",
};

export default function GeneralTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const user = useUser();
  const { refreshUser } = useAuth();
  const platformGeneral = usePlatformGeneral();
  const { draft, setDraft, dirty, loading, saving, save, loadError } =
    useSettingsCategory<GeneralSettings>("general", FALLBACK, {
      saved: t("toasts.saved"),
      saveFailed: t("toasts.saveFailed"),
      loadFailed: t("toasts.loadFailed"),
    });

  // Admin avatar — managed via profileApi, persisted on the user record.
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const adminName =
    user?.firstName || user?.lastName
      ? `${user?.firstName || ""} ${user?.lastName || ""}`.trim()
      : user?.email || "";

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("general.avatarTooLarge"));
      return;
    }
    setUploadingAvatar(true);
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success(t("general.avatarUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("general.avatarUploadFailed"));
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setRemovingAvatar(true);
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success(t("general.avatarRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("general.avatarRemoveFailed"));
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSave = async () => {
    await save();
    await platformGeneral.refresh();
  };

  return (
    <TabShell
      title={t("general.title")}
      description={t("general.subtitle")}
      loading={loading}
      saving={saving}
      dirty={dirty}
      loadError={loadError}
      onSave={handleSave}
    >
      {/* My Avatar — admin-personal, not a platform-wide setting */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {t("general.myAvatar")}
        </label>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("general.myAvatarHelp")}
        </p>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-page)] flex items-center justify-center">
            {user?.avatar ? (
              <Image
                src={user.avatar}
                alt={adminName}
                width={96}
                height={96}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <UserIcon className="w-10 h-10 text-[var(--color-text-secondary)]" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar || removingAvatar}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {user?.avatar ? t("general.changeAvatar") : t("general.uploadAvatar")}
            </button>
            {user?.avatar && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                disabled={uploadingAvatar || removingAvatar}
                className="inline-flex items-center gap-1.5 text-xs text-[#DC2626] hover:underline self-start disabled:opacity-50"
              >
                {removingAvatar ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                {t("general.removeAvatar")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Platform name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("general.platformName")} (EN)
          </label>
          <input
            type="text"
            value={draft.platformName}
            onChange={(e) =>
              setDraft((d) => ({ ...d, platformName: e.target.value }))
            }
            placeholder="PhysioGuidance"
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("general.platformName")} (AR)
          </label>
          <input
            type="text"
            value={draft.platformNameAr}
            onChange={(e) =>
              setDraft((d) => ({ ...d, platformNameAr: e.target.value }))
            }
            placeholder="فيزيو جايدنس"
            dir="rtl"
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] -mt-2">
        {t("general.platformNameHelp")}
      </p>

      {/* Contact email + phone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("general.contactEmail")}
          </label>
          <input
            type="email"
            value={draft.contactEmail}
            onChange={(e) =>
              setDraft((d) => ({ ...d, contactEmail: e.target.value }))
            }
            placeholder="support@physioguidance.org"
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {t("general.contactEmailHelp")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
            {t("general.supportPhone")}
          </label>
          <input
            type="tel"
            value={draft.supportPhone}
            onChange={(e) =>
              setDraft((d) => ({ ...d, supportPhone: e.target.value }))
            }
            placeholder="0555614285"
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {t("general.supportPhoneHelp")}
          </p>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {t("general.timezone")}
        </label>
        <Select
          value={draft.timezone}
          onChange={(v) => setDraft((d) => ({ ...d, timezone: v }))}
          options={[
            { value: "Asia/Riyadh", label: "Asia/Riyadh (UTC+3)" },
            { value: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
            { value: "Asia/Kuwait", label: "Asia/Kuwait (UTC+3)" },
            { value: "Asia/Bahrain", label: "Asia/Bahrain (UTC+3)" },
            { value: "UTC", label: "UTC" },
          ]}
        />
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          {t("general.timezoneHelp")}
        </p>
      </div>

      {/* WhatsApp widget — controls the floating chat bubble on the marketing site */}
      <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("general.whatsappTitle")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {t("general.whatsappSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              {t("general.whatsappNumber")}
            </label>
            <input
              type="tel"
              value={draft.whatsappNumber}
              onChange={(e) =>
                setDraft((d) => ({ ...d, whatsappNumber: e.target.value }))
              }
              placeholder="+966555614285"
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              {t("general.whatsappCompanyName")}
            </label>
            <input
              type="text"
              value={draft.whatsappCompanyName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, whatsappCompanyName: e.target.value }))
              }
              placeholder="PhysioGuidance"
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              {t("general.whatsappGreeting")}
            </label>
            <input
              type="text"
              value={draft.whatsappGreeting}
              onChange={(e) =>
                setDraft((d) => ({ ...d, whatsappGreeting: e.target.value }))
              }
              placeholder={t("general.whatsappGreetingPlaceholder")}
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              {t("general.whatsappReplyTime")}
            </label>
            <input
              type="text"
              value={draft.whatsappReplyTime}
              onChange={(e) =>
                setDraft((d) => ({ ...d, whatsappReplyTime: e.target.value }))
              }
              placeholder={t("general.whatsappReplyTimePlaceholder")}
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("general.whatsappHelp")}
        </p>
      </div>
    </TabShell>
  );
}
