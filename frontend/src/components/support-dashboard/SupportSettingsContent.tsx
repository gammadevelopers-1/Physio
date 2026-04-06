"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { profileApi, supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
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

function SLAPolicyRow({ policy, isSupervisor, isSaving, onSave }: {
  policy: { priority: string; frtMinutes: number; ttrMinutes: number; escalateAfterMinutes: number };
  isSupervisor: boolean;
  isSaving: boolean;
  onSave: (data: { frtMinutes: number; ttrMinutes: number; escalateAfterMinutes: number }) => void;
}) {
  // Store inputs as strings so the user can fully clear the field. Using
  // `<input type="number">` with a numeric state causes two known bugs:
  //   (a) clearing the field triggers `Number("") === 0` → the field
  //       snaps to "0" and won't re-accept input cleanly
  //   (b) typing after a leading 0 (e.g. "0" → "32") can render as "032"
  //       because type=number inputs keep their own text state
  // Switching to `type="text" inputMode="numeric"` + string state avoids both.
  const [frt, setFrt] = useState(String(policy.frtMinutes));
  const [ttr, setTtr] = useState(String(policy.ttrMinutes));
  const [escalate, setEscalate] = useState(String(policy.escalateAfterMinutes));

  // Resync local state whenever the parent's policy updates (e.g. after a
  // successful save). Without this, the row would hold stale values.
  useEffect(() => {
    setFrt(String(policy.frtMinutes));
    setTtr(String(policy.ttrMinutes));
    setEscalate(String(policy.escalateAfterMinutes));
  }, [policy.frtMinutes, policy.ttrMinutes, policy.escalateAfterMinutes]);

  // Accept only digits; strip leading zeros but allow empty string while
  // the user is mid-edit. Max 6 digits (up to 999,999 minutes = ~1.9 years).
  const sanitize = (raw: string): string => {
    const digitsOnly = raw.replace(/[^0-9]/g, '').slice(0, 6);
    if (digitsOnly === '') return '';
    const stripped = digitsOnly.replace(/^0+/, '');
    return stripped === '' ? '0' : stripped;
  };

  const frtNum = frt === '' ? NaN : Number(frt);
  const ttrNum = ttr === '' ? NaN : Number(ttr);
  const escalateNum = escalate === '' ? NaN : Number(escalate);

  const hasChanges =
    frt !== String(policy.frtMinutes) ||
    ttr !== String(policy.ttrMinutes) ||
    escalate !== String(policy.escalateAfterMinutes);

  // Client-side validation (only check once the user has actually touched
  // something — `hasChanges` guards this in the UI below).
  const validationError = ((): string | null => {
    if (!Number.isInteger(frtNum) || frtNum < 1)
      return 'FRT must be a positive integer';
    if (!Number.isInteger(ttrNum) || ttrNum < 1)
      return 'TTR must be a positive integer';
    if (!Number.isInteger(escalateNum) || escalateNum < 1)
      return 'Escalate After must be a positive integer';
    if (ttrNum <= frtNum) return 'TTR must be greater than FRT';
    if (escalateNum > ttrNum) return 'Escalate After must be ≤ TTR';
    return null;
  })();
  const isValid = validationError === null;

  const priorityStyles: Record<string, string> = {
    high: 'bg-[#FEE2E2] text-[#EF4444]',
    medium: 'bg-[#FFEDD5] text-[#F97316]',
    low: 'bg-[#DCFCE7] text-[#22C55E]',
  };

  const inputBase =
    'w-24 h-9 px-3 border rounded-lg text-sm focus:outline-none disabled:bg-[#F9FAFB] disabled:text-[#9CA3AF]';
  const inputClass = (fieldError: boolean) =>
    `${inputBase} ${
      hasChanges && fieldError
        ? 'border-[#FECACA] focus:border-[#EF4444]'
        : 'border-[#E5E7EB] focus:border-[#002D87]'
    }`;

  return (
    <>
      <tr className="border-b border-[#F3F4F6]">
        <td className="py-3 px-4">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${priorityStyles[policy.priority] || ''}`}>
            {policy.priority}
          </span>
        </td>
        <td className="py-3 px-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={frt}
            onChange={(e) => setFrt(sanitize(e.target.value))}
            disabled={!isSupervisor || isSaving}
            className={inputClass(!Number.isInteger(frtNum) || frtNum < 1)}
          />
        </td>
        <td className="py-3 px-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={ttr}
            onChange={(e) => setTtr(sanitize(e.target.value))}
            disabled={!isSupervisor || isSaving}
            className={inputClass(
              !Number.isInteger(ttrNum) || ttrNum < 1 || ttrNum <= frtNum,
            )}
          />
        </td>
        <td className="py-3 px-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={escalate}
            onChange={(e) => setEscalate(sanitize(e.target.value))}
            disabled={!isSupervisor || isSaving}
            className={inputClass(
              !Number.isInteger(escalateNum) ||
                escalateNum < 1 ||
                escalateNum > ttrNum,
            )}
          />
        </td>
        <td className="py-3 px-4 text-right">
          {isSupervisor && hasChanges && (
            <button
              onClick={() =>
                onSave({
                  frtMinutes: frtNum,
                  ttrMinutes: ttrNum,
                  escalateAfterMinutes: escalateNum,
                })
              }
              disabled={isSaving || !isValid}
              className="px-3 py-1.5 bg-[#002D87] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          )}
        </td>
      </tr>
      {hasChanges && !isValid && (
        <tr>
          <td colSpan={5} className="px-4 pb-2">
            <p className="text-xs text-[#B91C1C]">{validationError}</p>
          </td>
        </tr>
      )}
    </>
  );
}

const SupportSettingsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user, refreshUser } = useAuth();
  const profile = useSupportProfile();
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

  // Macros state
  const [macrosList, setMacrosList] = useState<any[]>([]);
  const [macrosLoading, setMacrosLoading] = useState(false);
  const [showMacroForm, setShowMacroForm] = useState(false);
  const [editingMacro, setEditingMacro] = useState<any>(null);
  const [macroForm, setMacroForm] = useState({ title: '', bodyTemplate: '', kbArticleUrls: '' });
  const [macroSaving, setMacroSaving] = useState(false);

  // Escalation Paths state
  const [escalationPaths, setEscalationPaths] = useState<any[]>([]);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [editingEscalation, setEditingEscalation] = useState<any>(null);
  const [escalationForm, setEscalationForm] = useState<{
    name: string;
    steps: { afterMinutes: number; assignToRole: string }[];
  }>({ name: '', steps: [{ afterMinutes: 30, assignToRole: 'SUPPORT' }] });
  const [escalationSaving, setEscalationSaving] = useState(false);

  const handleSaveMacro = async () => {
    if (!macroForm.title.trim() || !macroForm.bodyTemplate.trim()) { toast.error('Title and body are required'); return; }
    setMacroSaving(true);
    try {
      const data = {
        title: macroForm.title.trim(),
        bodyTemplate: macroForm.bodyTemplate.trim(),
        kbArticleUrls: macroForm.kbArticleUrls ? macroForm.kbArticleUrls.split('\n').filter(Boolean) : [],
      };
      if (editingMacro) {
        await supportApi.updateMacro(editingMacro.id, data);
        toast.success('Macro updated');
      } else {
        await supportApi.createMacro(data);
        toast.success('Macro created');
      }
      setShowMacroForm(false);
      // Refresh list
      const refreshed = await supportApi.getMacros();
      setMacrosList(refreshed || []);
    } catch { toast.error('Failed to save macro'); }
    finally { setMacroSaving(false); }
  };

  const handleSaveEscalationPath = async () => {
    if (!escalationForm.name.trim()) { toast.error('Name is required'); return; }
    if (escalationForm.steps.length === 0) { toast.error('At least one step is required'); return; }
    for (let i = 0; i < escalationForm.steps.length; i++) {
      if (escalationForm.steps[i].afterMinutes < 1) {
        toast.error(`Step ${i + 1}: minutes must be >= 1`);
        return;
      }
      if (i > 0 && escalationForm.steps[i].afterMinutes <= escalationForm.steps[i - 1].afterMinutes) {
        toast.error(`Step ${i + 1} must have higher minutes than step ${i}`);
        return;
      }
    }
    setEscalationSaving(true);
    try {
      const data = {
        name: escalationForm.name.trim(),
        steps: escalationForm.steps,
      };
      if (editingEscalation) {
        await supportApi.updateEscalationPath(editingEscalation.id, data);
        toast.success('Escalation path updated');
      } else {
        await supportApi.createEscalationPath(data);
        toast.success('Escalation path created');
      }
      setShowEscalationForm(false);
      const refreshed = await supportApi.getEscalationPaths();
      setEscalationPaths(Array.isArray(refreshed) ? refreshed : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save';
      toast.error(typeof msg === 'string' ? msg : 'Failed to save');
    } finally {
      setEscalationSaving(false);
    }
  };

  // SLA policy states
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaError, setSlaError] = useState<string | null>(null);
  const [slaSaving, setSlaSaving] = useState<string | null>(null);

  const fetchSlaPolicies = useCallback(() => {
    setSlaLoading(true);
    setSlaError(null);
    supportApi.getSlaPolicies()
      .then((data) => setSlaPolicies(Array.isArray(data) ? data : []))
      .catch((err: any) => {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load SLA policies';
        setSlaError(typeof message === 'string' ? message : 'Failed to load SLA policies');
        toast.error('Failed to load SLA policies');
      })
      .finally(() => setSlaLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== 'sla') return;
    fetchSlaPolicies();
  }, [activeTab, fetchSlaPolicies]);

  useEffect(() => {
    if (activeTab === 'macros') {
      setMacrosLoading(true);
      supportApi.getMacros().then(data => setMacrosList(data || [])).catch(() => {}).finally(() => setMacrosLoading(false));
    }
    if (activeTab === 'escalation') {
      setEscalationLoading(true);
      supportApi
        .getEscalationPaths()
        .then((data) => setEscalationPaths(Array.isArray(data) ? data : []))
        .catch(() => toast.error('Failed to load escalation paths'))
        .finally(() => setEscalationLoading(false));
    }
  }, [activeTab]);

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

  const isSupervisorOrAdmin =
    user?.supportSubRole === "supervisor" ||
    user?.roles?.includes("ADMIN") ||
    user?.roles?.includes("SUPER_ADMIN");

  // Agents only see Profile. All operational configuration tabs
  // (SLA, Escalation, Macros, etc.) are supervisor/admin-only.
  // Agents access macros via the Apply Macro dropdown on the
  // ticket reply composer — they don't need a library view here.
  const allTabs = [
    { key: "profile", label: "Profile", icon: User, comingSoon: false, showFor: "all" as const },
    { key: "sla", label: t("settingsPage.tabs.sla"), icon: ShieldCheck, comingSoon: false, showFor: "supervisor" as const },
    { key: "escalation", label: "Escalation Paths", icon: Shield, comingSoon: false, showFor: "supervisor" as const },
    { key: "assignment", label: t("settingsPage.tabs.assignment"), icon: UserPlus, comingSoon: true, showFor: "supervisor" as const },
    { key: "macros", label: t("settingsPage.tabs.macros"), icon: MessageSquare, comingSoon: false, showFor: "supervisor" as const },
    { key: "notifications", label: t("settingsPage.tabs.notifications"), icon: Bell, comingSoon: true, showFor: "supervisor" as const },
    { key: "categories", label: t("settingsPage.tabs.categories"), icon: Tag, comingSoon: true, showFor: "supervisor" as const },
  ];
  const tabs = allTabs.filter(
    (tab) => tab.showFor === "all" || (tab.showFor === "supervisor" && isSupervisorOrAdmin),
  );

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
                  {activeTab !== "profile" && activeTab !== "sla" && activeTab !== "macros" && (
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

                  {/* SLA Targets */}
                  {activeTab === "sla" && (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                      <h3 className="text-base font-semibold text-[#1F2937] mb-4">SLA Targets</h3>
                      <p className="text-sm text-[#6B7280] mb-6">
                        Configure First Response Time and Time to Resolution targets per priority level.
                        Changes apply to future tickets only.
                      </p>
                      {slaLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#002D87]" /></div>
                      ) : slaError ? (
                        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4 flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#B91C1C]">Failed to load SLA policies</p>
                            <p className="text-xs text-[#991B1B] mt-0.5">{slaError}</p>
                          </div>
                          <button
                            type="button"
                            onClick={fetchSlaPolicies}
                            className="px-3 py-1.5 bg-white border border-[#FECACA] text-[#B91C1C] text-xs font-medium rounded-lg hover:bg-[#FEF2F2]"
                          >
                            Retry
                          </button>
                        </div>
                      ) : slaPolicies.length === 0 ? (
                        <div className="text-center py-8 text-sm text-[#6B7280]">
                          No SLA policies configured. Contact an administrator.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#E5E7EB]">
                                <th className="text-left py-3 px-4 font-medium text-[#6B7280]">Priority</th>
                                <th className="text-left py-3 px-4 font-medium text-[#6B7280]">FRT (minutes)</th>
                                <th className="text-left py-3 px-4 font-medium text-[#6B7280]">TTR (minutes)</th>
                                <th className="text-left py-3 px-4 font-medium text-[#6B7280]">Escalate After (min)</th>
                                <th className="text-right py-3 px-4 font-medium text-[#6B7280]"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {slaPolicies.map((policy) => (
                                <SLAPolicyRow
                                  key={policy.priority}
                                  policy={policy}
                                  isSupervisor={user?.supportSubRole === 'supervisor'}
                                  isSaving={slaSaving === policy.priority}
                                  onSave={async (data) => {
                                    setSlaSaving(policy.priority);
                                    try {
                                      const updated = await supportApi.updateSlaPolicy(policy.priority, data);
                                      setSlaPolicies(prev => prev.map(p => p.priority === policy.priority ? updated : p));
                                      toast.success('SLA policy updated');
                                    } catch (err: any) {
                                      const message =
                                        err?.response?.data?.message ||
                                        err?.message ||
                                        'Failed to update SLA policy';
                                      toast.error(typeof message === 'string' ? message : 'Failed to update');
                                    }
                                    finally { setSlaSaving(null); }
                                  }}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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

                  {/* Macros */}
                  {activeTab === "macros" && (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[#1F2937]">Reply Macros</h3>
                        {user?.supportSubRole === 'supervisor' && (
                          <button className="px-3 py-1.5 bg-[#002D87] text-white text-xs font-medium rounded-lg hover:opacity-90"
                            onClick={() => { setEditingMacro(null); setMacroForm({ title: '', bodyTemplate: '', kbArticleUrls: '' }); setShowMacroForm(true); }}>
                            + New Macro
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[#6B7280] mb-4">Pre-built reply templates with variable substitution. Variables: {'{{learner_name}}, {{course_name}}, {{ticket_id}}, {{agent_name}}'}</p>
                      {showMacroForm && (
                        <div className="mb-6 p-4 border border-[#C7D5F0] bg-[#F0F4FF] rounded-lg">
                          <h4 className="text-sm font-semibold text-[#002D87] mb-3">{editingMacro ? 'Edit Macro' : 'Create New Macro'}</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-[#374151] mb-1">Title *</label>
                              <input type="text" value={macroForm.title} onChange={e => setMacroForm(p => ({...p, title: e.target.value}))}
                                className="w-full h-9 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]" placeholder="e.g., Zoom Session Fix" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#374151] mb-1">Body Template *</label>
                              <p className="text-[10px] text-[#9CA3AF] mb-1">Click a variable to insert it at the cursor:</p>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {[
                                  { key: '{{learner_name}}', label: 'Learner Name' },
                                  { key: '{{course_name}}', label: 'Course Name' },
                                  { key: '{{ticket_id}}', label: 'Ticket ID' },
                                  { key: '{{agent_name}}', label: 'Agent Name' },
                                ].map(v => (
                                  <button
                                    key={v.key}
                                    type="button"
                                    onClick={() => {
                                      const el = document.getElementById('macro-body-textarea') as HTMLTextAreaElement | null;
                                      if (!el) {
                                        setMacroForm(p => ({...p, bodyTemplate: p.bodyTemplate + v.key}));
                                        return;
                                      }
                                      const start = el.selectionStart;
                                      const end = el.selectionEnd;
                                      const before = macroForm.bodyTemplate.slice(0, start);
                                      const after = macroForm.bodyTemplate.slice(end);
                                      setMacroForm(p => ({...p, bodyTemplate: before + v.key + after}));
                                      requestAnimationFrame(() => {
                                        el.selectionStart = el.selectionEnd = start + v.key.length;
                                        el.focus();
                                      });
                                    }}
                                    className="px-2 py-1 text-[11px] font-mono bg-[#EFF6FF] text-[#3B82F6] rounded border border-[#DBEAFE] hover:bg-[#DBEAFE] transition-colors"
                                  >
                                    {v.key}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                id="macro-body-textarea"
                                value={macroForm.bodyTemplate}
                                onChange={e => setMacroForm(p => ({...p, bodyTemplate: e.target.value}))}
                                rows={5}
                                maxLength={10000}
                                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm resize-none focus:outline-none focus:border-[#002D87]"
                                placeholder="Hi {{learner_name}}, thank you for reaching out..."
                              />
                              <p className="text-[10px] text-[#9CA3AF] text-right mt-0.5">{macroForm.bodyTemplate.length}/10,000</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#374151] mb-1">KB Article URLs (one per line)</label>
                              <textarea value={macroForm.kbArticleUrls} onChange={e => setMacroForm(p => ({...p, kbArticleUrls: e.target.value}))}
                                rows={2} className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm resize-none focus:outline-none focus:border-[#002D87]"
                                placeholder="https://..." />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSaveMacro} disabled={macroSaving}
                                className="px-4 py-1.5 bg-[#002D87] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50">
                                {macroSaving ? 'Saving...' : editingMacro ? 'Update' : 'Create'}
                              </button>
                              <button onClick={() => setShowMacroForm(false)} className="px-4 py-1.5 text-xs text-[#6B7280] hover:underline">Cancel</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {macrosLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#002D87]" /></div>
                      ) : macrosList.length === 0 ? (
                        <p className="text-center py-8 text-sm text-[#9CA3AF]">No macros created yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {macrosList.map(macro => (
                            <div key={macro.id} className="p-4 border border-[#E5E7EB] rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-[#1F2937]">{macro.title}</h4>
                                {user?.supportSubRole === 'supervisor' && (
                                  <div className="flex items-center">
                                    <button onClick={() => {
                                      setEditingMacro(macro);
                                      setMacroForm({ title: macro.title, bodyTemplate: macro.bodyTemplate, kbArticleUrls: (macro.kbArticleUrls || []).join('\n') });
                                      setShowMacroForm(true);
                                    }} className="text-xs text-[#002D87] hover:underline mr-2">Edit</button>
                                    <button onClick={async () => {
                                      if (confirm('Delete this macro?')) {
                                        await supportApi.deleteMacro(macro.id);
                                        setMacrosList(prev => prev.filter(m => m.id !== macro.id));
                                        toast.success('Macro deleted');
                                      }
                                    }} className="text-xs text-red-500 hover:underline">Delete</button>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-[#6B7280] whitespace-pre-wrap line-clamp-3">{macro.bodyTemplate}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Escalation Paths */}
                  {activeTab === "escalation" && (
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937]">Escalation Paths</h3>
                          <p className="text-sm text-[#6B7280] mt-1">
                            Define automatic ticket reassignment chains based on elapsed time.
                          </p>
                        </div>
                        {user?.supportSubRole === 'supervisor' && (
                          <button
                            className="px-3 py-1.5 bg-[#002D87] text-white text-xs font-medium rounded-lg hover:opacity-90"
                            onClick={() => {
                              setEditingEscalation(null);
                              setEscalationForm({ name: '', steps: [{ afterMinutes: 30, assignToRole: 'SUPPORT' }] });
                              setShowEscalationForm(true);
                            }}
                          >
                            + New Path
                          </button>
                        )}
                      </div>

                      {showEscalationForm && (
                        <div className="mb-6 p-4 border border-[#C7D5F0] bg-[#F0F4FF] rounded-lg">
                          <h4 className="text-sm font-semibold text-[#002D87] mb-3">
                            {editingEscalation ? 'Edit Escalation Path' : 'Create Escalation Path'}
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-[#374151] mb-1">Name *</label>
                              <input
                                type="text"
                                value={escalationForm.name}
                                onChange={(e) => setEscalationForm((p) => ({ ...p, name: e.target.value }))}
                                maxLength={100}
                                className="w-full h-9 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                                placeholder="e.g., Standard Escalation"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-[#374151] mb-2">
                                Steps (in ascending order of minutes)
                              </label>
                              {escalationForm.steps.map((step, i) => (
                                <div key={i} className="flex items-center gap-2 mb-2">
                                  <span className="text-xs text-[#6B7280] w-14 flex-shrink-0">Step {i + 1}:</span>
                                  <span className="text-xs text-[#6B7280]">After</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={String(step.afterMinutes)}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setEscalationForm((p) => ({
                                        ...p,
                                        steps: p.steps.map((s, j) =>
                                          j === i ? { ...s, afterMinutes: Number(val) || 0 } : s,
                                        ),
                                      }));
                                    }}
                                    className="w-20 h-8 px-2 border border-[#E5E7EB] rounded text-sm text-center focus:outline-none focus:border-[#002D87]"
                                  />
                                  <span className="text-xs text-[#6B7280]">min →</span>
                                  <select
                                    value={step.assignToRole}
                                    onChange={(e) =>
                                      setEscalationForm((p) => ({
                                        ...p,
                                        steps: p.steps.map((s, j) =>
                                          j === i ? { ...s, assignToRole: e.target.value } : s,
                                        ),
                                      }))
                                    }
                                    className="h-8 px-2 border border-[#E5E7EB] rounded text-sm focus:outline-none focus:border-[#002D87]"
                                  >
                                    <option value="SUPPORT">Support Agent</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="SUPER_ADMIN">Super Admin</option>
                                  </select>
                                  {escalationForm.steps.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEscalationForm((p) => ({
                                          ...p,
                                          steps: p.steps.filter((_, j) => j !== i),
                                        }))
                                      }
                                      className="text-xs text-red-500 hover:underline"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  setEscalationForm((p) => ({
                                    ...p,
                                    steps: [
                                      ...p.steps,
                                      {
                                        afterMinutes:
                                          (p.steps[p.steps.length - 1]?.afterMinutes || 0) + 30,
                                        assignToRole: 'ADMIN',
                                      },
                                    ],
                                  }))
                                }
                                className="text-xs text-[#002D87] hover:underline mt-1"
                              >
                                + Add Step
                              </button>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={handleSaveEscalationPath}
                                disabled={escalationSaving}
                                className="px-4 py-1.5 bg-[#002D87] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                              >
                                {escalationSaving
                                  ? 'Saving...'
                                  : editingEscalation
                                    ? 'Update'
                                    : 'Create'}
                              </button>
                              <button
                                onClick={() => setShowEscalationForm(false)}
                                className="px-4 py-1.5 text-xs text-[#6B7280] hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {escalationLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-[#002D87]" />
                        </div>
                      ) : escalationPaths.length === 0 ? (
                        <p className="text-center py-8 text-sm text-[#9CA3AF]">
                          No escalation paths configured.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {escalationPaths.map((path) => (
                            <div
                              key={path.id}
                              className="p-4 border border-[#E5E7EB] rounded-lg"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-[#1F2937]">
                                  {path.name}
                                </h4>
                                {user?.supportSubRole === 'supervisor' && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingEscalation(path);
                                        setEscalationForm({
                                          name: path.name,
                                          steps: path.steps || [],
                                        });
                                        setShowEscalationForm(true);
                                      }}
                                      className="text-xs text-[#002D87] hover:underline"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm('Delete this escalation path?')) {
                                          try {
                                            await supportApi.deleteEscalationPath(path.id);
                                            setEscalationPaths((prev) =>
                                              prev.filter((p) => p.id !== path.id),
                                            );
                                            toast.success('Escalation path deleted');
                                          } catch {
                                            toast.error('Failed to delete');
                                          }
                                        }
                                      }}
                                      className="text-xs text-red-500 hover:underline"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(path.steps as { afterMinutes: number; assignToRole: string }[]).map(
                                  (step, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-[#F3F4F6] rounded-full text-[#374151]"
                                    >
                                      After {step.afterMinutes}m → {step.assignToRole}
                                    </span>
                                  ),
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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
