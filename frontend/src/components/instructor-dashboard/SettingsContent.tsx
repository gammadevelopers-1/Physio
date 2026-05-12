"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { User as UserIcon, Shield, Bell } from "lucide-react";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useUser } from "@/contexts/AuthContext";
import {
  ProfileSection,
  SecuritySection,
  PreferencesInline,
  MasterNotificationToggles,
} from "@/components/settings";

type TabKey = "profile" | "security" | "notifications";

const SettingsContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard.settings");
  const tCommon = useTranslations("commonSettings");
  const user = useUser();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // Trainer-application profile fields. Pre-filled from the user's row
  // (which is seeded from role_requests.profileData on approval). Edits
  // flow through profileApi.update via ProfileSection's extraSavePayload.
  const [bio, setBio] = useState("");
  const [profession, setProfession] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [qualification, setQualification] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");

  useEffect(() => {
    if (!user) return;
    const u = user as unknown as Record<string, string | null | undefined>;
    setBio(u.bio || "");
    setProfession(u.profession || "");
    setSpecialty(u.specialty || "");
    setQualification(u.qualification || "");
    setTwitter(u.twitter || "");
    setLinkedin(u.linkedin || "");
  }, [user]);

  // 3 tabs only — same shape as student/manager. Preferences is folded
  // into the Profile tab; Notifications is the 2-master-toggle panel.
  const tabs: { id: TabKey; label: string; icon: React.ElementType }[] = [
    { id: "profile", label: tCommon("tabProfile"), icon: UserIcon },
    { id: "security", label: tCommon("tabSecurity"), icon: Shield },
    { id: "notifications", label: tCommon("tabNotifications"), icon: Bell },
  ];

  const inputClass =
    "w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]";
  const labelClass =
    "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5";

  // Professional info block — values flow into ProfileSection's
  // extraSavePayload so they save with the same Save button.
  const professionalFields = (
    <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
        {isRTL ? "المعلومات المهنية" : "Professional Information"}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="instructor-profession" className={labelClass}>
            {isRTL ? "المهنة" : "Profession"}
          </label>
          <input
            id="instructor-profession"
            type="text"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            maxLength={255}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="instructor-specialty" className={labelClass}>
            {isRTL ? "التخصص" : "Specialty"}
          </label>
          <input
            id="instructor-specialty"
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            maxLength={100}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="instructor-qualification" className={labelClass}>
            {isRTL ? "المؤهل" : "Qualification"}
          </label>
          <input
            id="instructor-qualification"
            type="text"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            maxLength={500}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="instructor-bio" className={labelClass}>
            {isRTL ? "السيرة الذاتية" : "Bio"}
          </label>
          <textarea
            id="instructor-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={1000}
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label htmlFor="instructor-twitter" className={labelClass}>
            {isRTL ? "تويتر" : "Twitter"}
          </label>
          <input
            id="instructor-twitter"
            type="text"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="@handle"
            maxLength={255}
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div>
          <label htmlFor="instructor-linkedin" className={labelClass}>
            {isRTL ? "لينكدإن" : "LinkedIn"}
          </label>
          <input
            id="instructor-linkedin"
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/..."
            maxLength={500}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>
    </div>
  );

  const extraSavePayload = {
    bio,
    profession,
    specialty,
    qualification,
    twitter,
    linkedin,
  };

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 space-y-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("subtitle")}</p>
              </div>

              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      aria-current={activeTab === tab.id ? "page" : undefined}
                      className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === tab.id
                          ? "text-[var(--color-primary)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
                  {activeTab === "profile" && (
                    <ProfileSection
                      idPrefix="instructor"
                      showArabicNames
                      showPhone
                      extraFields={
                        <>
                          {professionalFields}
                          <PreferencesInline />
                        </>
                      }
                      extraSavePayload={extraSavePayload}
                    />
                  )}
                  {activeTab === "security" && <SecuritySection idPrefix="instructor" />}
                  {activeTab === "notifications" && <MasterNotificationToggles />}
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
