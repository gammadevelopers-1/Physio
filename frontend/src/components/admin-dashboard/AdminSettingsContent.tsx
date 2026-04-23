"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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
  HardDrive,
  FileText,
  AlertTriangle,
  Save,
  Eye,
  EyeOff,
  Shield,
  Smartphone,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";

const settingsTabs = [
  { id: "general", label: "General", icon: Settings },
  { id: "localization", label: "Localization", icon: Globe },
  { id: "authentication", label: "Authentication", icon: Lock },
  { id: "my-security", label: "My Security", icon: Smartphone },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "backup", label: "Backup", icon: HardDrive },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "maintenance", label: "Maintenance", icon: AlertTriangle },
];

const AdminSettingsContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState("general");
  const [showApiKey, setShowApiKey] = useState(false);

  // General Settings
  const [platformName, setPlatformName] = useState("PhysioGuidance");
  const [contactEmail, setContactEmail] = useState("support@physio.edu.sa");
  const [timezone, setTimezone] = useState("Asia/Riyadh");

  // Authentication Settings
  const [require2FA, setRequire2FA] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [passwordMinLength, setPasswordMinLength] = useState("8");

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  // Maintenance Mode
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  // Personal Security (2FA + Trusted Devices)
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

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
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

              {/* Settings Card with Horizontal Tabs */}
              <div className="bg-white rounded-xl border border-[var(--color-border)]">
                {/* Horizontal Tabs - Compact & Wrapped */}
                <div className="flex flex-wrap border-b border-[var(--color-border)]">
                  {settingsTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3 py-2.5 text-xs sm:text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1 ${
                          activeTab === tab.id
                            ? "text-[var(--color-primary)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {t(`settingsPage.tabs.${tab.id}`)}
                        {activeTab === tab.id && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Settings Content */}
                <div className="p-6">
                    {activeTab === "general" && (
                      <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("settingsPage.general.title")}
                        </h2>

                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            {t("settingsPage.general.platformName")}
                          </label>
                          <input
                            type="text"
                            value={platformName}
                            onChange={(e) => setPlatformName(e.target.value)}
                            className="w-full h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            {t("settingsPage.general.contactEmail")}
                          </label>
                          <input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="w-full h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            {t("settingsPage.general.timezone")}
                          </label>
                          <select
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="w-full h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          >
                            <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                            <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                            <option value="UTC">UTC</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            {t("settingsPage.general.logo")}
                          </label>
                          <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-[#F9FAFB] rounded-lg flex items-center justify-center border border-[var(--color-border)]">
                              <Settings className="w-8 h-8 text-[var(--color-text-secondary)]" />
                            </div>
                            <button className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[#F9FAFB]">
                              {t("settingsPage.general.uploadLogo")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === "authentication" && (
                      <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("settingsPage.auth.title")}
                        </h2>

                        <div className="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {t("settingsPage.auth.require2FA")}
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("settingsPage.auth.require2FADesc")}
                            </p>
                          </div>
                          <button
                            onClick={() => setRequire2FA(!require2FA)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${require2FA ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${require2FA ? "ms-auto" : ""}`} />
                          </button>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            {t("settingsPage.auth.sessionTimeout")}
                          </label>
                          <select
                            value={sessionTimeout}
                            onChange={(e) => setSessionTimeout(e.target.value)}
                            className="w-full h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          >
                            <option value="15">15 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="60">1 hour</option>
                            <option value="120">2 hours</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            {t("settingsPage.auth.passwordMinLength")}
                          </label>
                          <select
                            value={passwordMinLength}
                            onChange={(e) => setPasswordMinLength(e.target.value)}
                            className="w-full h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                          >
                            <option value="6">6 characters</option>
                            <option value="8">8 characters</option>
                            <option value="10">10 characters</option>
                            <option value="12">12 characters</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {activeTab === "notifications" && (
                      <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("settingsPage.notifications.title")}
                        </h2>

                        <div className="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {t("settingsPage.notifications.email")}
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("settingsPage.notifications.emailDesc")}
                            </p>
                          </div>
                          <button
                            onClick={() => setEmailNotifications(!emailNotifications)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${emailNotifications ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${emailNotifications ? "ms-auto" : ""}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {t("settingsPage.notifications.sms")}
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("settingsPage.notifications.smsDesc")}
                            </p>
                          </div>
                          <button
                            onClick={() => setSmsNotifications(!smsNotifications)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${smsNotifications ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"}`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${smsNotifications ? "ms-auto" : ""}`} />
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "my-security" && (
                      <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {locale === "ar" ? "الأمان الشخصي" : "My Security"}
                        </h2>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {locale === "ar" ? "إدارة المصادقة الثنائية والأجهزة الموثوقة لحسابك." : "Manage your personal two-factor authentication and trusted devices."}
                        </p>

                        {/* 2FA Toggle */}
                        <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[var(--color-border)]">
                          <TwoFactorToggle
                            enabled={twoFactorEnabled}
                            toggling={toggling}
                            onToggle={handleToggle2FA}
                          />
                        </div>

                        {/* Trusted Devices */}
                        <div className="bg-[#F9FAFB] rounded-lg p-5 border border-[var(--color-border)]">
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
                        </div>
                      </div>
                    )}

                    {activeTab === "maintenance" && (
                      <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("settingsPage.maintenance.title")}
                        </h2>

                        <div className={`flex items-center justify-between py-4 px-4 rounded-lg border ${maintenanceMode ? "bg-[#FEE2E2] border-[#FCA5A5]" : "bg-[#F9FAFB] border-[var(--color-border)]"}`}>
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                              {t("settingsPage.maintenance.mode")}
                            </p>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("settingsPage.maintenance.modeDesc")}
                            </p>
                          </div>
                          <button
                            onClick={() => setMaintenanceMode(!maintenanceMode)}
                            className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${maintenanceMode ? "bg-[#DC2626]" : "bg-[var(--color-border)]"}`}
                          >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${maintenanceMode ? "ms-auto" : ""}`} />
                          </button>
                        </div>

                        {maintenanceMode && (
                          <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                              {t("settingsPage.maintenance.message")}
                            </label>
                            <textarea
                              value={maintenanceMessage}
                              onChange={(e) => setMaintenanceMessage(e.target.value)}
                              rows={4}
                              placeholder={t("settingsPage.maintenance.defaultMessage")}
                              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === "integrations" && (
                      <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("settingsPage.integrations.title")}
                        </h2>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#DBEAFE] rounded-lg flex items-center justify-center">
                                <span className="text-sm font-bold text-[#3B82F6]">Z</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("settingsPage.integrations.zoom")}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{t("settingsPage.integrations.connected")}</p>
                              </div>
                            </div>
                            <button className="text-sm text-[#DC2626] hover:underline">
                              {t("settingsPage.integrations.disconnect")}
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                                <span className="text-sm font-bold text-[#16A34A]">T</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("settingsPage.integrations.tapPayments")}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{t("settingsPage.integrations.connected")}</p>
                              </div>
                            </div>
                            <button className="text-sm text-[#DC2626] hover:underline">
                              {t("settingsPage.integrations.disconnect")}
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#F3F4F6] rounded-lg flex items-center justify-center">
                                <span className="text-sm font-bold text-[var(--color-text-secondary)]">U</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("settingsPage.integrations.unifonicSms")}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{t("settingsPage.integrations.notConnected")}</p>
                              </div>
                            </div>
                            <button className="text-sm text-[#0066FF] hover:underline">
                              {t("settingsPage.integrations.connect")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Save Button */}
                  <div className="mt-8 pt-6 border-t border-[var(--color-border)] flex justify-end">
                    <button className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg transition-colors">
                      <Save className="w-5 h-5" />
                      <span className="text-sm font-medium">{t("settingsPage.saveChanges")}</span>
                    </button>
                  </div>
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
