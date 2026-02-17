"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { toast } from "sonner";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useAuth, useUser } from "@/contexts/AuthContext";
import { profileApi } from "@/lib/api";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import {
  User as UserIcon,
  Shield,
  Bell,
  Settings,
  Plug,
  Camera,
  Mail,
  Phone,
  MapPin,
  Globe,
  Key,
  Eye,
  EyeOff,
  Check,
  Video,
  Calendar,
  Cloud,
  Save,
  Loader2,
} from "lucide-react";

const SettingsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const manager = useManagerProfile();
  const { refreshUser } = useAuth();
  const user = useUser();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "notifications" | "preferences" | "integrations"
  >("profile");

  // Profile State — initialized from authenticated user
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    language: "en",
    bio: "",
  });
  const [saving, setSaving] = useState(false);

  // Sync user data into form when available
  useEffect(() => {
    if (user) {
      setProfileData((prev) => ({
        ...prev,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email,
        phone: user.phone || "",
      }));
    }
  }, [user]);

  // Compute initials from user name
  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || user.email[0].toUpperCase()
    : "";

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success(t("settingsPage.profileUpdated"));
    } catch {
      toast.error(t("settingsPage.profileError"));
    }
    e.target.value = "";
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
      });
      await refreshUser();
      toast.success(t("settingsPage.profileUpdated"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Security State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const security = useSecuritySettings();

  // Notification State (client-side only)
  const [notifications, setNotifications] = useState({
    emailNewCourse: true,
    emailContentReview: true,
    emailInstructorAssignment: false,
    emailComplianceAlert: true,
    pushNewSubmission: true,
    pushApprovalRequired: true,
    pushSystemUpdates: false,
    digestWeekly: true,
    digestMonthly: false,
  });

  // Preferences State (client-side only)
  const [preferences, setPreferences] = useState({
    theme: "light",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    timezone: "Asia/Riyadh",
    defaultView: "dashboard",
    compactMode: false,
    showTips: true,
  });

  // Integrations State (client-side only)
  const [integrations, setIntegrations] = useState({
    zoom: { connected: false, email: "" },
    googleCalendar: { connected: false, email: "" },
    microsoftTeams: { connected: false, email: "" },
    slack: { connected: false, email: "" },
    googleDrive: { connected: false, email: "" },
    dropbox: { connected: false, email: "" },
  });

  const tabs = [
    { id: "profile" as const, label: t("settingsPage.tabs.profile"), icon: UserIcon },
    { id: "security" as const, label: t("settingsPage.tabs.security"), icon: Shield },
    { id: "notifications" as const, label: t("settingsPage.tabs.notifications"), icon: Bell },
    { id: "preferences" as const, label: t("settingsPage.tabs.preferences"), icon: Settings },
    { id: "integrations" as const, label: t("settingsPage.tabs.integrations"), icon: Plug },
  ];

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0 space-y-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[#6B7280] mt-1">{t("settingsPage.subtitle")}</p>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-[#E5E7EB]">
                <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === tab.id
                          ? "text-[#3B82F6]"
                          : "text-[#6B7280] hover:text-[#374151]"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-t" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5 md:p-6">
                  {/* Profile Tab */}
                  {activeTab === "profile" && (
                    <div className="space-y-6">
                      {/* Avatar Section */}
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="relative">
                          {user?.avatar ? (
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100">
                              <Image
                                src={user.avatar}
                                alt={profileData.firstName}
                                width={96}
                                height={96}
                                className="object-cover w-full h-full"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-[#E5E7EB] flex items-center justify-center text-2xl font-bold text-[#4B5563]">
                              {initials}
                            </div>
                          )}
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleAvatarUpload}
                          />
                          <button
                            onClick={() => avatarInputRef.current?.click()}
                            className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-8 h-8 bg-[#3B82F6] text-white rounded-full flex items-center justify-center hover:bg-[#2563EB] transition-colors`}
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[#1F2937]">
                            {profileData.firstName} {profileData.lastName}
                          </h3>
                          <p className="text-sm text-[#6B7280]">{profileData.email}</p>
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.profile.personalInfo")}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.firstName")}
                            </label>
                            <input
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, firstName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.lastName")}
                            </label>
                            <input
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, lastName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.email")}
                            </label>
                            <div className="relative">
                              <Mail
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                type="email"
                                value={profileData.email}
                                disabled
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.phone")}
                            </label>
                            <div className="relative">
                              <Phone
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                type="tel"
                                value={profileData.phone}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, phone: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {t("settingsPage.saveChanges")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Security Tab */}
                  {activeTab === "security" && (
                    <div className="space-y-6">
                      {/* Change Password */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.security.changePassword")}
                        </h4>
                        <div className="space-y-4 max-w-md">
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.security.currentPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className={`absolute top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] ${isRTL ? "left-3" : "right-3"}`}
                              >
                                {showCurrentPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.security.newPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                type={showNewPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className={`absolute top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] ${isRTL ? "left-3" : "right-3"}`}
                              >
                                {showNewPassword ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>
                          <button className="px-4 py-2 btn-gold text-white rounded-lg text-sm font-medium transition-colors">
                            {t("settingsPage.security.updatePassword")}
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
                          <Loader2 className="w-6 h-6 animate-spin text-[#a37f49]" />
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
                  )}

                  {/* Notifications Tab */}
                  {activeTab === "notifications" && (
                    <div className="space-y-6">
                      {/* Email Notifications */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.notifications.emailTitle")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: "emailNewCourse", label: t("settingsPage.notifications.newCourse") },
                            { key: "emailContentReview", label: t("settingsPage.notifications.contentReview") },
                            { key: "emailInstructorAssignment", label: t("settingsPage.notifications.instructorAssignment") },
                            { key: "emailComplianceAlert", label: t("settingsPage.notifications.complianceAlert") },
                          ].map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between py-2"
                            >
                              <span className="text-sm text-[#374151]">{item.label}</span>
                              <button
                                onClick={() =>
                                  setNotifications({
                                    ...notifications,
                                    [item.key]: !notifications[item.key as keyof typeof notifications],
                                  })
                                }
                                className={`relative w-10 h-5 rounded-full transition-colors ${
                                  notifications[item.key as keyof typeof notifications]
                                    ? "bg-[#3B82F6]"
                                    : "bg-[#E5E7EB]"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                    notifications[item.key as keyof typeof notifications]
                                      ? isRTL
                                        ? "left-0.5"
                                        : "right-0.5"
                                      : isRTL
                                        ? "right-0.5"
                                        : "left-0.5"
                                  }`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Push Notifications */}
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.notifications.pushTitle")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: "pushNewSubmission", label: t("settingsPage.notifications.newSubmission") },
                            { key: "pushApprovalRequired", label: t("settingsPage.notifications.approvalRequired") },
                            { key: "pushSystemUpdates", label: t("settingsPage.notifications.systemUpdates") },
                          ].map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between py-2"
                            >
                              <span className="text-sm text-[#374151]">{item.label}</span>
                              <button
                                onClick={() =>
                                  setNotifications({
                                    ...notifications,
                                    [item.key]: !notifications[item.key as keyof typeof notifications],
                                  })
                                }
                                className={`relative w-10 h-5 rounded-full transition-colors ${
                                  notifications[item.key as keyof typeof notifications]
                                    ? "bg-[#3B82F6]"
                                    : "bg-[#E5E7EB]"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                    notifications[item.key as keyof typeof notifications]
                                      ? isRTL
                                        ? "left-0.5"
                                        : "right-0.5"
                                      : isRTL
                                        ? "right-0.5"
                                        : "left-0.5"
                                  }`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Digest */}
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.notifications.digestTitle")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: "digestWeekly", label: t("settingsPage.notifications.weeklyDigest") },
                            { key: "digestMonthly", label: t("settingsPage.notifications.monthlyDigest") },
                          ].map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between py-2"
                            >
                              <span className="text-sm text-[#374151]">{item.label}</span>
                              <button
                                onClick={() =>
                                  setNotifications({
                                    ...notifications,
                                    [item.key]: !notifications[item.key as keyof typeof notifications],
                                  })
                                }
                                className={`relative w-10 h-5 rounded-full transition-colors ${
                                  notifications[item.key as keyof typeof notifications]
                                    ? "bg-[#3B82F6]"
                                    : "bg-[#E5E7EB]"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                    notifications[item.key as keyof typeof notifications]
                                      ? isRTL
                                        ? "left-0.5"
                                        : "right-0.5"
                                      : isRTL
                                        ? "right-0.5"
                                        : "left-0.5"
                                  }`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preferences Tab */}
                  {activeTab === "preferences" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.theme")}
                          </label>
                          <select
                            value={preferences.theme}
                            onChange={(e) =>
                              setPreferences({ ...preferences, theme: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          >
                            <option value="light">{t("settingsPage.preferences.themeLight")}</option>
                            <option value="dark">{t("settingsPage.preferences.themeDark")}</option>
                            <option value="system">{t("settingsPage.preferences.themeSystem")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.dateFormat")}
                          </label>
                          <select
                            value={preferences.dateFormat}
                            onChange={(e) =>
                              setPreferences({ ...preferences, dateFormat: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          >
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.timeFormat")}
                          </label>
                          <select
                            value={preferences.timeFormat}
                            onChange={(e) =>
                              setPreferences({ ...preferences, timeFormat: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          >
                            <option value="12h">{t("settingsPage.preferences.time12h")}</option>
                            <option value="24h">{t("settingsPage.preferences.time24h")}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.timezone")}
                          </label>
                          <select
                            value={preferences.timezone}
                            onChange={(e) =>
                              setPreferences({ ...preferences, timezone: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          >
                            <option value="Asia/Riyadh">Arabia Standard Time (AST)</option>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[#E5E7EB] space-y-3">
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <span className="text-sm font-medium text-[#374151]">
                              {t("settingsPage.preferences.compactMode")}
                            </span>
                            <p className="text-xs text-[#6B7280]">
                              {t("settingsPage.preferences.compactModeDesc")}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setPreferences({
                                ...preferences,
                                compactMode: !preferences.compactMode,
                              })
                            }
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              preferences.compactMode ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                preferences.compactMode
                                  ? isRTL
                                    ? "left-0.5"
                                    : "right-0.5"
                                  : isRTL
                                    ? "right-0.5"
                                    : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <span className="text-sm font-medium text-[#374151]">
                              {t("settingsPage.preferences.showTips")}
                            </span>
                            <p className="text-xs text-[#6B7280]">
                              {t("settingsPage.preferences.showTipsDesc")}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setPreferences({
                                ...preferences,
                                showTips: !preferences.showTips,
                              })
                            }
                            className={`relative w-10 h-5 rounded-full transition-colors ${
                              preferences.showTips ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                preferences.showTips
                                  ? isRTL
                                    ? "left-0.5"
                                    : "right-0.5"
                                  : isRTL
                                    ? "right-0.5"
                                    : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors">
                          <Save className="w-4 h-4" />
                          {t("settingsPage.preferences.savePreferences")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Integrations Tab */}
                  {activeTab === "integrations" && (
                    <div className="space-y-6">
                      {/* Video Conferencing */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.integrations.videoConferencing")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            {
                              key: "zoom",
                              name: "Zoom",
                              icon: Video,
                              iconBg: "bg-[#DBEAFE]",
                              iconColor: "text-[#2D8CFF]",
                            },
                            {
                              key: "microsoftTeams",
                              name: "Microsoft Teams",
                              icon: Video,
                              iconBg: "bg-[#E0E7FF]",
                              iconColor: "text-[#6264A7]",
                            },
                          ].map((integration) => (
                            <div
                              key={integration.key}
                              className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-xl"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-lg ${integration.iconBg} flex items-center justify-center`}
                                >
                                  <integration.icon
                                    className={`w-5 h-5 ${integration.iconColor}`}
                                  />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#1F2937]">
                                    {integration.name}
                                  </p>
                                  {integrations[integration.key as keyof typeof integrations]
                                    .connected ? (
                                    <p className="text-xs text-[#22C55E] flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      {t("settingsPage.integrations.connected")} •{" "}
                                      {
                                        integrations[integration.key as keyof typeof integrations]
                                          .email
                                      }
                                    </p>
                                  ) : (
                                    <p className="text-xs text-[#6B7280]">
                                      {t("settingsPage.integrations.notConnected")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  integrations[integration.key as keyof typeof integrations]
                                    .connected
                                    ? "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
                                    : "btn-gold text-white"
                                }`}
                              >
                                {integrations[integration.key as keyof typeof integrations]
                                  .connected
                                  ? t("settingsPage.integrations.disconnect")
                                  : t("settingsPage.integrations.connect")}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Calendar */}
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.integrations.calendar")}
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-[#EA4335]" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#1F2937]">
                                  Google Calendar
                                </p>
                                {integrations.googleCalendar.connected ? (
                                  <p className="text-xs text-[#22C55E] flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {t("settingsPage.integrations.connected")} • {integrations.googleCalendar.email}
                                  </p>
                                ) : (
                                  <p className="text-xs text-[#6B7280]">
                                    {t("settingsPage.integrations.notConnected")}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                integrations.googleCalendar.connected
                                  ? "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
                                  : "btn-gold text-white"
                              }`}
                            >
                              {integrations.googleCalendar.connected
                                ? t("settingsPage.integrations.disconnect")
                                : t("settingsPage.integrations.connect")}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Cloud Storage */}
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.integrations.cloudStorage")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            {
                              key: "googleDrive",
                              name: "Google Drive",
                              icon: Cloud,
                              iconBg: "bg-[#FEF9C3]",
                              iconColor: "text-[#FBBC04]",
                            },
                            {
                              key: "dropbox",
                              name: "Dropbox",
                              icon: Cloud,
                              iconBg: "bg-[#DBEAFE]",
                              iconColor: "text-[#0061FF]",
                            },
                          ].map((integration) => (
                            <div
                              key={integration.key}
                              className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-xl"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-lg ${integration.iconBg} flex items-center justify-center`}
                                >
                                  <integration.icon
                                    className={`w-5 h-5 ${integration.iconColor}`}
                                  />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#1F2937]">
                                    {integration.name}
                                  </p>
                                  {integrations[integration.key as keyof typeof integrations]
                                    .connected ? (
                                    <p className="text-xs text-[#22C55E] flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      {t("settingsPage.integrations.connected")} •{" "}
                                      {
                                        integrations[integration.key as keyof typeof integrations]
                                          .email
                                      }
                                    </p>
                                  ) : (
                                    <p className="text-xs text-[#6B7280]">
                                      {t("settingsPage.integrations.notConnected")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  integrations[integration.key as keyof typeof integrations]
                                    .connected
                                    ? "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"
                                    : "btn-gold text-white"
                                }`}
                              >
                                {integrations[integration.key as keyof typeof integrations]
                                  .connected
                                  ? t("settingsPage.integrations.disconnect")
                                  : t("settingsPage.integrations.connect")}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
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
