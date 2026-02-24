"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, ChevronDown, Calendar, Loader2, Shield, Check } from "lucide-react";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { profileApi } from "@/lib/api";

const SettingsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { user, refreshUser } = useAuth();

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
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const security = useSecuritySettings();

  // Populate form with real user data
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        scfhsNumber: "",
        nationalId: "",
        nationality: "",
        gender: "",
        dob: "",
        biography: "",
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={userData} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={userData} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1
                className={`text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6 ${isRTL ? "text-right" : ""}`}
              >
                {t("settings.title")}
              </h1>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 bg-[#F3F4F6] rounded-lg p-1">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "profile"
                      ? "bg-white text-[#1F2937] shadow-sm"
                      : "text-[#6B7280] hover:text-[#1F2937]"
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  {t("settings.tabProfile")}
                </button>
                <button
                  onClick={() => setActiveTab("security")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "security"
                      ? "bg-white text-[#1F2937] shadow-sm"
                      : "text-[#6B7280] hover:text-[#1F2937]"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  {t("settings.tabSecurity")}
                </button>
              </div>

              {activeTab === "profile" && (
              <div
                className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6"
                dir={isRTL ? "rtl" : "ltr"}
              >
                {/* Profile Avatar and Name Fields */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">
                  {/* Avatar */}
                  <div className="flex-shrink-0 flex justify-center sm:justify-start">
                    <div className="relative">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gray-100">
                        <Image
                          src={userData.avatar || "/images/default-avatar.png"}
                          alt={userData.name}
                          width={96}
                          height={96}
                          className="object-cover w-full h-full"
                          unoptimized={!!userData.avatar}
                        />
                      </div>
                      <button
                        className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#002D87] rounded-full flex items-center justify-center border-2 border-white`}
                        aria-label={t("settings.changePhoto")}
                      >
                        <Pencil className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>

                  {/* First Name and Last Name */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* First Name */}
                    <div>
                      <label
                        className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                      >
                        {t("settings.firstName")}
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                      />
                    </div>

                    {/* Last Name */}
                    <div>
                      <label
                        className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                      >
                        {t("settings.lastName")}
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-2.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label
                    className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("settings.email")}
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                  />
                </div>

                {/* SCFHS Number */}
                <div className="mb-4">
                  <label
                    className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("settings.scfhsNumber")}
                  </label>
                  <input
                    type="text"
                    name="scfhsNumber"
                    value={formData.scfhsNumber}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                  />
                </div>

                {/* National ID */}
                <div className="mb-4">
                  <label
                    className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("settings.nationalId")}
                  </label>
                  <input
                    type="text"
                    name="nationalId"
                    value={formData.nationalId}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right" : ""}`}
                  />
                </div>

                {/* Nationality */}
                <div className="mb-4">
                  <label
                    className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("settings.nationality")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setNationalityOpen(!nationalityOpen)}
                      className={`w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}
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
                        className={`w-5 h-5 text-[#6B7280] transition-transform ${nationalityOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {nationalityOpen && (
                      <div
                        className={`absolute top-full ${isRTL ? "right-0" : "left-0"} w-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10`}
                      >
                        {nationalities.map((nationality) => (
                          <button
                            key={nationality.value}
                            type="button"
                            onClick={() =>
                              handleNationalitySelect(nationality.value)
                            }
                            className={`w-full px-4 py-2.5 text-sm text-[#1F2937] hover:bg-[#F9FAFB] transition-colors ${isRTL ? "text-right" : "text-left"} ${formData.nationality === nationality.value ? "bg-[#F3F4F6]" : ""}`}
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
                    className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("settings.gender")}
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setGenderOpen(!genderOpen)}
                      className={`w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <span>
                        {formData.gender
                          ? t(
                              `settings.genders.${formData.gender}` as
                                | "settings.genders.male"
                                | "settings.genders.female"
                            )
                          : t("settings.selectGender")}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#6B7280] transition-transform ${genderOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {genderOpen && (
                      <div
                        className={`absolute top-full ${isRTL ? "right-0" : "left-0"} w-full mt-1 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10`}
                      >
                        {genders.map((gender) => (
                          <button
                            key={gender.value}
                            type="button"
                            onClick={() => handleGenderSelect(gender.value)}
                            className={`w-full px-4 py-2.5 text-sm text-[#1F2937] hover:bg-[#F9FAFB] transition-colors ${isRTL ? "text-right" : "text-left"} ${formData.gender === gender.value ? "bg-[#F3F4F6]" : ""}`}
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
                    className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("settings.dob")}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="dob"
                      value={formData.dob}
                      onChange={handleInputChange}
                      placeholder="DD/MM/YYYY"
                      className={`w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent ${isRTL ? "text-right pr-4 pl-10" : "pr-10"}`}
                    />
                    <Calendar
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280] ${isRTL ? "left-3" : "right-3"}`}
                    />
                  </div>
                </div>

                {/* Biography */}
                <div className="mb-6">
                  <label
                    className={`block text-sm font-medium text-[#1F2937] mb-2 ${isRTL ? "text-right" : ""}`}
                  >
                    {t("settings.biography")}
                  </label>
                  <textarea
                    name="biography"
                    value={formData.biography}
                    onChange={handleInputChange}
                    rows={4}
                    className={`w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#D4A520] focus:border-transparent resize-none ${isRTL ? "text-right" : ""}`}
                  />
                </div>

                {/* Save Button */}
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
                    {saved ? t("settings.saved") : t("settings.saveChanges")}
                  </button>
                </div>
              </div>
              )}

              {activeTab === "security" && (
                <div dir={isRTL ? "rtl" : "ltr"}>
                  {security.loading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 animate-spin text-[#D4A520]" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                        <TwoFactorToggle
                          enabled={security.twoFactorEnabled}
                          toggling={security.toggling}
                          onToggle={security.handleToggle2FA}
                        />
                      </div>
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                        <TrustedDevicesSection
                          devices={security.devices}
                          revokingId={security.revokingId}
                          revokingAll={security.revokingAll}
                          showRevokeAllConfirm={security.showRevokeAllConfirm}
                          onRevokeDevice={security.handleRevokeDevice}
                          onRevokeAll={security.handleRevokeAll}
                          onShowRevokeAllConfirm={security.setShowRevokeAllConfirm}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsContent;
