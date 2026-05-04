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
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat, setCalendarFormat } = useCalendarPreference();
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const security = useSecuritySettings();

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setChangingPassword(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success(t("settingsPage.security.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("settingsPage.security.passwordError");
      toast.error(message);
    } finally {
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
        !!(prefs.emailNewStudent) ||
        !!(prefs.emailCourseComplete) ||
        !!(prefs.emailAssessmentSubmit) ||
        !!(prefs.emailCertificateRequest);
      const anyPush =
        !!(prefs.pushNewSession) ||
        !!(prefs.pushStudentMessage) ||
        !!(prefs.pushSystemUpdates);
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
      toast.success(t("settingsPage.notifications.saved"));
    } catch {
      toast.error(t("settingsPage.notifications.error"));
    } finally {
      setSavingNotifications(false);
    }
  };

  const tabs = [
    { id: "profile" as const, label: t("settingsPage.tabs.profile"), icon: UserIcon },
    { id: "security" as const, label: t("settingsPage.tabs.security"), icon: Shield },
    { id: "notifications" as const, label: t("settingsPage.tabs.notifications"), icon: Bell },
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
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("settingsPage.subtitle")}</p>
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
                          ? "text-[var(--color-primary)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
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
                  {/* Profile Tab */}
                  {activeTab === "profile" && (
                    <div className="space-y-6">
                      {/* Avatar Section */}
                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="relative">
                          {user?.avatar ? (
                            <div className="w-24 h-24 rounded-full overflow-hidden bg-[var(--color-border-subtle)]">
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
                            onChange={handleAvatarUpload}
                          />
                          <div ref={avatarMenuRef}>
                            <button
                              onClick={() => setAvatarMenuOpen((v) => !v)}
                              className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#001d5e] transition-colors`}
                            >
                              <Pencil className="w-3.5 h-3.5 text-white" />
                            </button>
                            {avatarMenuOpen && (
                              <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`}>
                                <button
                                  onClick={() => { avatarInputRef.current?.click(); setAvatarMenuOpen(false); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                                >
                                  <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
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
                          {t("settingsPage.profile.personalInfo")}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="cm-first-name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settingsPage.profile.firstName")}
                            </label>
                            <input
                              id="cm-first-name"
                              type="text"
                              value={profileData.firstName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, firstName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-last-name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settingsPage.profile.lastName")}
                            </label>
                            <input
                              id="cm-last-name"
                              type="text"
                              value={profileData.lastName}
                              onChange={(e) =>
                                setProfileData({ ...profileData, lastName: e.target.value })
                              }
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-first-name-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
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
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-last-name-ar" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
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
                              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                          <div>
                            <label htmlFor="cm-email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settingsPage.profile.email")}
                            </label>
                            <div className="relative">
                              <Mail
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-email"
                                type="email"
                                value={profileData.email}
                                disabled
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label htmlFor="cm-phone" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settingsPage.profile.phone")}
                            </label>
                            <div className="relative">
                              <Phone
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-phone"
                                type="tel"
                                value={profileData.phone}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, phone: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Language Section */}
                      <div className="pt-6 border-t border-[var(--color-border)]">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("settingsPage.preferences.language")}
                        </h4>
                        <div className="max-w-xs">
                          <div className="relative">
                            <Globe
                              className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                            />
                            <select
                              id="cm-language"
                              value={locale}
                              onChange={async (e) => {
                                const newLocale = e.target.value;
                                await profileApi.update({ language: newLocale }).catch(() => {});
                                window.location.href = `/${newLocale}/dashboard/manager/settings`;
                              }}
                              className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                            >
                              <option value="en">English</option>
                              <option value="ar">{"\u0627\u0644\u0639\u0631\u0628\u064A\u0629"}</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Calendar Preference */}
                      <div className="pt-4 border-t border-[var(--color-border)]">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                          {t("settingsPage.profile.calendarType") || "Calendar Type"}
                        </h4>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCalendarFormat("gregorian")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              calendarFormat === "gregorian"
                                ? "bg-[var(--color-primary)] text-white border-[#002D87]"
                                : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                          >
                            {t("settingsPage.profile.gregorian") || "Gregorian"} (ميلادي)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCalendarFormat("hijri")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              calendarFormat === "hijri"
                                ? "bg-[var(--color-primary)] text-white border-[#002D87]"
                                : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                          >
                            {t("settingsPage.profile.hijri") || "Hijri"} (هجري)
                          </button>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
                          {t("settingsPage.profile.calendarTypeDesc") || "Applies to all dates across the system"}
                        </p>
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end">
                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="flex items-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("settingsPage.security.changePassword")}
                        </h4>
                        <div className="space-y-4 max-w-md">
                          <div>
                            <label htmlFor="cm-current-password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settingsPage.security.currentPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-current-password"
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
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
                            <label htmlFor="cm-new-password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                              {t("settingsPage.security.newPassword")}
                            </label>
                            <div className="relative">
                              <Key
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                id="cm-new-password"
                                type={showNewPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"}`}
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
                            onClick={handleChangePassword}
                            disabled={changingPassword || !currentPassword || !newPassword}
                            className="flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
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
                                {t("settingsPage.notifications.email")}
                              </span>
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("settingsPage.notifications.emailDesc")}
                              </p>
                            </div>
                            <button
                              onClick={() => setEmailNotificationsOn(!emailNotificationsOn)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                emailNotificationsOn ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-[var(--color-surface-card)] rounded-full transition-all ${
                                  emailNotificationsOn
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

                          {/* In-app Notifications Toggle */}
                          <div className="flex items-center justify-between py-2 pt-6 border-t border-[var(--color-border)]">
                            <div>
                              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                                {t("settingsPage.notifications.push")}
                              </span>
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("settingsPage.notifications.pushDesc")}
                              </p>
                            </div>
                            <button
                              onClick={() => setPushNotificationsOn(!pushNotificationsOn)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                pushNotificationsOn ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 bg-[var(--color-surface-card)] rounded-full transition-all ${
                                  pushNotificationsOn
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

                          <div className="flex justify-end pt-4">
                            <button
                              onClick={handleSaveNotifications}
                              disabled={savingNotifications}
                              className="flex items-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {savingNotifications ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                              {t("settingsPage.saveChanges")}
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
