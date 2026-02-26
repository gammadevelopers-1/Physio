"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { toast } from "sonner";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
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
  Upload,
  Trash2,
} from "lucide-react";

const SettingsContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { refreshUser, logout } = useAuth();
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
    title: "",
    specializations: [] as string[],
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
        bio: (user as any).bio || "",
        location: (user as any).location || "",
        language: (user as any).language || "en",
      }));
    }
  }, [user]);

  // Compute initials from user name
  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || user.email[0].toUpperCase()
    : "";

  // Handle avatar upload from settings camera button
  const handleSettingsAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success(t("settings.profileSaved"));
    } catch {
      toast.error(t("settings.avatarUploadError"));
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success(t("settings.profileSaved"));
    } catch {
      toast.error(t("settings.avatarUploadError"));
    }
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        bio: profileData.bio,
        location: profileData.location,
        language: profileData.language,
      });
      await refreshUser();
      toast.success(t("settings.profileSaved"));
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const security = useSecuritySettings();

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Both password fields are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      // Backend has revoked all trusted devices + refresh tokens.
      // Force logout immediately — same as Facebook/Instagram behavior.
      toast.success(t("settings.passwordChanged"));
      // Call logout to clear local auth state and redirect to sign-in
      await logout();
      // Safety fallback: hard redirect if React router didn't navigate
      window.location.href = `/${locale}/signin`;
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
      setChangingPassword(false);
    }
  };

  // Notification State
  const [notifications, setNotifications] = useState({
    emailNewStudent: true,
    emailCourseComplete: true,
    emailAssessmentSubmit: false,
    emailCertificateRequest: true,
    pushNewSession: true,
    pushStudentMessage: true,
    pushSystemUpdates: false,
    digestWeekly: true,
    digestMonthly: false,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Preferences State
  const [preferences, setPreferences] = useState({
    theme: "light",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    timezone: "America/New_York",
    defaultView: "dashboard",
    compactMode: false,
    showTips: true,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Fetch preferences from API on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const prefs = await preferencesApi.get();
        if (prefs) {
          setNotifications((prev) => ({
            ...prev,
            emailNewStudent: (prefs as any).emailNewStudent ?? prev.emailNewStudent,
            emailCourseComplete: (prefs as any).emailCourseComplete ?? prev.emailCourseComplete,
            emailAssessmentSubmit: (prefs as any).emailAssessmentSubmit ?? prev.emailAssessmentSubmit,
            emailCertificateRequest: (prefs as any).emailCertificateRequest ?? prev.emailCertificateRequest,
            pushNewSession: (prefs as any).pushNewSession ?? prev.pushNewSession,
            pushStudentMessage: (prefs as any).pushStudentMessage ?? prev.pushStudentMessage,
            pushSystemUpdates: (prefs as any).pushSystemUpdates ?? prev.pushSystemUpdates,
            digestWeekly: (prefs as any).digestWeekly ?? prev.digestWeekly,
            digestMonthly: (prefs as any).digestMonthly ?? prev.digestMonthly,
          }));
          setPreferences((prev) => ({
            ...prev,
            theme: (prefs as any).theme ?? prev.theme,
            dateFormat: (prefs as any).dateFormat ?? prev.dateFormat,
            timeFormat: (prefs as any).timeFormat ?? prev.timeFormat,
            timezone: (prefs as any).timezone ?? prev.timezone,
            defaultView: (prefs as any).defaultView ?? prev.defaultView,
            compactMode: (prefs as any).compactMode ?? prev.compactMode,
            showTips: (prefs as any).showTips ?? prev.showTips,
          }));
        }
      } catch {
        // Silently fail — use defaults
      }
    };
    fetchPreferences();
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      await preferencesApi.updateNotifications(notifications as unknown as Record<string, boolean>);
      toast.success(t("settings.notificationsSaved") || "Notification preferences saved");
    } catch {
      toast.error("Failed to save notification preferences");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      await preferencesApi.updateUi(preferences as unknown as Record<string, unknown>);
      toast.success(t("settings.preferencesSaved") || "Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  // Integrations State
  const [integrations, setIntegrations] = useState({
    zoom: { connected: true, email: "sarah@zoom.us" },
    googleCalendar: { connected: true, email: "sarah.j@gmail.com" },
    microsoftTeams: { connected: false, email: "" },
    slack: { connected: false, email: "" },
    googleDrive: { connected: true, email: "sarah.j@gmail.com" },
    dropbox: { connected: false, email: "" },
  });

  const tabs = [
    { id: "profile" as const, label: t("settings.tabProfile"), icon: UserIcon },
    { id: "security" as const, label: t("settings.tabSecurity"), icon: Shield },
    { id: "notifications" as const, label: t("settings.tabNotifications"), icon: Bell },
    { id: "preferences" as const, label: t("settings.tabPreferences"), icon: Settings },
    { id: "integrations" as const, label: t("settings.tabIntegrations"), icon: Plug },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                  {t("settings.title")}
                </h1>
                <p className="text-sm text-[#6B7280] mt-1">{t("settings.subtitle")}</p>
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
                            onChange={handleSettingsAvatarUpload}
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
                                  {t("settings.uploadPhoto")}
                                </button>
                                {user?.avatar && (
                                  <button
                                    onClick={() => { handleRemoveAvatar(); setAvatarMenuOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {t("settings.removePhoto")}
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
                          <p className="text-sm text-[#6B7280]">{profileData.title}</p>
                          {profileData.specializations.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {profileData.specializations.map((spec, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-[#EFF6FF] text-[#3B82F6] rounded-full text-xs font-medium"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settings.personalInfo")}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="instructor-first-name" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.firstName")}
                            </label>
                            <input
                              id="instructor-first-name"
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, firstName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="instructor-last-name" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.lastName")}
                            </label>
                            <input
                              id="instructor-last-name"
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, lastName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="instructor-email" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.email")}
                            </label>
                            <div className="relative">
                              <Mail
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-email"
                                type="email"
                                value={profileData.email}
                                readOnly
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] cursor-not-allowed ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="instructor-phone" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.phone")}
                            </label>
                            <div className="relative">
                              <Phone
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-phone"
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
                            <label htmlFor="instructor-location" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.location")}
                            </label>
                            <div className="relative">
                              <MapPin
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-location"
                                type="text"
                                value={profileData.location}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, location: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="instructor-language" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.language")}
                            </label>
                            <div className="relative">
                              <Globe
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <select
                                id="instructor-language"
                                value={profileData.language}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, language: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              >
                                <option value="en">English</option>
                                <option value="ar">العربية</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bio */}
                      <div>
                        <label htmlFor="instructor-bio" className="block text-sm font-medium text-[#374151] mb-1.5">
                          {t("settings.bio")}
                        </label>
                        <textarea
                          id="instructor-bio"
                          value={profileData.bio}
                          onChange={(e) =>
                            setProfileData({ ...profileData, bio: e.target.value })
                          }
                          rows={4}
                          className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
                        />
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {t("settings.saveChanges")}
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
                          {t("settings.changePassword")}
                        </h4>
                        <div className="space-y-4 max-w-md">
                          <div>
                            <label htmlFor="instructor-current-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.currentPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-current-password"
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
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
                            <label htmlFor="instructor-new-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.newPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-new-password"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
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
                          <button
                            type="button"
                            onClick={handleChangePassword}
                            disabled={changingPassword || !currentPassword || !newPassword}
                            className="px-4 py-2 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                            {t("settings.updatePassword")}
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
                          {t("settings.emailNotifications")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: "emailNewStudent", label: t("settings.notifyNewStudent") },
                            { key: "emailCourseComplete", label: t("settings.notifyCourseComplete") },
                            { key: "emailAssessmentSubmit", label: t("settings.notifyAssessmentSubmit") },
                            { key: "emailCertificateRequest", label: t("settings.notifyCertificateRequest") },
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
                          {t("settings.pushNotifications")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: "pushNewSession", label: t("settings.notifyNewSession") },
                            { key: "pushStudentMessage", label: t("settings.notifyStudentMessage") },
                            { key: "pushSystemUpdates", label: t("settings.notifySystemUpdates") },
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
                          {t("settings.emailDigest")}
                        </h4>
                        <div className="space-y-3">
                          {[
                            { key: "digestWeekly", label: t("settings.weeklyDigest") },
                            { key: "digestMonthly", label: t("settings.monthlyDigest") },
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

                      {/* Save Notifications Button */}
                      <div className="pt-6 border-t border-[#E5E7EB] flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveNotifications}
                          disabled={savingNotifications}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {savingNotifications
                            ? (t("settings.savingNotifications") || "Saving...")
                            : (t("settings.saveNotifications") || "Save Notifications")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preferences Tab */}
                  {activeTab === "preferences" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="instructor-pref-theme" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settings.theme")}
                          </label>
                          <select
                            id="instructor-pref-theme"
                            value={preferences.theme}
                            onChange={(e) =>
                              setPreferences({ ...preferences, theme: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          >
                            <option value="light">{t("settings.themeLight")}</option>
                            <option value="dark">{t("settings.themeDark")}</option>
                            <option value="system">{t("settings.themeSystem")}</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="instructor-pref-date-format" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settings.dateFormat")}
                          </label>
                          <select
                            id="instructor-pref-date-format"
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
                          <label htmlFor="instructor-pref-time-format" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settings.timeFormat")}
                          </label>
                          <select
                            id="instructor-pref-time-format"
                            value={preferences.timeFormat}
                            onChange={(e) =>
                              setPreferences({ ...preferences, timeFormat: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          >
                            <option value="12h">{t("settings.time12h")}</option>
                            <option value="24h">{t("settings.time24h")}</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="instructor-pref-timezone" className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settings.timezone")}
                          </label>
                          <select
                            id="instructor-pref-timezone"
                            value={preferences.timezone}
                            onChange={(e) =>
                              setPreferences({ ...preferences, timezone: e.target.value })
                            }
                            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                          >
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="America/Chicago">Central Time (CT)</option>
                            <option value="America/Denver">Mountain Time (MT)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="UTC">UTC</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-[#E5E7EB] space-y-3">
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <span className="text-sm font-medium text-[#374151]">
                              {t("settings.compactMode")}
                            </span>
                            <p className="text-xs text-[#6B7280]">
                              {t("settings.compactModeDesc")}
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
                              {t("settings.showTips")}
                            </span>
                            <p className="text-xs text-[#6B7280]">
                              {t("settings.showTipsDesc")}
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
                        <button
                          type="button"
                          onClick={handleSavePreferences}
                          disabled={savingPreferences}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {savingPreferences
                            ? (t("settings.loadingPreferences") || "Saving...")
                            : t("settings.savePreferences")}
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
                          {t("settings.videoConferencing")}
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
                                      {t("settings.connected")} •{" "}
                                      {
                                        integrations[integration.key as keyof typeof integrations]
                                          .email
                                      }
                                    </p>
                                  ) : (
                                    <p className="text-xs text-[#6B7280]">
                                      {t("settings.notConnected")}
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
                                  ? t("settings.disconnect")
                                  : t("settings.connect")}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Calendar */}
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settings.calendar")}
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
                                    {t("settings.connected")} • {integrations.googleCalendar.email}
                                  </p>
                                ) : (
                                  <p className="text-xs text-[#6B7280]">
                                    {t("settings.notConnected")}
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
                                ? t("settings.disconnect")
                                : t("settings.connect")}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Cloud Storage */}
                      <div className="pt-6 border-t border-[#E5E7EB]">
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settings.cloudStorage")}
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
                                      {t("settings.connected")} •{" "}
                                      {
                                        integrations[integration.key as keyof typeof integrations]
                                          .email
                                      }
                                    </p>
                                  ) : (
                                    <p className="text-xs text-[#6B7280]">
                                      {t("settings.notConnected")}
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
                                  ? t("settings.disconnect")
                                  : t("settings.connect")}
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
