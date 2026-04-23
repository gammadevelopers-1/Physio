"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import {
  Pencil,
  ChevronDown,
  Calendar,
  Loader2,
  Shield,
  Check,
  Globe,
  Bell,
  Download,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import OfflineBanner from "./OfflineBanner";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { profileApi } from "@/lib/api";
import { usePreferences } from "@/hooks/usePreferences";

/* ─── Reusable UI helpers ─── */

type TabKey = "profile" | "security" | "preferences" | "notifications";

function ToggleSwitch({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors min-h-[44px] min-w-[44px] ${
        disabled
          ? "bg-gray-200 cursor-not-allowed opacity-50"
          : enabled
            ? "bg-[#002D87]"
            : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ButtonGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors min-h-[44px] ${
            value === opt.value
              ? "bg-[#002D87] text-white border-[#002D87]"
              : "bg-white text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[#002D87]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">{children}</h3>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/* ─── Preferences Tab ─── */

function PreferencesTab({
  t,
  isRTL,
}: {
  t: (key: string) => string;
  isRTL: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { preferences, loading, updateUi } = usePreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4A520]" />
      </div>
    );
  }

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
    profileApi.update({ language: newLocale }).catch(() => {});
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Language Settings */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <SectionHeading>{t("settings.languageSettings")}</SectionHeading>

        <SettingRow label={t("settings.interfaceLanguage")}>
          <ButtonGroup
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية" },
            ]}
            value={locale}
            onChange={switchLocale}
          />
        </SettingRow>

        <SettingRow label={t("settings.contentLanguage")}>
          <ButtonGroup
            options={[
              { value: "en", label: t("settings.english") },
              { value: "ar", label: t("settings.arabic") },
              { value: "both", label: t("settings.both") },
            ]}
            value={preferences.contentLanguage}
            onChange={(v) => updateUi({ contentLanguage: v })}
          />
        </SettingRow>

        <SettingRow label={t("settings.calendarFormat")}>
          <ButtonGroup
            options={[
              { value: "gregorian", label: t("settings.gregorian") },
              { value: "hijri", label: t("settings.hijri") },
              { value: "both", label: t("settings.both") },
            ]}
            value={preferences.calendarFormat}
            onChange={(v) => updateUi({ calendarFormat: v })}
          />
        </SettingRow>
      </div>

      {/* Accessibility Controls */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <SectionHeading>{t("settings.accessibilityControls")}</SectionHeading>

        <SettingRow label={t("settings.fontSize")}>
          <ButtonGroup
            options={[
              { value: "small", label: t("settings.fontSmall") },
              { value: "medium", label: t("settings.fontMedium") },
              { value: "large", label: t("settings.fontLarge") },
              { value: "extra-large", label: t("settings.fontExtraLarge") },
            ]}
            value={preferences.fontSize}
            onChange={(v) => updateUi({ fontSize: v })}
          />
        </SettingRow>

        <SettingRow
          label={t("settings.highContrast")}
          description={t("settings.highContrastDesc")}
        >
          <ToggleSwitch
            enabled={preferences.highContrast}
            onChange={(v) => updateUi({ highContrast: v })}
          />
        </SettingRow>

        <SettingRow
          label={t("settings.captionsDefault")}
          description={t("settings.captionsDefaultDesc")}
        >
          <ToggleSwitch
            enabled={preferences.captionsDefault}
            onChange={(v) => updateUi({ captionsDefault: v })}
          />
        </SettingRow>

        <SettingRow label={t("settings.subtitlesLanguage")}>
          <ButtonGroup
            options={[
              { value: "en", label: t("settings.english") },
              { value: "ar", label: t("settings.arabic") },
            ]}
            value={preferences.subtitlesLanguage}
            onChange={(v) => updateUi({ subtitlesLanguage: v })}
          />
        </SettingRow>

        <SettingRow
          label={t("settings.reducedMotion")}
          description={t("settings.reducedMotionDesc")}
        >
          <ToggleSwitch
            enabled={preferences.reduceMotion}
            onChange={(v) => updateUi({ reduceMotion: v })}
          />
        </SettingRow>

        <SettingRow label={t("settings.keyboardNavigation")}>
          <span className="px-3 py-1 text-xs font-medium bg-[#DCFCE7] text-[#16A34A] rounded-full">
            {t("settings.alwaysEnabled")}
          </span>
        </SettingRow>

        <SettingRow label={t("settings.screenReader")}>
          <span className="px-3 py-1 text-xs font-medium bg-[#DCFCE7] text-[#16A34A] rounded-full">
            {t("settings.alwaysEnabled")}
          </span>
        </SettingRow>
      </div>

      {/* Privacy Controls */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <SectionHeading>{t("settings.privacyControls")}</SectionHeading>

        <SettingRow
          label={t("settings.profileVisibility")}
          description={t("settings.profileVisibilityDesc")}
        >
          <ButtonGroup
            options={[
              { value: "name_only", label: t("settings.nameOnly") },
              { value: "name_photo", label: t("settings.namePhoto") },
              { value: "full", label: t("settings.fullProfile") },
            ]}
            value={preferences.profileVisibility}
            onChange={(v) => updateUi({ profileVisibility: v })}
          />
        </SettingRow>

        <SettingRow
          label={t("settings.dataSharing")}
          description={t("settings.dataSharingDesc")}
        >
          <ToggleSwitch
            enabled={preferences.dataSharing}
            onChange={(v) => updateUi({ dataSharing: v })}
          />
        </SettingRow>

        <SettingRow label={t("settings.exportData")}>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 text-sm border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] cursor-not-allowed"
            title={t("settings.comingSoon")}
          >
            <Download className="w-4 h-4" />
            {t("settings.comingSoon")}
          </button>
        </SettingRow>

        <SettingRow label={t("settings.deleteAccount")}>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 rounded-lg text-[var(--color-text-secondary)] cursor-not-allowed"
            title={t("settings.comingSoon")}
          >
            <Trash2 className="w-4 h-4" />
            {t("settings.comingSoon")}
          </button>
        </SettingRow>
      </div>
    </div>
  );
}

/* ─── Notifications Tab ─── */

function NotificationsTab({
  t,
  isRTL,
}: {
  t: (key: string) => string;
  isRTL: boolean;
}) {
  const { preferences, loading, updateNotifications } = usePreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4A520]" />
      </div>
    );
  }

  const notifTypes: {
    labelKey: string;
    emailField: keyof typeof preferences;
  }[] = [
    { labelKey: "settings.sessionReminder", emailField: "pushNewSession" },
    {
      labelKey: "settings.assessmentDue",
      emailField: "emailAssessmentSubmit",
    },
    {
      labelKey: "settings.certificateReady",
      emailField: "emailCertificateRequest",
    },
    { labelKey: "settings.gradeAvailable", emailField: "emailCourseComplete" },
    { labelKey: "settings.courseUpdate", emailField: "emailNewStudent" },
    { labelKey: "settings.promotional", emailField: "digestWeekly" },
  ];

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Email Notifications */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <SectionHeading>{t("settings.notificationPreferences")}</SectionHeading>

        {/* Header row */}
        <div className="flex items-center gap-4 pb-3 mb-1 border-b border-[var(--color-border)]">
          <div className="flex-1 text-sm font-medium text-[var(--color-text-secondary)]" />
          <div className="w-16 text-center text-xs font-medium text-[var(--color-text-secondary)]">
            {t("settings.emailNotifications")}
          </div>
          <div className="w-16 text-center text-xs font-medium text-[var(--color-text-secondary)]">
            {t("settings.smsWhatsapp")}
          </div>
          <div className="w-16 text-center text-xs font-medium text-[var(--color-text-secondary)]">
            {t("settings.inApp")}
          </div>
        </div>

        {/* Notification rows */}
        {notifTypes.map((nt) => (
          <div
            key={nt.emailField}
            className="flex items-center gap-4 py-3 border-b border-[#F3F4F6] last:border-0"
          >
            <div className="flex-1 text-sm text-[var(--color-text-primary)]">
              {t(nt.labelKey)}
            </div>
            <div className="w-16 flex justify-center">
              <ToggleSwitch
                enabled={preferences[nt.emailField] as boolean}
                onChange={(v) => updateNotifications({ [nt.emailField]: v })}
              />
            </div>
            <div className="w-16 flex justify-center">
              <ToggleSwitch enabled={false} onChange={() => {}} disabled />
            </div>
            <div className="w-16 flex justify-center">
              <ToggleSwitch enabled={false} onChange={() => {}} disabled />
            </div>
          </div>
        ))}
      </div>

      {/* Reminder Timing */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
        <SectionHeading>{t("settings.reminderTiming")}</SectionHeading>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {t("settings.reminderTimingDesc")}
        </p>
        <ButtonGroup
          options={[
            { value: "15", label: `15 ${t("settings.minutes")}` },
            { value: "30", label: `30 ${t("settings.minutes")}` },
            { value: "60", label: `1 ${t("settings.hour")}` },
          ]}
          value={String(preferences.reminderMinutes)}
          onChange={(v) => updateNotifications({ reminderMinutes: Number(v) })}
        />
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

const SettingsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { user, refreshUser } = useAuth();
  const settingsAvatarRef = useRef<HTMLInputElement>(null);
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

  const handleSettingsAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.avatarUploadError"));
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.avatarUploadError"));
    }
  };

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    scfhsNumber: "",
    nationalId: "",
    nationality: "",
    gender: "",
    dob: "",
    biography: "",
  });
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [genderOpen, setGenderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const security = useSecuritySettings();

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        scfhsNumber: user.scfhsNumber || "",
        nationalId: user.nationalId || "",
        nationality: user.nationality || "",
        gender: user.gender || "",
        dob: user.dateOfBirth || "",
        biography: user.bio || "",
      });
    }
  }, [user]);

  const userData = useStudentProfile();

  const nationalities = [
    { value: "Saudi Arabia", labelKey: "settings.nationalities.saudiArabia" },
    { value: "UAE", labelKey: "settings.nationalities.uae" },
    { value: "Egypt", labelKey: "settings.nationalities.egypt" },
    { value: "Jordan", labelKey: "settings.nationalities.jordan" },
    { value: "Other", labelKey: "settings.nationalities.other" },
  ];

  const genders = [
    { value: "male", labelKey: "settings.genders.male" },
    { value: "female", labelKey: "settings.genders.female" },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNationalitySelect = (value: string) => {
    setFormData((prev) => ({ ...prev, nationality: value }));
    setNationalityOpen(false);
  };

  const handleGenderSelect = (value: string) => {
    setFormData((prev) => ({ ...prev, gender: value }));
    setGenderOpen(false);
  };

  const tabs: { key: TabKey; labelKey: string; icon: React.ReactNode }[] = [
    {
      key: "profile",
      labelKey: "settings.tabProfile",
      icon: <Pencil className="w-4 h-4" />,
    },
    {
      key: "security",
      labelKey: "settings.tabSecurity",
      icon: <Shield className="w-4 h-4" />,
    },
    {
      key: "preferences",
      labelKey: "settings.tabPreferences",
      icon: <Globe className="w-4 h-4" />,
    },
    {
      key: "notifications",
      labelKey: "settings.tabNotifications",
      icon: <Bell className="w-4 h-4" />,
    },
  ];

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              <h1
                className={`text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-4 sm:mb-6 ${isRTL ? "text-right" : ""}`}
              >
                {t("settings.title")}
              </h1>

              <OfflineBanner />

              {/* Tabs */}
              <div className="flex gap-1 mb-6 bg-[#F3F4F6] rounded-lg p-1 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.key
                        ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                  </button>
                ))}
              </div>

              {/* ── Profile Tab ── */}
              {activeTab === "profile" && (
                <div
                  className="bg-white rounded-xl border border-[var(--color-border)] p-4 sm:p-6"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  {/* Avatar + Name */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">
                    <div className="flex-shrink-0 flex justify-center sm:justify-start">
                      <div className="relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gray-100">
                          <Image
                            src={
                              userData.avatar || "/images/default-avatar.png"
                            }
                            alt={userData.name}
                            width={96}
                            height={96}
                            className="object-cover w-full h-full"
                            unoptimized={!!userData.avatar}
                          />
                        </div>
                        <input
                          ref={settingsAvatarRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleSettingsAvatarUpload}
                        />
                        <div ref={avatarMenuRef}>
                          <button
                            onClick={() => setAvatarMenuOpen((v) => !v)}
                            className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#002D87] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#001d5e] transition-colors`}
                            aria-label={t("settings.changePhoto")}
                          >
                            <Pencil className="w-3.5 h-3.5 text-white" />
                          </button>
                          {avatarMenuOpen && (
                            <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-white rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`}>
                              <button
                                onClick={() => { settingsAvatarRef.current?.click(); setAvatarMenuOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                              >
                                <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                {t("settings.uploadPhoto")}
                              </button>
                              {userData.avatar && (
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
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="student-first-name"
                          className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                        >
                          {t("settings.firstName")}
                        </label>
                        <input
                          id="student-first-name"
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          aria-label={t("settings.firstName")}
                          className={`w-full px-4 py-2.5 bg-[#F3F4F6] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="student-last-name"
                          className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                        >
                          {t("settings.lastName")}
                        </label>
                        <input
                          id="student-last-name"
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          aria-label={t("settings.lastName")}
                          className={`w-full px-4 py-2.5 bg-[#F3F4F6] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="mb-4">
                    <label
                      htmlFor="student-email"
                      className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                    >
                      {t("settings.email")}
                    </label>
                    <input
                      id="student-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      readOnly
                      aria-label={t("settings.email")}
                      className={`w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] bg-gray-50 cursor-not-allowed ${isRTL ? "text-right" : ""}`}
                    />
                  </div>

                  {/* SCFHS */}
                  <div className="mb-4">
                    <label
                      htmlFor="student-scfhs-number"
                      className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                    >
                      {t("settings.scfhsNumber")}
                    </label>
                    <input
                      id="student-scfhs-number"
                      type="text"
                      name="scfhsNumber"
                      value={formData.scfhsNumber}
                      onChange={handleInputChange}
                      aria-label={t("settings.scfhsNumber")}
                      placeholder={t("settings.scfhsPlaceholder")}
                      className={`w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                    />
                  </div>

                  {/* National ID */}
                  <div className="mb-4">
                    <label
                      htmlFor="student-national-id"
                      className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                    >
                      {t("settings.nationalId")}
                    </label>
                    <input
                      id="student-national-id"
                      type="text"
                      name="nationalId"
                      value={formData.nationalId}
                      onChange={handleInputChange}
                      aria-label={t("settings.nationalId")}
                      className={`w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                    />
                  </div>

                  {/* Nationality */}
                  <div className="mb-4">
                    <label
                      htmlFor="student-nationality"
                      className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                    >
                      {t("settings.nationality")}
                    </label>
                    <div className="relative">
                      <button
                        id="student-nationality"
                        type="button"
                        onClick={() => setNationalityOpen(!nationalityOpen)}
                        aria-label={t("settings.nationality")}
                        className={`w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}
                      >
                        <span
                          className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}
                        >
                          {formData.nationality && (
                            <span className="w-5 h-5 rounded-full bg-[#16A34A] flex items-center justify-center text-white text-xs">
                              🇸🇦
                            </span>
                          )}
                          {formData.nationality ||
                            t("settings.selectNationality")}
                        </span>
                        <ChevronDown
                          className={`w-5 h-5 text-[var(--color-text-secondary)] transition-transform ${nationalityOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {nationalityOpen && (
                        <div
                          className={`absolute top-full ${isRTL ? "right-0" : "left-0"} w-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10`}
                        >
                          {nationalities.map((nationality) => (
                            <button
                              key={nationality.value}
                              type="button"
                              onClick={() =>
                                handleNationalitySelect(nationality.value)
                              }
                              className={`w-full px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[#F9FAFB] transition-colors ${isRTL ? "text-right" : "text-left"} ${formData.nationality === nationality.value ? "bg-[#F3F4F6]" : ""}`}
                            >
                              {t(nationality.labelKey)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="mb-4">
                    <label
                      htmlFor="student-gender"
                      className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                    >
                      {t("settings.gender")}
                    </label>
                    <div className="relative">
                      <button
                        id="student-gender"
                        type="button"
                        onClick={() => setGenderOpen(!genderOpen)}
                        aria-label={t("settings.gender")}
                        className={`w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}
                      >
                        <span>
                          {formData.gender
                            ? t(
                                `settings.genders.${formData.gender}` as
                                  | "settings.genders.male"
                                  | "settings.genders.female",
                              )
                            : t("settings.selectGender")}
                        </span>
                        <ChevronDown
                          className={`w-5 h-5 text-[var(--color-text-secondary)] transition-transform ${genderOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {genderOpen && (
                        <div
                          className={`absolute top-full ${isRTL ? "right-0" : "left-0"} w-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10`}
                        >
                          {genders.map((gender) => (
                            <button
                              key={gender.value}
                              type="button"
                              onClick={() => handleGenderSelect(gender.value)}
                              className={`w-full px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[#F9FAFB] transition-colors ${isRTL ? "text-right" : "text-left"} ${formData.gender === gender.value ? "bg-[#F3F4F6]" : ""}`}
                            >
                              {t(gender.labelKey)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DOB */}
                  <div className="mb-4">
                    <label
                      htmlFor="student-dob"
                      className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                    >
                      {t("settings.dob")}
                    </label>
                    <div className="relative">
                      <input
                        id="student-dob"
                        type="text"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        placeholder="DD/MM/YYYY"
                        aria-label={t("settings.dob")}
                        className={`w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right pr-4 pl-10" : "pr-10"}`}
                      />
                      <Calendar
                        className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "left-3" : "right-3"}`}
                      />
                    </div>
                  </div>

                  {/* Biography */}
                  <div className="mb-6">
                    <label
                      htmlFor="student-biography"
                      className={`block text-sm font-medium text-[var(--color-text-primary)] mb-2 ${isRTL ? "text-right" : ""}`}
                    >
                      {t("settings.biography")}
                    </label>
                    <textarea
                      id="student-biography"
                      name="biography"
                      value={formData.biography}
                      onChange={handleInputChange}
                      rows={4}
                      aria-label={t("settings.biography")}
                      className={`w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent resize-none ${isRTL ? "text-right" : ""}`}
                    />
                  </div>

                  {/* Save */}
                  <div
                    className={`flex ${isRTL ? "justify-start" : "justify-end"}`}
                  >
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        setSaved(false);
                        try {
                          await profileApi.update({
                            firstName: formData.firstName,
                            lastName: formData.lastName,
                            bio: formData.biography,
                            scfhsNumber: formData.scfhsNumber || undefined,
                            nationalId: formData.nationalId || undefined,
                            nationality: formData.nationality || undefined,
                            gender: formData.gender || undefined,
                            dateOfBirth: formData.dob || undefined,
                          });
                          await refreshUser?.();
                          setSaved(true);
                          setTimeout(() => setSaved(false), 3000);
                        } catch {
                          // TODO: show error toast
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className="px-6 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saved ? (
                        <Check className="w-4 h-4" />
                      ) : null}
                      {saved
                        ? t("settings.saved")
                        : t("settings.saveChanges")}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Security Tab ── */}
              {activeTab === "security" && (
                <div dir={isRTL ? "rtl" : "ltr"}>
                  {security.loading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 animate-spin text-[#D4A520]" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
                        <TwoFactorToggle
                          enabled={security.twoFactorEnabled}
                          toggling={security.toggling}
                          onToggle={security.handleToggle2FA}
                        />
                      </div>
                      <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
                        <TrustedDevicesSection
                          devices={security.devices}
                          revokingId={security.revokingId}
                          revokingAll={security.revokingAll}
                          showRevokeAllConfirm={security.showRevokeAllConfirm}
                          onRevokeDevice={security.handleRevokeDevice}
                          onRevokeAll={security.handleRevokeAll}
                          onShowRevokeAllConfirm={
                            security.setShowRevokeAllConfirm
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Preferences Tab ── */}
              {activeTab === "preferences" && (
                <PreferencesTab t={t} isRTL={isRTL} />
              )}

              {/* ── Notifications Tab ── */}
              {activeTab === "notifications" && (
                <NotificationsTab t={t} isRTL={isRTL} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsContent;
