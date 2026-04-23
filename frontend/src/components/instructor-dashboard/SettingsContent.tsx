"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useAuth, useUser } from "@/contexts/AuthContext";
import { profileApi, preferencesApi } from "@/lib/api";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import {
  User as UserIcon,
  Shield,
  Bell,
  Pencil,
  Mail,
  Phone,
  Globe,
  Key,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Upload,
  Trash2,
} from "lucide-react";

const SettingsContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const tToasts = useTranslations("toasts");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat, setCalendarFormat } = useCalendarPreference();
  const router = useRouter();
  const pathname = usePathname();
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
    "profile" | "security" | "notifications"
  >("profile");

  // Profile State — initialized from authenticated user
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    firstNameAr: "",
    lastNameAr: "",
    email: "",
    phone: "",
    language: "en",
  });
  const [saving, setSaving] = useState(false);

  // Sync user data into form when available
  useEffect(() => {
    if (user) {
      setProfileData((prev) => ({
        ...prev,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        firstNameAr: (user as any).firstNameAr || "",
        lastNameAr: (user as any).lastNameAr || "",
        email: user.email,
        phone: user.phone || "",
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
      const newLang = profileData.language;
      await profileApi.update({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        firstNameAr: profileData.firstNameAr,
        lastNameAr: profileData.lastNameAr,
        phone: profileData.phone,
        language: newLang,
      });
      await refreshUser();
      toast.success(t("settings.profileSaved"));

      // If language changed, redirect to the new locale
      if (newLang !== locale) {
        const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, "");
        router.push(`/${newLang}${pathWithoutLocale}`);
      }
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
      toast.error(tToasts("bothPasswordFieldsRequired"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(tToasts("passwordMinLength"));
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

  // Notification State — simplified: email toggle + push toggle
  const [emailNotificationsOn, setEmailNotificationsOn] = useState(true);
  const [pushNotificationsOn, setPushNotificationsOn] = useState(true);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Load notification preferences on mount
  useEffect(() => {
    preferencesApi.get().then((prefs) => {
      const anyEmail =
        !!(prefs as any).emailNewStudent ||
        !!(prefs as any).emailCourseComplete ||
        !!(prefs as any).emailAssessmentSubmit ||
        !!(prefs as any).emailCertificateRequest;
      const anyPush =
        !!(prefs as any).pushNewSession ||
        !!(prefs as any).pushStudentMessage ||
        !!(prefs as any).pushSystemUpdates;
      setEmailNotificationsOn(anyEmail);
      setPushNotificationsOn(anyPush);
      setNotificationsLoaded(true);
    }).catch(() => {
      setNotificationsLoaded(true);
    });
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const payload: Record<string, boolean> = {
        emailNewStudent: emailNotificationsOn,
        emailCourseComplete: emailNotificationsOn,
        emailAssessmentSubmit: emailNotificationsOn,
        emailCertificateRequest: emailNotificationsOn,
        pushNewSession: pushNotificationsOn,
        pushStudentMessage: pushNotificationsOn,
        pushSystemUpdates: pushNotificationsOn,
      };
      await preferencesApi.updateNotifications(payload);
      toast.success(t("settings.notificationsSaved") || "Notification preferences saved");
    } catch {
      toast.error(t("settings.notificationsError") || "Failed to save notification preferences");
    } finally {
      setSavingNotifications(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: t("settings.tabProfile"), icon: UserIcon },
    { id: "security" as const, label: t("settings.tabSecurity"), icon: Shield },
    { id: "notifications" as const, label: t("settings.tabNotifications"), icon: Bell },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
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
                <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("settings.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("settings.subtitle")}</p>
              </div>

              {/* Tabs */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === tab.id
                          ? "text-[#3B82F6]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
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
                            <div className="w-24 h-24 rounded-full bg-[var(--color-border)] flex items-center justify-center text-2xl font-bold text-[var(--color-text-secondary)]">
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
                              <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`}>
                                <button
                                  onClick={() => { avatarInputRef.current?.click(); setAvatarMenuOpen(false); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                                >
                                  <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
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
                          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {isRTL && (profileData.firstNameAr || profileData.lastNameAr)
                              ? `${profileData.firstNameAr} ${profileData.lastNameAr}`.trim()
                              : `${profileData.firstName} ${profileData.lastName}`.trim()}
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">{profileData.email}</p>
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("settings.personalInfo")}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="instructor-first-name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.firstName")}
                            </label>
                            <input
                              id="instructor-first-name"
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, firstName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="instructor-last-name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.lastName")}
                            </label>
                            <input
                              id="instructor-last-name"
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, lastName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="instructor-first-name-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.firstNameAr") || "First Name (Arabic)"}
                            </label>
                            <input
                              id="instructor-first-name-ar"
                              type="text"
                              dir="rtl"
                              value={profileData.firstNameAr}
                              onChange={(e) =>
                                setProfileData({ ...profileData, firstNameAr: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="instructor-last-name-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.lastNameAr") || "Last Name (Arabic)"}
                            </label>
                            <input
                              id="instructor-last-name-ar"
                              type="text"
                              dir="rtl"
                              value={profileData.lastNameAr}
                              onChange={(e) =>
                                setProfileData({ ...profileData, lastNameAr: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            />
                          </div>
                          <div>
                            <label htmlFor="instructor-email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.email")}
                            </label>
                            <div className="relative">
                              <Mail
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-email"
                                type="email"
                                value={profileData.email}
                                readOnly
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] cursor-not-allowed ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="instructor-phone" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.phone")}
                            </label>
                            <div className="relative">
                              <Phone
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-phone"
                                type="tel"
                                value={profileData.phone}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, phone: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="instructor-language" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.language")}
                            </label>
                            <div className="relative">
                              <Globe
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <select
                                id="instructor-language"
                                value={profileData.language}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, language: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              >
                                <option value="en">English</option>
                                <option value="ar">العربية</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Calendar Preference */}
                      <div className="pt-4 border-t border-[var(--color-border)]">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                          {t("settings.calendarType") || "Calendar Type"}
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCalendarFormat("gregorian")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              calendarFormat === "gregorian"
                                ? "bg-[#002D87] text-white border-[#002D87]"
                                : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                            }`}
                          >
                            {t("settings.gregorian") || "Gregorian"} (ميلادي)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarFormat("hijri")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              calendarFormat === "hijri"
                                ? "bg-[#002D87] text-white border-[#002D87]"
                                : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                            }`}
                          >
                            {t("settings.hijri") || "Hijri"} (هجري)
                          </button>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
                          {t("settings.calendarTypeDesc") || "Applies to all dates across the system"}
                        </p>
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
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("settings.changePassword")}
                        </h4>
                        <div className="space-y-4 max-w-md">
                          <div>
                            <label htmlFor="instructor-current-password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.currentPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-current-password"
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className={`absolute top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] ${isRTL ? "left-3" : "right-3"}`}
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
                            <label htmlFor="instructor-new-password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settings.newPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="instructor-new-password"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className={`absolute top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] ${isRTL ? "left-3" : "right-3"}`}
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
                  )}

                  {/* Notifications Tab */}
                  {activeTab === "notifications" && (
                    <div className="space-y-6">
                      {!notificationsLoaded ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                        </div>
                      ) : (
                        <>
                          {/* Email Notifications Toggle */}
                          <div className="flex items-center justify-between py-2">
                            <div>
                              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                                {t("settings.emailNotifications")}
                              </span>
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("settings.emailNotificationsDesc") || "Receive email notifications for important updates"}
                              </p>
                            </div>
                            <button
                              onClick={() => setEmailNotificationsOn(!emailNotificationsOn)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                emailNotificationsOn ? "bg-[#3B82F6]" : "bg-[var(--color-border)]"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                  emailNotificationsOn
                                    ? isRTL ? "left-0.5" : "right-0.5"
                                    : isRTL ? "right-0.5" : "left-0.5"
                                }`}
                              />
                            </button>
                          </div>

                          {/* In-app Notifications Toggle */}
                          <div className="flex items-center justify-between py-2 pt-6 border-t border-[var(--color-border)]">
                            <div>
                              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                                {t("settings.pushNotifications")}
                              </span>
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("settings.pushNotificationsDesc") || "Receive in-app push notifications"}
                              </p>
                            </div>
                            <button
                              onClick={() => setPushNotificationsOn(!pushNotificationsOn)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                pushNotificationsOn ? "bg-[#3B82F6]" : "bg-[var(--color-border)]"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                                  pushNotificationsOn
                                    ? isRTL ? "left-0.5" : "right-0.5"
                                    : isRTL ? "right-0.5" : "left-0.5"
                                }`}
                              />
                            </button>
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
                              {t("settings.saveChanges")}
                            </button>
                          </div>
                        </>
                      )}
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
