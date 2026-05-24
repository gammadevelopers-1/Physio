"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  Settings,
  Globe,
  Lock,
  Bell,
  CreditCard,
  Link2,
  AlertTriangle,
  Smartphone,
  LayoutDashboard,
  ShieldCheck,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";

// Tab content components live in `settings/` — each one fetches its
// own category, tracks its own dirty state, and renders its own Save
// button via the shared TabShell.
import GeneralTab from "./settings/GeneralTab";
import LocalizationTab from "./settings/LocalizationTab";
import AuthTab from "./settings/AuthTab";
import MySecurityTab from "./settings/MySecurityTab";
import NotificationsTab from "./settings/NotificationsTab";
import PaymentsTab from "./settings/PaymentsTab";
import IntegrationsTab from "./settings/IntegrationsTab";
import MaintenanceTab from "./settings/MaintenanceTab";

type SubTabId =
  | "general"
  | "localization"
  | "authentication"
  | "my-security"
  | "notifications"
  | "payments"
  | "integrations"
  | "maintenance";

type MainTabId = "platform" | "security" | "communications" | "system";

interface SubTab {
  id: SubTabId;
  icon: React.ElementType;
}

interface MainTab {
  id: MainTabId;
  icon: React.ElementType;
  subTabs: SubTab[];
}

const mainTabs: MainTab[] = [
  {
    id: "platform",
    icon: LayoutDashboard,
    subTabs: [
      { id: "general", icon: Settings },
      { id: "localization", icon: Globe },
    ],
  },
  {
    id: "security",
    icon: ShieldCheck,
    subTabs: [
      { id: "authentication", icon: Lock },
      { id: "my-security", icon: Smartphone },
    ],
  },
  {
    id: "communications",
    icon: MessageSquare,
    subTabs: [{ id: "notifications", icon: Bell }],
  },
  {
    id: "system",
    icon: Wrench,
    subTabs: [
      { id: "payments", icon: CreditCard },
      { id: "integrations", icon: Link2 },
      { id: "maintenance", icon: AlertTriangle },
    ],
  },
];

const AdminSettingsContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();

  const [activeMain, setActiveMain] = useState<MainTabId>("platform");
  const [activeSub, setActiveSub] = useState<SubTabId>("general");

  const currentMain = useMemo(
    () => mainTabs.find((m) => m.id === activeMain) ?? mainTabs[0],
    [activeMain],
  );

  const handleMainSelect = (mainId: MainTabId) => {
    setActiveMain(mainId);
    const target = mainTabs.find((m) => m.id === mainId);
    if (target && !target.subTabs.some((s) => s.id === activeSub)) {
      setActiveSub(target.subTabs[0].id);
    }
  };

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("settingsPage.subtitle")}
                </p>
              </div>

              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                {/* Main tab nav */}
                <div className="flex flex-wrap border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                  {mainTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeMain === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleMainSelect(tab.id)}
                        className={`px-4 sm:px-5 py-3 text-sm font-semibold relative transition-colors whitespace-nowrap flex items-center gap-2 ${
                          isActive
                            ? "text-[var(--color-primary)] bg-[var(--color-surface-card)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {t(`settingsPage.mainTabs.${tab.id}`)}
                        {isActive && (
                          <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub tab nav (only shown when main has >1 subtab) */}
                {currentMain.subTabs.length > 1 && (
                  <div className="flex flex-wrap gap-1 px-3 sm:px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-card)]">
                    {currentMain.subTabs.map((sub) => {
                      const Icon = sub.icon;
                      const isActive = activeSub === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setActiveSub(sub.id)}
                          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                            isActive
                              ? "bg-[var(--color-primary)] text-white"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {t(`settingsPage.tabs.${sub.id}`)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Active tab body */}
                <div className="p-6">
                  {activeSub === "general" && <GeneralTab />}
                  {activeSub === "localization" && <LocalizationTab />}
                  {activeSub === "authentication" && <AuthTab />}
                  {activeSub === "my-security" && <MySecurityTab />}
                  {activeSub === "notifications" && <NotificationsTab />}
                  {activeSub === "payments" && <PaymentsTab />}
                  {activeSub === "integrations" && <IntegrationsTab />}
                  {activeSub === "maintenance" && <MaintenanceTab />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSettingsContent;
