"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import {
  User,
  Shield,
  Bell,
  Settings,
  Plug,
  Camera,
  Mail,
  Phone,
  MapPin,
  Globe,
  Briefcase,
  GraduationCap,
  Key,
  Eye,
  EyeOff,
  Check,
  X,
  ExternalLink,
  Video,
  Calendar,
  Cloud,
  Save,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const mockInstructor = {
  name: "Dr. Faisal Al-Otaibi",
  email: "faisal@healthtraining.sa",
  rating: 4.8,
  courseCompletion: 92,
  avatar: "/images/instructor-1.png",
};

const SettingsContent = () => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "notifications" | "preferences" | "integrations"
  >("profile");

  // Profile State
  const [profileData, setProfileData] = useState({
    firstName: "Dr. Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@physioguidance.com",
    phone: "+1 234 567 8900",
    location: "New York, USA",
    language: "en",
    bio: "Certified physiotherapist with 10+ years of experience in sports rehabilitation and lower back pain management.",
    title: "Senior Physiotherapist",
    specializations: ["Sports Rehabilitation", "Lower Back Pain", "Pediatric Care"],
  });

  // Security State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const security = useSecuritySettings();

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
    { id: "profile" as const, label: t("settings.tabProfile"), icon: User },
    { id: "security" as const, label: t("settings.tabSecurity"), icon: Shield },
    { id: "notifications" as const, label: t("settings.tabNotifications"), icon: Bell },
    { id: "preferences" as const, label: t("settings.tabPreferences"), icon: Settings },
    { id: "integrations" as const, label: t("settings.tabIntegrations"), icon: Plug },
  ];

  return (
    <>
      <InstructorNavbar instructor={mockInstructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={mockInstructor} />
            </div>
            <InstructorMobileSidebar instructor={mockInstructor} />

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
                          <div className="w-24 h-24 rounded-full bg-[#E5E7EB] flex items-center justify-center text-2xl font-bold text-[#4B5563]">
                            SJ
                          </div>
                          <button className="absolute bottom-0 right-0 w-8 h-8 bg-[#3B82F6] text-white rounded-full flex items-center justify-center hover:bg-[#2563EB] transition-colors">
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-[#1F2937]">
                            {profileData.firstName} {profileData.lastName}
                          </h3>
                          <p className="text-sm text-[#6B7280]">{profileData.title}</p>
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
                        </div>
                      </div>

                      {/* Personal Information */}
                      <div>
                        <h4 className="text-sm font-semibold text-[#1F2937] mb-4">
                          {t("settings.personalInfo")}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.firstName")}
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
                              {t("settings.lastName")}
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
                              {t("settings.email")}
                            </label>
                            <div className="relative">
                              <Mail
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
                                type="email"
                                value={profileData.email}
                                onChange={(e) =>
                                  setProfileData({ ...profileData, email: e.target.value })
                                }
                                className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.phone")}
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
                          <div>
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.location")}
                            </label>
                            <div className="relative">
                              <MapPin
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <input
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
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.language")}
                            </label>
                            <div className="relative">
                              <Globe
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                              />
                              <select
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
                        <label className="block text-sm font-medium text-[#374151] mb-1.5">
                          {t("settings.bio")}
                        </label>
                        <textarea
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
                        <button className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors">
                          <Save className="w-4 h-4" />
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
                            <label className="block text-sm font-medium text-[#374151] mb-1.5">
                              {t("settings.currentPassword")}
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
                              {t("settings.newPassword")}
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
                    </div>
                  )}

                  {/* Preferences Tab */}
                  {activeTab === "preferences" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settings.theme")}
                          </label>
                          <select
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
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settings.dateFormat")}
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
                            {t("settings.timeFormat")}
                          </label>
                          <select
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
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            {t("settings.timezone")}
                          </label>
                          <select
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
                        <button className="flex items-center gap-2 px-6 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors">
                          <Save className="w-4 h-4" />
                          {t("settings.savePreferences")}
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
