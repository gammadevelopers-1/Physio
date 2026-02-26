"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { toast } from "sonner";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useAuth, useUser } from "@/contexts/AuthContext";
import { profileApi, preferencesApi } from "@/lib/api";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import {
  User as UserIcon,
  Shield,
  Bell,
  Settings,
  Plug,
  Pencil,
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
  FileText,
  Upload,
  Trash2,
} from "lucide-react";

const SettingsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const manager = useManagerProfile();
  const { refreshUser } = useAuth();
  const user = useUser();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const closeAvatarMenu = useCallback(() => setAvatarMenuOpen(false), []);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        closeAvatarMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarMenuOpen, closeAvatarMenu]);

  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "notifications" | "preferences" | "policies" | "integrations"
  >("profile");

  // Profile State — initialized from authenticated user
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    firstNameAr: "",
    lastNameAr: "",
    email: "",
    phone: "",
    department: "",
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
        firstNameAr: user.firstNameAr || "",
        lastNameAr: user.lastNameAr || "",
        email: user.email,
        phone: user.phone || "",
        department: user.department || "",
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

  const handleRemoveAvatar = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success(t("settingsPage.profileUpdated"));
    } catch {
      toast.error(t("settingsPage.profileError"));
    }
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        firstNameAr: profileData.firstNameAr,
        lastNameAr: profileData.lastNameAr,
        phone: profileData.phone,
        department: profileData.department,
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

  // Notification State — mapped to backend columns
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
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Map CM UI keys ↔ backend columns
  const NOTIF_TO_BACKEND: Record<string, string> = {
    emailNewCourse: "emailNewStudent",
    emailContentReview: "emailCourseComplete",
    emailInstructorAssignment: "emailAssessmentSubmit",
    emailComplianceAlert: "emailCertificateRequest",
    pushNewSubmission: "pushNewSession",
    pushApprovalRequired: "pushStudentMessage",
    pushSystemUpdates: "pushSystemUpdates",
    digestWeekly: "digestWeekly",
    digestMonthly: "digestMonthly",
  };
  const BACKEND_TO_NOTIF = Object.fromEntries(
    Object.entries(NOTIF_TO_BACKEND).map(([k, v]) => [v, k])
  );

  // Load notification preferences on mount
  useEffect(() => {
    preferencesApi.get().then((prefs) => {
      const updated: Record<string, boolean> = {};
      for (const [backendKey, uiKey] of Object.entries(BACKEND_TO_NOTIF)) {
        if (prefs[backendKey] !== undefined) {
          updated[uiKey] = prefs[backendKey] as boolean;
        }
      }
      setNotifications((prev) => ({ ...prev, ...updated }));
      setNotificationsLoaded(true);
    }).catch(() => {
      setNotificationsLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const payload: Record<string, boolean> = {};
      for (const [uiKey, backendKey] of Object.entries(NOTIF_TO_BACKEND)) {
        payload[backendKey] = notifications[uiKey as keyof typeof notifications];
      }
      await preferencesApi.updateNotifications(payload);
      toast.success(t("settingsPage.notifications.saved"));
    } catch {
      toast.error(t("settingsPage.notifications.error"));
    } finally {
      setSavingNotifications(false);
    }
  };

  // Preferences State
  const [preferences, setPreferences] = useState({
    theme: "light",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
    timezone: "Asia/Riyadh",
    defaultView: "dashboard",
    compactMode: false,
    showTips: true,
    highContrast: false,
    fontSize: "medium",
    reduceMotion: false,
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load preferences from backend
  useEffect(() => {
    preferencesApi.get().then((prefs) => {
      setPreferences((prev) => ({
        ...prev,
        theme: (prefs.theme as string) || prev.theme,
        dateFormat: (prefs.dateFormat as string) || prev.dateFormat,
        timeFormat: (prefs.timeFormat as string) || prev.timeFormat,
        timezone: (prefs.timezone as string) || prev.timezone,
        defaultView: (prefs.defaultView as string) || prev.defaultView,
        compactMode: (prefs.compactMode as boolean) ?? prev.compactMode,
        showTips: (prefs.showTips as boolean) ?? prev.showTips,
        highContrast: (prefs.highContrast as boolean) ?? prev.highContrast,
        fontSize: (prefs.fontSize as string) || prev.fontSize,
        reduceMotion: (prefs.reduceMotion as boolean) ?? prev.reduceMotion,
      }));
      setPrefsLoaded(true);
    }).catch(() => setPrefsLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await preferencesApi.updateUi(preferences);
      toast.success(t("settingsPage.preferences.saved"));
    } catch {
      toast.error(t("settingsPage.preferences.error"));
    } finally {
      setSavingPrefs(false);
    }
  };

  // Integrations State (client-side only)
  const [integrations, setIntegrations] = useState({
    zoom: { connected: false, email: "" },
    googleCalendar: { connected: false, email: "" },
    microsoftTeams: { connected: false, email: "" },
    slack: { connected: false, email: "" },
    googleDrive: { connected: false, email: "" },
    dropbox: { connected: false, email: "" },
  });

  // Policies State
  const [policies, setPolicies] = useState({
    policyEnrollmentLimit: 30,
    policyRequireContentReview: true,
    policyAutoApproveCertificates: false,
    policyCancellationNoticeHours: 24,
    policyMaxInstructorWeeklyHours: 15,
    policyEnforceNelcCompliance: true,
  });
  const [policiesLoaded, setPoliciesLoaded] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);

  // Load policies from backend on mount
  useEffect(() => {
    preferencesApi.get().then((prefs) => {
      setPolicies({
        policyEnrollmentLimit: (prefs.policyEnrollmentLimit as number) ?? 30,
        policyRequireContentReview: (prefs.policyRequireContentReview as boolean) ?? true,
        policyAutoApproveCertificates: (prefs.policyAutoApproveCertificates as boolean) ?? false,
        policyCancellationNoticeHours: (prefs.policyCancellationNoticeHours as number) ?? 24,
        policyMaxInstructorWeeklyHours: (prefs.policyMaxInstructorWeeklyHours as number) ?? 15,
        policyEnforceNelcCompliance: (prefs.policyEnforceNelcCompliance as boolean) ?? true,
      });
      setPoliciesLoaded(true);
    }).catch(() => {
      setPoliciesLoaded(true);
    });
  }, []);

  const handleSavePolicies = async () => {
    setSavingPolicies(true);
    try {
      await preferencesApi.updatePolicies(policies);
      toast.success(t("settingsPage.policies.saved"));
    } catch {
      toast.error(t("settingsPage.policies.error"));
    } finally {
      setSavingPolicies(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: t("settingsPage.tabs.profile"), icon: UserIcon },
    { id: "security" as const, label: t("settingsPage.tabs.security"), icon: Shield },
    { id: "notifications" as const, label: t("settingsPage.tabs.notifications"), icon: Bell },
    { id: "preferences" as const, label: t("settingsPage.tabs.preferences"), icon: Settings },
    { id: "policies" as const, label: t("settingsPage.tabs.policies"), icon: FileText },
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
                          <div ref={avatarMenuRef}>
                            <button
                              onClick={() => setAvatarMenuOpen((v) => !v)}
                              className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#002D87] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#001d5e] transition-colors`}
                            >
                              <Pencil className="w-3.5 h-3.5 text-white" />
                            </button>
                            {avatarMenuOpen && (
                              <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-50 min-w-[160px]`}>
                                <button
                                  onClick={() => { avatarInputRef.current?.click(); setAvatarMenuOpen(false); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1F2937] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                                >
                                  <Upload className="w-4 h-4 text-[#4B5563]" />
                                  {t("settingsPage.uploadPhoto")}
                                </button>
                                {user?.avatar && (
                                  <button
                                    onClick={() => { handleRemoveAvatar(); setAvatarMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {t("settingsPage.removePhoto")}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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
                            <label htmlFor="cm-first-name" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.firstName")}
                            </label>
                            <input
                              id="cm-first-name"
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, firstName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-last-name" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.lastName")}
                            </label>
                            <input
                              id="cm-last-name"
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, lastName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-first-name-ar" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.firstNameAr")}
                            </label>
                            <input
                              id="cm-first-name-ar"
                              type="text"
                              dir="rtl"
                              value={profileData.firstNameAr}
                              onChange={(e) =>
                                setProfileData({ ...profileData, firstNameAr: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-last-name-ar" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.lastNameAr")}
                            </label>
                            <input
                              id="cm-last-name-ar"
                              type="text"
                              dir="rtl"
                              value={profileData.lastNameAr}
                              onChange={(e) =>
                                setProfileData({ ...profileData, lastNameAr: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-email" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.email")}
                            </label>
                            <div className="relative">
                              <Mail
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-email"
                                type="email"
                                value={profileData.email}
                                disabled
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="cm-phone" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.phone")}
                            </label>
                            <div className="relative">
                              <Phone
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-phone"
                                type="tel"
                                value={profileData.phone}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, phone: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="cm-department" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.profile.department")}
                            </label>
                            <input
                              id="cm-department"
                              type="text"
                              value={profileData.department}
                              onChange={(e) =>
                                setProfileData({ ...profileData, department: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
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
                            <label htmlFor="cm-current-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.security.currentPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-current-password"
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
                            <label htmlFor="cm-new-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settingsPage.security.newPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-new-password"
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

                      <div className="flex justify-end pt-4">
                        <button
                          onClick={handleSaveNotifications}
                          disabled={savingNotifications}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {savingNotifications ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {t("settingsPage.saveChanges")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preferences Tab */}
                  {activeTab === "preferences" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="cm-pref-theme" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.theme")}
                          </label>
                          <select
                            id="cm-pref-theme"
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
                          <label htmlFor="cm-pref-date-format" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.dateFormat")}
                          </label>
                          <select
                            id="cm-pref-date-format"
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
                          <label htmlFor="cm-pref-time-format" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.timeFormat")}
                          </label>
                          <select
                            id="cm-pref-time-format"
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
                          <label htmlFor="cm-pref-timezone" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settingsPage.preferences.timezone")}
                          </label>
                          <select
                            id="cm-pref-timezone"
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

                      {/* Accessibility Section */}
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settingsPage.preferences.accessibility")}
                        </h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <span className="text-sm font-medium text-[#374151]">
                                {t("settingsPage.preferences.highContrast")}
                              </span>
                              <p className="text-xs text-[#6B7280]">
                                {t("settingsPage.preferences.highContrastDesc")}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setPreferences({ ...preferences, highContrast: !preferences.highContrast })
                              }
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                preferences.highContrast ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                  preferences.highContrast
                                    ? isRTL ? "left-0.5" : "right-0.5"
                                    : isRTL ? "right-0.5" : "left-0.5"
                                }`}
                              />
                            </button>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <span className="text-sm font-medium text-[#374151]">
                                {t("settingsPage.preferences.fontSize")}
                              </span>
                              <p className="text-xs text-[#6B7280]">
                                {t("settingsPage.preferences.fontSizeDesc")}
                              </p>
                            </div>
                            <select
                              id="cm-pref-font-size"
                              aria-label={t("settingsPage.preferences.fontSize")}
                              value={preferences.fontSize}
                              onChange={(e) =>
                                setPreferences({ ...preferences, fontSize: e.target.value })
                              }
                              className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            >
                              <option value="small">{t("settingsPage.preferences.fontSmall")}</option>
                              <option value="medium">{t("settingsPage.preferences.fontMedium")}</option>
                              <option value="large">{t("settingsPage.preferences.fontLarge")}</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <span className="text-sm font-medium text-[#374151]">
                                {t("settingsPage.preferences.reduceMotion")}
                              </span>
                              <p className="text-xs text-[#6B7280]">
                                {t("settingsPage.preferences.reduceMotionDesc")}
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setPreferences({ ...preferences, reduceMotion: !preferences.reduceMotion })
                              }
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                preferences.reduceMotion ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                  preferences.reduceMotion
                                    ? isRTL ? "left-0.5" : "right-0.5"
                                    : isRTL ? "right-0.5" : "left-0.5"
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleSavePreferences}
                          disabled={savingPrefs}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {savingPrefs ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {t("settingsPage.preferences.savePreferences")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Policies Tab */}
                  {activeTab === "policies" && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-1">
                          {t("settingsPage.policies.title")}
                        </h4>
                        <p className="text-xs text-[#6B7280] mb-4">
                          {t("settingsPage.policies.description")}
                        </p>
                      </div>

                      {!policiesLoaded ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-[#a37f49]" />
                        </div>
                      ) : (
                        <>
                          {/* Numeric Policies */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <label htmlFor="cm-enrollment-limit" className="block text-sm font-medium text-[#374151] mb-1.5">
                                {t("settingsPage.policies.enrollmentLimit")}
                              </label>
                              <p className="text-xs text-[#6B7280] mb-2">
                                {t("settingsPage.policies.enrollmentLimitDesc")}
                              </p>
                              <input
                                id="cm-enrollment-limit"
                                type="number"
                                min={1}
                                max={500}
                                value={policies.policyEnrollmentLimit}
                                onChange={(e) =>
                                  setPolicies({ ...policies, policyEnrollmentLimit: parseInt(e.target.value) || 30 })
                                }
                                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              />
                            </div>
                            <div>
                              <label htmlFor="cm-cancellation-notice" className="block text-sm font-medium text-[#374151] mb-1.5">
                                {t("settingsPage.policies.cancellationNotice")}
                              </label>
                              <p className="text-xs text-[#6B7280] mb-2">
                                {t("settingsPage.policies.cancellationNoticeDesc")}
                              </p>
                              <input
                                id="cm-cancellation-notice"
                                type="number"
                                min={1}
                                max={168}
                                value={policies.policyCancellationNoticeHours}
                                onChange={(e) =>
                                  setPolicies({ ...policies, policyCancellationNoticeHours: parseInt(e.target.value) || 24 })
                                }
                                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              />
                            </div>
                            <div>
                              <label htmlFor="cm-max-instructor-hours" className="block text-sm font-medium text-[#374151] mb-1.5">
                                {t("settingsPage.policies.maxInstructorHours")}
                              </label>
                              <p className="text-xs text-[#6B7280] mb-2">
                                {t("settingsPage.policies.maxInstructorHoursDesc")}
                              </p>
                              <input
                                id="cm-max-instructor-hours"
                                type="number"
                                min={1}
                                max={60}
                                value={policies.policyMaxInstructorWeeklyHours}
                                onChange={(e) =>
                                  setPolicies({ ...policies, policyMaxInstructorWeeklyHours: parseInt(e.target.value) || 15 })
                                }
                                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                              />
                            </div>
                          </div>

                          {/* Toggle Policies */}
                          <div className="pt-6 border-t border-[#E5E7EB] space-y-3">
                            {[
                              {
                                key: "policyRequireContentReview" as const,
                                label: t("settingsPage.policies.requireContentReview"),
                                desc: t("settingsPage.policies.requireContentReviewDesc"),
                              },
                              {
                                key: "policyAutoApproveCertificates" as const,
                                label: t("settingsPage.policies.autoApproveCertificates"),
                                desc: t("settingsPage.policies.autoApproveCertificatesDesc"),
                              },
                              {
                                key: "policyEnforceNelcCompliance" as const,
                                label: t("settingsPage.policies.enforceNelcCompliance"),
                                desc: t("settingsPage.policies.enforceNelcComplianceDesc"),
                              },
                            ].map((item) => (
                              <div key={item.key} className="flex items-center justify-between py-2">
                                <div>
                                  <span className="text-sm font-medium text-[#374151]">{item.label}</span>
                                  <p className="text-xs text-[#6B7280]">{item.desc}</p>
                                </div>
                                <button
                                  onClick={() =>
                                    setPolicies({ ...policies, [item.key]: !policies[item.key] })
                                  }
                                  className={`relative w-10 h-5 rounded-full transition-colors ${
                                    policies[item.key] ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"
                                  }`}
                                >
                                  <span
                                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                      policies[item.key]
                                        ? isRTL ? "left-0.5" : "right-0.5"
                                        : isRTL ? "right-0.5" : "left-0.5"
                                    }`}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="flex justify-end">
                            <button
                              onClick={handleSavePolicies}
                              disabled={savingPolicies}
                              className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {savingPolicies ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              {t("settingsPage.policies.save")}
                            </button>
                          </div>
                        </>
                      )}
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
