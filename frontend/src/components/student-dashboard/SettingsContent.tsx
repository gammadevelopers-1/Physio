"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { User as UserIcon, Shield, Bell, ChevronDown, Lock } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import OfflineBanner from "./OfflineBanner";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useUser } from "@/contexts/AuthContext";
import {
  ProfileSection,
  SecuritySection,
  PreferencesInline,
  MasterNotificationToggles,
  PrivacySection,
} from "@/components/settings";
import DatePicker from "@/components/ui/DatePicker";

type TabKey = "profile" | "security" | "notifications" | "privacy";

interface StudentExtras {
  scfhsNumber: string;
  nationalId: string;
  gender: string;
  dateOfBirth: string;
  bio: string;
}

const SettingsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.settings");
  const tCommon = useTranslations("commonSettings");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const user = useUser();

  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [extras, setExtras] = useState<StudentExtras>({
    scfhsNumber: "",
    nationalId: "",
    gender: "",
    dateOfBirth: "",
    bio: "",
  });

  // National ID becomes uneditable once the user has saved a value.
  // For users who pre-date this feature it's null, so the input is shown.
  const lockedNationalId = !!user?.nationalId;

  useEffect(() => {
    if (!user) return;
    setExtras({
      scfhsNumber: user.scfhsNumber || "",
      nationalId: user.nationalId || "",
      gender: user.gender || "",
      dateOfBirth: user.dateOfBirth || "",
      bio: user.bio || "",
    });
  }, [user]);

  // Profile + Security + Notifications only — Preferences (lang/cal/a11y/privacy)
  // is folded INTO Profile to reduce tab count and remove unused sections.
  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "profile", label: tCommon("tabProfile"), icon: UserIcon },
    { key: "security", label: tCommon("tabSecurity"), icon: Shield },
    { key: "notifications", label: tCommon("tabNotifications"), icon: Bell },
    { key: "privacy", label: tCommon("tabPrivacy"), icon: Lock },
  ];

  // Send empty strings as undefined so we don't clobber existing values when user hasn't touched a field.
  // National ID is only sent when the user is setting it for the first
  // time (lockedNationalId === false). The backend rejects any change
  // attempt once a value exists, so we never send it for locked users.
  const extrasPayload = {
    scfhsNumber: extras.scfhsNumber || undefined,
    nationalId: !lockedNationalId && extras.nationalId.trim() ? extras.nationalId.trim() : undefined,
    gender: extras.gender || undefined,
    dateOfBirth: extras.dateOfBirth || undefined,
    bio: extras.bio || undefined,
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              <h1 className={`text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-4 sm:mb-6 ${isRTL ? "text-right" : ""}`}>
                {t("title")}
              </h1>

              <OfflineBanner />

              {/* Tabs + content card */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      aria-current={activeTab === tab.key ? "page" : undefined}
                      className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === tab.key
                          ? "text-[var(--color-primary)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                      {activeTab === tab.key && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5 md:p-6">
                  {activeTab === "profile" && (
                    <div className="space-y-6">
                      <ProfileSection
                        idPrefix="student"
                        showArabicNames
                        showPhone
                        extraFields={
                          <>
                            <StudentExtraFields extras={extras} setExtras={setExtras} lockedNationalId={lockedNationalId} />
                            <PreferencesInline />
                          </>
                        }
                        extraSavePayload={extrasPayload}
                      />
                    </div>
                  )}
                  {activeTab === "security" && <SecuritySection idPrefix="student" />}
                  {activeTab === "notifications" && <MasterNotificationToggles />}
                  {activeTab === "privacy" && <PrivacySection />}
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

/* ─── Student-only profile extras (SCFHS, gender, DOB, biography) ─── */

function StudentExtraFields({
  extras,
  setExtras,
  lockedNationalId,
}: {
  extras: StudentExtras;
  setExtras: React.Dispatch<React.SetStateAction<StudentExtras>>;
  lockedNationalId: boolean;
}) {
  const t = useTranslations("studentDashboard.settings");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [genderOpen, setGenderOpen] = useState(false);

  const update = <K extends keyof StudentExtras>(key: K, value: StudentExtras[K]) =>
    setExtras((prev) => ({ ...prev, [key]: value }));

  const genders = [
    { value: "male", labelKey: "genders.male" },
    { value: "female", labelKey: "genders.female" },
  ];

  return (
    <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="student-scfhs-number" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("scfhsNumber")}
          </label>
          <input
            id="student-scfhs-number"
            type="text"
            value={extras.scfhsNumber}
            onChange={(e) => update("scfhsNumber", e.target.value)}
            placeholder={t("scfhsPlaceholder")}
            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
          />
        </div>

        {/* National ID / Iqama — locked once set. New users have a value
            from registration (always locked). Legacy users start empty
            and may set it ONCE; the backend rejects further changes. */}
        <div>
          <label htmlFor="student-national-id" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("nationalId")}
            {lockedNationalId && (
              <span className="ml-1 text-xs text-[var(--color-text-secondary)] font-normal">
                ({t("nationalIdLocked")})
              </span>
            )}
          </label>
          <input
            id="student-national-id"
            type="text"
            value={extras.nationalId}
            onChange={(e) => {
              if (lockedNationalId) return;
              update("nationalId", e.target.value.replace(/[^0-9]/g, "").slice(0, 10));
            }}
            disabled={lockedNationalId}
            inputMode="numeric"
            maxLength={10}
            dir="ltr"
            placeholder={t("nationalIdPlaceholder")}
            className={`w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] ${
              lockedNationalId ? "bg-[var(--color-border-subtle)] cursor-not-allowed opacity-70" : ""
            }`}
          />
          {!lockedNationalId && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("nationalIdHint")}</p>
          )}
        </div>

        <div>
          <label htmlFor="student-gender" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("gender")}
          </label>
          <div className="relative">
            <button
              id="student-gender"
              type="button"
              onClick={() => setGenderOpen((v) => !v)}
              className={`w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}
            >
              <span>{extras.gender ? t(`genders.${extras.gender}` as "genders.male" | "genders.female") : t("selectGender")}</span>
              <ChevronDown className={`w-4 h-4 text-[var(--color-text-secondary)] transition-transform ${genderOpen ? "rotate-180" : ""}`} />
            </button>
            {genderOpen && (
              <div className={`absolute top-full ${isRTL ? "right-0" : "left-0"} w-full mt-1 bg-[var(--color-surface-card)] border border-[var(--color-input-border)] rounded-lg shadow-lg z-10`}>
                {genders.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => { update("gender", g.value); setGenderOpen(false); }}
                    className={`w-full px-3 py-2 text-sm hover:bg-[var(--color-border-subtle)] transition-colors ${isRTL ? "text-right" : "text-left"} ${extras.gender === g.value ? "bg-[var(--color-border-subtle)]" : ""}`}
                  >
                    {t(g.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="student-dob" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("dob")}
          </label>
          <DatePicker
            id="student-dob"
            value={extras.dateOfBirth}
            onChange={(v) => update("dateOfBirth", v)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="student-biography" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          {t("biography")}
        </label>
        <textarea
          id="student-biography"
          value={extras.bio}
          onChange={(e) => update("bio", e.target.value)}
          rows={4}
          className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] resize-none"
        />
      </div>
    </div>
  );
}

