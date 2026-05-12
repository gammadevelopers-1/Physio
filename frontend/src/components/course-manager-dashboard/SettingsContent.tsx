"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User as UserIcon, Shield, Bell } from "lucide-react";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import {
  ProfileSection,
  SecuritySection,
  PreferencesInline,
  MasterNotificationToggles,
} from "@/components/settings";

type TabKey = "profile" | "security" | "notifications";

const SettingsContent = () => {
  const t = useTranslations("courseManagerDashboard.settingsPage");
  const tCommon = useTranslations("commonSettings");
  const manager = useManagerProfile();

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // 3 tabs only — Preferences is folded into the Profile tab (matches the
  // student dashboard pattern), and Notifications is a 2-master-toggle
  // panel rather than a per-event grid (matches backend gating reality).
  const tabs: { id: TabKey; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: tCommon("tabProfile"), icon: UserIcon },
    { id: "security", label: tCommon("tabSecurity"), icon: Shield },
    { id: "notifications", label: tCommon("tabNotifications"), icon: Bell },
  ];

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0 space-y-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("subtitle")}</p>
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
                      idPrefix="manager"
                      showArabicNames
                      showPhone
                      extraFields={<PreferencesInline />}
                    />
                  )}
                  {activeTab === "security" && <SecuritySection idPrefix="manager" />}
                  {activeTab === "notifications" && <MasterNotificationToggles />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsContent;
