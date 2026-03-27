"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { profileApi } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import SupportNavbar from "./SupportNavbar";
import {
  ShieldCheck,
  Shield,
  UserPlus,
  MessageSquare,
  Bell,
  Tag,
  Save,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  User,
  Settings,
} from "lucide-react";

const SupportSettingsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user, refreshUser } = useAuth();
  const profile = {
    name: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email : "",
    email: user?.email || "",
    resolved: 0,
    csat: 0,
    avgFRT: "--",
  };
  const [activeTab, setActiveTab] = useState("profile");

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Sync form state when user data loads/changes
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setPhone(user.phone || "");
    }
  }, [user]);

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setAvatarUploading(false);
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove photo");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await profileApi.update({ firstName, lastName, phone });
      await refreshUser();
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  // SLA Target states
  const [highFRT, setHighFRT] = useState(1);
  const [highResolution, setHighResolution] = useState(4);
  const [medFRT, setMedFRT] = useState(2);
  const [medResolution, setMedResolution] = useState(6);
  const [lowFRT, setLowFRT] = useState(4);
  const [lowResolution, setLowResolution] = useState(12);

  // Auto-assignment states
  const [selectedRule, setSelectedRule] = useState("roundRobin");
  const [ruleEnabled, setRuleEnabled] = useState<Record<string, boolean>>({
    roundRobin: true,
    leastBusy: false,
    skillBased: false,
  });

  // Notification toggle states
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [whatsappNotif, setWhatsappNotif] = useState(true);

  const tabs = [
    { key: "profile", label: "Profile", icon: User, comingSoon: false },
    { key: "sla", label: t("settingsPage.tabs.sla"), icon: ShieldCheck, comingSoon: true },
    { key: "assignment", label: t("settingsPage.tabs.assignment"), icon: UserPlus, comingSoon: true },
    { key: "macros", label: t("settingsPage.tabs.macros"), icon: MessageSquare, comingSoon: true },
    { key: "notifications", label: t("settingsPage.tabs.notifications"), icon: Bell, comingSoon: true },
    { key: "categories", label: t("settingsPage.tabs.categories"), icon: Tag, comingSoon: true },
  ];

  const assignmentRules = [
    {
      key: "roundRobin",
      title: t("settingsPage.assignment.rules.roundRobin"),
      description: t("settingsPage.assignment.rules.roundRobinDesc"),
    },
    {
      key: "leastBusy",
      title: t("settingsPage.assignment.rules.leastBusy"),
      description: t("settingsPage.assignment.rules.leastBusyDesc"),
    },
    {
      key: "skillBased",
      title: t("settingsPage.assignment.rules.skillBased"),
      description: t("settingsPage.assignment.rules.skillBasedDesc"),
    },
  ];

  const macros = [
    { id: "1", name: t("settingsPage.macros.items.greeting"), content: t("settingsPage.macros.contents.greeting"), category: "general" },
    { id: "2", name: t("settingsPage.macros.items.refundProcess"), content: t("settingsPage.macros.contents.refundProcess"), category: "billing" },
    { id: "3", name: t("settingsPage.macros.items.passwordReset"), content: t("settingsPage.macros.contents.passwordReset"), category: "login" },
    { id: "4", name: t("settingsPage.macros.items.escalation"), content: t("settingsPage.macros.contents.escalation"), category: "general" },
  ];

  const categories = [
    { name: t("ticketsBoard.categories.billing"), description: t("settingsPage.categories.descriptions.billing"), tickets: 45 },
    { name: t("ticketsBoard.categories.login"), description: t("settingsPage.categories.descriptions.login"), tickets: 38 },
    { name: t("ticketsBoard.categories.certificate"), description: t("settingsPage.categories.descriptions.certificate"), tickets: 28 },
    { name: t("ticketsBoard.categories.content"), description: t("settingsPage.categories.descriptions.content"), tickets: 22 },
    { name: t("ticketsBoard.categories.technical"), description: t("settingsPage.categories.descriptions.technical"), tickets: 18 },
  ];

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>

            <SupportMobileSidebar profile={profile} supportSubRole={user?.supportSubRole} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("settingsPage.subtitle")}
                </p>
                <Link
                  href={`/${locale}/dashboard/settings/security`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#a37f49] bg-[#a37f49]/10 hover:bg-[#a37f49]/20 rounded-lg transition-colors mt-3"
                >
                  <Shield className="w-4 h-4" />
                  Personal Security Settings
                </Link>
              </div>

              {/* Settings Card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                {/* Tabs */}
                <div className="px-5 overflow-x-auto">
                  <div className="flex flex-wrap border-b border-[#E5E7EB]">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`px-3 py-2.5 text-xs sm:text-sm font-medium relative transition-colors whitespace-nowrap flex items-center gap-1 ${
                            activeTab === tab.key
                              ? "text-[#a37f49]"
                              : "text-[#6B7280] hover:text-[#374151]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {tab.label}
                          {tab.comingSoon && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[#F3F4F6] text-[#9CA3AF] leading-none">
                              Soon
                            </span>
                          )}
                          {activeTab === tab.key && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#a37f49] rounded-t" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-5">
                  {/* Profile */}
                  {activeTab === "profile" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-6">
                        Profile Information
                      </h3>

                      {/* Avatar Section */}
                      <div className="flex items-center gap-5 mb-8">
                        <div className="relative">
                          <div className="w-20 h-20 rounded-full overflow-hidden bg-[#F3F4F6] border-2 border-[#E5E7EB] flex items-center justify-center">
                            {avatarUploading ? (
                              <Loader2 className="w-6 h-6 text-[#9CA3AF] animate-spin" />
                            ) : user?.avatar ? (
                              <img
                                src={user.avatar}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-8 h-8 text-[#9CA3AF]" />
                            )}
                          </div>
                          <button
                            onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                            className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#a37f49] text-white rounded-full flex items-center justify-center shadow-sm hover:bg-[#8c6a3a] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {avatarMenuOpen && (
                            <div
                              ref={avatarMenuRef}
                              className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1 z-20 min-w-[160px]"
                            >
                              <button
                                onClick={() => {
                                  avatarInputRef.current?.click();
                                  closeAvatarMenu();
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                              >
                                <Upload className="w-4 h-4" />
                                Upload Photo
                              </button>
                              {user?.avatar && (
                                <button
                                  onClick={() => {
                                    handleRemoveAvatar();
                                    closeAvatarMenu();
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Remove Photo
                                </button>
                              )}
                            </div>
                          )}
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#111827]">Profile Photo</p>
                          <p className="text-xs text-[#6B7280] mt-0.5">
                            JPG, PNG or GIF. Max 2MB.
                          </p>
                        </div>
                      </div>

                      {/* Form Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            First Name
                          </label>
                          <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Enter first name"
                            className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#a37f49] focus:ring-1 focus:ring-[#a37f49] transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Enter last name"
                            className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#a37f49] focus:ring-1 focus:ring-[#a37f49] transition-colors"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            Email
                          </label>
                          <input
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] bg-[#F9FAFB] cursor-not-allowed"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-[#374151] mb-1.5">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Enter phone number"
                            className="w-full px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:border-[#a37f49] focus:ring-1 focus:ring-[#a37f49] transition-colors"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleProfileSave}
                        disabled={profileSaving}
                        className="mt-6 flex items-center gap-1.5 px-5 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
                      >
                        {profileSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {profileSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  )}

                  {/* Coming Soon Overlay for other tabs */}
                  {activeTab !== "profile" && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-[#F3F4F6] flex items-center justify-center mb-4">
                        <Settings className="w-7 h-7 text-[#9CA3AF]" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#111827] mb-2">Coming Soon</h3>
                      <p className="text-sm text-[#6B7280] max-w-md">
                        This feature is currently under development and will be available in an upcoming sprint. Stay tuned!
                      </p>
                    </div>
                  )}

                  {/* SLA Targets (hidden behind Coming Soon) */}
                  {false && activeTab === "sla" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-4">
                        {t("settingsPage.sla.title")}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.sla.priority")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.sla.firstResponseTarget")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.sla.resolutionTarget")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-[#F3F4F6]">
                              <td className="py-3 px-5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEE2E2] text-[#DC2626]">
                                  {t("settingsPage.sla.high")}
                                </span>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={highFRT}
                                    onChange={(e) => setHighFRT(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:border-[#a37f49]"
                                  />
                                  <span className="text-[13px] text-[#6B7280]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={highResolution}
                                    onChange={(e) => setHighResolution(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:border-[#a37f49]"
                                  />
                                  <span className="text-[13px] text-[#6B7280]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                            </tr>
                            <tr className="border-b border-[#F3F4F6]">
                              <td className="py-3 px-5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#FEF9C3] text-[#CA8A04]">
                                  {t("settingsPage.sla.medium")}
                                </span>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={medFRT}
                                    onChange={(e) => setMedFRT(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:border-[#a37f49]"
                                  />
                                  <span className="text-[13px] text-[#6B7280]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={medResolution}
                                    onChange={(e) => setMedResolution(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:border-[#a37f49]"
                                  />
                                  <span className="text-[13px] text-[#6B7280]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                            </tr>
                            <tr className="border-b border-[#F3F4F6]">
                              <td className="py-3 px-5">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#DCFCE7] text-[#16A34A]">
                                  {t("settingsPage.sla.low")}
                                </span>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={lowFRT}
                                    onChange={(e) => setLowFRT(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:border-[#a37f49]"
                                  />
                                  <span className="text-[13px] text-[#6B7280]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                              <td className="py-3 px-5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={lowResolution}
                                    onChange={(e) => setLowResolution(Number(e.target.value))}
                                    className="w-20 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:border-[#a37f49]"
                                  />
                                  <span className="text-[13px] text-[#6B7280]">{t("settingsPage.sla.hours")}</span>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Auto-Assignment */}
                  {false && activeTab === "assignment" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-4">
                        {t("settingsPage.assignment.title")}
                      </h3>
                      <div className="space-y-4">
                        {assignmentRules.map((rule) => {
                          const isActive = selectedRule === rule.key;
                          const enabled = ruleEnabled[rule.key];
                          return (
                            <div
                              key={rule.key}
                              onClick={() => setSelectedRule(rule.key)}
                              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                                isActive
                                  ? "ring-1 ring-[#a37f49] border-[#a37f49] bg-[#FDF6EC]"
                                  : "border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#D1D5DB]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                      isActive ? "border-[#a37f49]" : "border-[#D1D5DB]"
                                    }`}
                                  >
                                    {isActive && (
                                      <div className="w-2.5 h-2.5 rounded-full bg-[#a37f49]" />
                                    )}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-semibold ${isActive ? "text-[#a37f49]" : "text-[#111827]"}`}>
                                      {rule.title}
                                    </p>
                                    <p className="text-[12px] text-[#6B7280] mt-0.5">
                                      {rule.description}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRuleEnabled((prev) => ({ ...prev, [rule.key]: !prev[rule.key] }));
                                  }}
                                  className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                                    enabled ? "bg-[#a37f49]" : "bg-[#E5E7EB]"
                                  }`}
                                >
                                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${enabled ? "ms-auto" : ""}`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Canned Responses */}
                  {false && activeTab === "macros" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[#111827]">
                          {t("settingsPage.macros.title")}
                        </h3>
                        <button className="flex items-center gap-1.5 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                          <Plus className="w-4 h-4" />
                          {t("settingsPage.macros.addMacro")}
                        </button>
                      </div>
                      <div className="space-y-4">
                        {macros.map((macro) => (
                          <div key={macro.id} className="p-5 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-[#111827]">{macro.name}</p>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#EFF6FF] text-[#3B82F6]">
                                    {macro.category}
                                  </span>
                                </div>
                                <p className="text-[13px] text-[#6B7280] line-clamp-2">{macro.content}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Notifications */}
                  {false && activeTab === "notifications" && (
                    <div>
                      <h3 className="text-base font-semibold text-[#111827] mb-4">
                        {t("settingsPage.notifications.title")}
                      </h3>
                      <div className="space-y-4">
                        <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#111827]">{t("settingsPage.notifications.email")}</p>
                              <p className="text-[12px] text-[#6B7280] mt-0.5">{t("settingsPage.notifications.emailDesc")}</p>
                            </div>
                            <button
                              onClick={() => setEmailNotif(!emailNotif)}
                              className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${emailNotif ? "bg-[#a37f49]" : "bg-[#E5E7EB]"}`}
                            >
                              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${emailNotif ? "ms-auto" : ""}`} />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#111827]">{t("settingsPage.notifications.sms")}</p>
                              <p className="text-[12px] text-[#6B7280] mt-0.5">{t("settingsPage.notifications.smsDesc")}</p>
                            </div>
                            <button
                              onClick={() => setSmsNotif(!smsNotif)}
                              className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${smsNotif ? "bg-[#a37f49]" : "bg-[#E5E7EB]"}`}
                            >
                              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${smsNotif ? "ms-auto" : ""}`} />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#111827]">{t("settingsPage.notifications.whatsapp")}</p>
                              <p className="text-[12px] text-[#6B7280] mt-0.5">{t("settingsPage.notifications.whatsappDesc")}</p>
                            </div>
                            <button
                              onClick={() => setWhatsappNotif(!whatsappNotif)}
                              className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${whatsappNotif ? "bg-[#a37f49]" : "bg-[#E5E7EB]"}`}
                            >
                              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${whatsappNotif ? "ms-auto" : ""}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
                    </div>
                  )}

                  {/* Categories */}
                  {false && activeTab === "categories" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[#111827]">
                          {t("settingsPage.categories.title")}
                        </h3>
                        <button className="flex items-center gap-1.5 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                          <Plus className="w-4 h-4" />
                          {t("settingsPage.categories.addCategory")}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.name")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.description")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.tickets")}
                              </th>
                              <th className={`py-3 px-5 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("settingsPage.categories.actions")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {categories.map((category, index) => (
                              <tr key={index} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                                <td className="py-3 px-5 text-[13px] font-medium text-[#111827]">{category.name}</td>
                                <td className="py-3 px-5 text-[13px] text-[#6B7280] hidden md:table-cell">{category.description}</td>
                                <td className="py-3 px-5 text-[13px] font-semibold text-[#111827]">{category.tickets}</td>
                                <td className="py-3 px-5">
                                  <div className="flex items-center gap-2">
                                    <button className="p-1.5 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button className="p-1.5 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button className="mt-4 flex items-center gap-1.5 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                        <Save className="w-4 h-4" />
                        {t("settingsPage.save")}
                      </button>
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

export default SupportSettingsContent;
