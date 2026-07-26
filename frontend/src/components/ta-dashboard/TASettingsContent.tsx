"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { User as UserIcon, Shield, Bell } from "lucide-react";
import TANavbar from "./TANavbar";
import TASidebar from "./TASidebar";
import { useUser } from "@/contexts/AuthContext";
import {
  ProfileSection,
  SecuritySection,
  PreferencesInline,
  MasterNotificationToggles,
} from "@/components/settings";

type TabKey = "profile" | "security" | "notifications";

/**
 * TA settings — same 3-tab shape as student / instructor / manager.
 * Profile tab hosts the shared ProfileSection (name pair, phone, avatar
 * uploader, email locked) + TA-specific bio + PreferencesInline (language
 * + calendar format). Security uses shared SecuritySection (password,
 * 2FA, trusted devices). Notifications is the 2-master-toggle panel.
 * Preferences no longer has its own tab — its fields are folded into
 * Profile via PreferencesInline, matching the rest of the platform.
 */
const TASettingsContent = () => {
  const t = useTranslations("taDashboard");
  const tCommon = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const user = useUser();

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // TA-only profile extra: short biography. Flows through the shared
  // ProfileSection's extraSavePayload so it saves with the same Save button.
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) return;
    const u = user as unknown as Record<string, string | null | undefined>;
    setBio(u.bio || "");
  }, [user]);

  const tabs: { id: TabKey; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: tCommon("tabProfile"), icon: UserIcon },
    { id: "security", label: tCommon("tabSecurity"), icon: Shield },
    { id: "notifications", label: tCommon("tabNotifications"), icon: Bell },
  ];

  const inputClass =
    "w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]";
  const labelClass =
    "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5";

  const taExtraFields = (
    <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
      <div>
        <label htmlFor="ta-bio" className={labelClass}>
          {t("settings.bio")}
        </label>
        <textarea
          id="ta-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={1000}
          className={`${inputClass} resize-none`}
        />
      </div>
    </div>
  );

  const extraSavePayload = { bio };

  return (
    <div className="min-h-screen bg-[var(--color-surface-page)]">
      <TANavbar />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <TASidebar />
          </div>

          <div className="flex-1 min-w-0 space-y-6">
            <div>
              <h1 className={`text-xl md:text-2xl font-bold text-[var(--color-text-primary)] ${isRTL ? "text-right" : ""}`}>
                {t("settings.title")}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                {t("settings.subtitle")}
              </p>
            </div>

            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
              <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? "text-[var(--color-primary)]"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5 md:p-6">
                {activeTab === "profile" && (
                  <ProfileSection
                    idPrefix="ta"
                    showArabicNames
                    showPhone
                    extraFields={
                      <>
                        {taExtraFields}
                        <PreferencesInline />
                      </>
                    }
                    extraSavePayload={extraSavePayload}
                  />
                )}
                {activeTab === "security" && <SecuritySection idPrefix="ta" />}
                {activeTab === "notifications" && <MasterNotificationToggles />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TASettingsContent;
