"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { toast } from "sonner";
import SupportSidebar from "./SupportSidebar";
import SupportNavbar from "./SupportNavbar";
import { ProfileSection, PreferencesInline } from "@/components/settings";
import { profileApi } from "@/lib/api";
import { useSecuritySettings } from "@/components/shared/useSecuritySettings";
import TwoFactorToggle from "@/components/shared/TwoFactorToggle";
import TrustedDevicesSection from "@/components/shared/TrustedDevicesSection";
import PasswordPolicyHint from "@/components/shared/PasswordPolicyHint";
import { usePasswordPolicy, checkPasswordAgainstPolicy } from "@/hooks/usePasswordPolicy";
import { FmtDate } from "@/components/ui/Fmt";
import {
  ShieldCheck,
  Shield,
  UserPlus,
  MessageSquare,
  Bell,
  Tag,
  Save,
  Plus,
  Trash2,
  Loader2,
  User,
  Settings,
  Clock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Smartphone,
} from "lucide-react";

// Format a minute value as a friendly time hint. Show the smallest
// unit that divides cleanly — falls back to "Xh Ym" for awkward
// values so users glance and know "480 = 8h", "1440 = 1d", etc.
function formatMinutesHint(min: number, t: (k: string, v?: Record<string, any>) => string): string | null {
  if (!Number.isFinite(min) || min <= 0) return null;
  if (min < 60) return null; // already obvious
  if (min % 1440 === 0) {
    const d = min / 1440;
    return t("settingsPage.slaPanel.hintDays", { n: d });
  }
  if (min % 60 === 0) {
    const h = min / 60;
    return t("settingsPage.slaPanel.hintHours", { n: h });
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return t("settingsPage.slaPanel.hintHoursMinutes", { h, m });
}

function SLAPolicyRow({ policy, canEdit, isSaving, onSave, t }: {
  policy: { priority: string; frtMinutes: number; ttrMinutes: number; escalateAfterMinutes: number };
  canEdit: boolean;
  isSaving: boolean;
  onSave: (data: { frtMinutes: number; ttrMinutes: number; escalateAfterMinutes: number }) => void;
  t: (key: string, vars?: Record<string, any>) => string;
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
      return t('settingsPage.slaPanel.validation.frtPositive');
    if (!Number.isInteger(ttrNum) || ttrNum < 1)
      return t('settingsPage.slaPanel.validation.ttrPositive');
    if (!Number.isInteger(escalateNum) || escalateNum < 1)
      return t('settingsPage.slaPanel.validation.escalatePositive');
    if (ttrNum <= frtNum) return t('settingsPage.slaPanel.validation.ttrGreaterThanFrt');
    if (escalateNum > ttrNum) return t('settingsPage.slaPanel.validation.escalateLessThanTtr');
    return null;
  })();
  const isValid = validationError === null;

  const priorityStyles: Record<string, string> = {
    high: 'bg-[#FEE2E2] text-[#EF4444]',
    medium: 'bg-[#FFEDD5] text-[#F97316]',
    low: 'bg-[#DCFCE7] text-[#22C55E]',
  };

  const inputBase =
    'w-24 h-9 px-3 border rounded-lg text-sm focus:outline-none disabled:bg-[var(--color-surface-page)] disabled:text-[var(--color-text-secondary)]';
  const inputClass = (fieldError: boolean) =>
    `${inputBase} ${
      hasChanges && fieldError
        ? 'border-[#FECACA] focus:border-[#EF4444]'
        : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'
    }`;

  return (
    <>
      <tr className="border-b border-[var(--color-border-subtle)]">
        <td className="py-3 px-4">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${priorityStyles[policy.priority] || ''}`}>
            {policy.priority}
          </span>
        </td>
        <td className="py-3 px-4 align-top">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={frt}
            onChange={(e) => setFrt(sanitize(e.target.value))}
            disabled={!canEdit || isSaving}
            className={inputClass(!Number.isInteger(frtNum) || frtNum < 1)}
          />
          {Number.isFinite(frtNum) && (
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 h-3">
              {formatMinutesHint(frtNum, t) ?? ""}
            </p>
          )}
        </td>
        <td className="py-3 px-4 align-top">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={ttr}
            onChange={(e) => setTtr(sanitize(e.target.value))}
            disabled={!canEdit || isSaving}
            className={inputClass(
              !Number.isInteger(ttrNum) || ttrNum < 1 || ttrNum <= frtNum,
            )}
          />
          {Number.isFinite(ttrNum) && (
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 h-3">
              {formatMinutesHint(ttrNum, t) ?? ""}
            </p>
          )}
        </td>
        <td className="py-3 px-4 align-top">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={escalate}
            onChange={(e) => setEscalate(sanitize(e.target.value))}
            disabled={!canEdit || isSaving}
            className={inputClass(
              !Number.isInteger(escalateNum) ||
                escalateNum < 1 ||
                escalateNum > ttrNum,
            )}
          />
          {Number.isFinite(escalateNum) && (
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 h-3">
              {formatMinutesHint(escalateNum, t) ?? ""}
            </p>
          )}
        </td>
        <td className="py-3 px-4 text-right align-top">
          {canEdit && hasChanges && (
            <button
              onClick={() =>
                onSave({
                  frtMinutes: frtNum,
                  ttrMinutes: ttrNum,
                  escalateAfterMinutes: escalateNum,
                })
              }
              disabled={isSaving || !isValid}
              className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? t('settingsPage.slaPanel.saving') : t('settingsPage.slaPanel.save')}
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
  const { user } = useAuth();
  const profile = useSupportProfile();
  // Two-level tab nav (matches admin pattern): main groups → sub-tabs.
  // Each sub-tab id is unique across the whole settings page so the body
  // can stay a flat switch — only the chrome is grouped.
  const [activeMain, setActiveMain] = useState<string>("personal");
  const [activeSub, setActiveSub] = useState<string>("profile");

  // Support-staff profile extras. Names / email / phone / avatar all
  // live inside <ProfileSection>; these are the role-specific fields
  // that ride along via `extraSavePayload`.
  const [profession, setProfession] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!user) return;
    setProfession(user.profession || "");
    setDepartment(user.department || "");
    setSpecialty(user.specialty || "");
    setBio(user.bio || "");
  }, [user]);

  const supportExtraSavePayload = {
    profession: profession || undefined,
    department: department || undefined,
    specialty: specialty || undefined,
    bio: bio || undefined,
  };

  // Macros state
  const [macrosList, setMacrosList] = useState<any[]>([]);
  const [macrosLoading, setMacrosLoading] = useState(false);
  const [showMacroForm, setShowMacroForm] = useState(false);
  const [editingMacro, setEditingMacro] = useState<any>(null);
  const [macroForm, setMacroForm] = useState({ title: '', bodyTemplate: '', kbArticleUrls: '' });
  const [macroSaving, setMacroSaving] = useState(false);

  const handleSaveMacro = async () => {
    if (!macroForm.title.trim() || !macroForm.bodyTemplate.trim()) { toast.error(t("settingsPage.macrosPanel.toasts.titleBodyRequired")); return; }
    setMacroSaving(true);
    try {
      const data = {
        title: macroForm.title.trim(),
        bodyTemplate: macroForm.bodyTemplate.trim(),
        kbArticleUrls: macroForm.kbArticleUrls ? macroForm.kbArticleUrls.split('\n').filter(Boolean) : [],
      };
      if (editingMacro) {
        await supportApi.updateMacro(editingMacro.id, data);
        toast.success(t("settingsPage.macrosPanel.toasts.updated"));
      } else {
        await supportApi.createMacro(data);
        toast.success(t("settingsPage.macrosPanel.toasts.created"));
      }
      setShowMacroForm(false);
      // Refresh list
      const refreshed = await supportApi.getMacros();
      setMacrosList(refreshed || []);
    } catch { toast.error(t("settingsPage.macrosPanel.toasts.saveFailed")); }
    finally { setMacroSaving(false); }
  };

  // SLA state lives inside <SLAPoliciesPanel /> now — same panel admins
  // embed on /dashboard/admin/support, so behaviour stays identical.

  useEffect(() => {
    if (activeSub === 'macros') {
      setMacrosLoading(true);
      supportApi.getMacros().then(data => setMacrosList(data || [])).catch(() => {}).finally(() => setMacrosLoading(false));
    }
  }, [activeSub]);

  const isSupervisorOrAdmin = Boolean(
    user?.supportSubRole === "supervisor" ||
      user?.roles?.includes("ADMIN") ||
      user?.roles?.includes("SUPER_ADMIN"),
  );

  // Agents only see Profile. All operational configuration tabs
  // (SLA, Escalation, Macros, etc.) are supervisor/admin-only.
  // Agents access macros via the Apply Macro dropdown on the
  // ticket reply composer — they don't need a library view here.
  const isAdmin =
    user?.roles?.includes("ADMIN") || user?.roles?.includes("SUPER_ADMIN");

  // Tab groups follow the admin-dashboard pattern: a main strip on top,
  // a thinner sub-tab strip below it. Agents see only "Personal" since
  // every operational group is supervisor-gated.
  type SubTab = { id: string; icon: React.ElementType; adminOnly?: boolean };
  type MainTab = {
    id: string;
    icon: React.ElementType;
    supervisorOnly?: boolean;
    subTabs: SubTab[];
  };

  const allMainTabs: MainTab[] = [
    {
      id: "personal",
      icon: User,
      subTabs: [
        { id: "profile", icon: User },
        { id: "security", icon: Shield },
        { id: "notifications", icon: Bell },
      ],
    },
    {
      id: "routing",
      icon: ShieldCheck,
      supervisorOnly: true,
      subTabs: [
        { id: "sla", icon: ShieldCheck },
        { id: "assignment", icon: UserPlus },
      ],
    },
    {
      id: "workspace",
      icon: Settings,
      supervisorOnly: true,
      subTabs: [
        // Business Hours is platform-wide (drives SLA + public widget),
        // so it's admin-only — supervisors don't see this sub-tab at all.
        { id: "businessHours", icon: Clock, adminOnly: true },
        { id: "macros", icon: MessageSquare },
        { id: "categories", icon: Tag },
      ],
    },
  ];

  // Strip role-gated sub-tabs first, then drop any main group left empty.
  const mainTabs = allMainTabs
    .filter((m) => !m.supervisorOnly || isSupervisorOrAdmin)
    .map((m) => ({
      ...m,
      subTabs: m.subTabs.filter((s) => !s.adminOnly || isAdmin),
    }))
    .filter((m) => m.subTabs.length > 0);

  const currentMain =
    mainTabs.find((m) => m.id === activeMain) ?? mainTabs[0];

  // Keep activeSub valid when switching main groups (or when role changes
  // hides the current group entirely).
  useEffect(() => {
    if (!currentMain) return;
    if (!currentMain.subTabs.some((s) => s.id === activeSub)) {
      setActiveSub(currentMain.subTabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMain.id]);

  const handleMainSelect = (id: string) => {
    setActiveMain(id);
    const target = mainTabs.find((m) => m.id === id);
    if (target && !target.subTabs.some((s) => s.id === activeSub)) {
      setActiveSub(target.subTabs[0].id);
    }
  };

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>


            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("settingsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("settingsPage.subtitle")}
                </p>
              </div>

              {/* Settings Card */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {/* Main tab strip */}
                <div className="flex flex-wrap border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                  {mainTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeMain === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleMainSelect(tab.id)}
                        className={`px-4 sm:px-5 py-3 text-sm font-semibold relative transition-colors whitespace-nowrap flex items-center gap-2 ${
                          isActive
                            ? "text-[var(--color-primary)] bg-[var(--color-surface-card)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {t(`settingsPage.mainTabs.${tab.id}`)}
                        {isActive && (
                          <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub tab strip — only shown when the active main has >1 sub */}
                {currentMain && currentMain.subTabs.length > 1 && (
                  <div className="flex flex-wrap gap-1 px-3 sm:px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-card)]">
                    {currentMain.subTabs.map((sub) => {
                      const Icon = sub.icon;
                      const isActive = activeSub === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setActiveSub(sub.id)}
                          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                            isActive
                              ? "bg-[var(--color-primary)] text-white"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {t(`settingsPage.tabs.${sub.id}`)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tab Content */}
                <div className="p-5">
                  {/* Profile — matches student/instructor/manager/TA layout. */}
                  {activeSub === "profile" && (
                    <ProfileSection
                      idPrefix="support"
                      showArabicNames
                      showPhone
                      extraFields={
                        <SupportProfileExtras
                          profession={profession}
                          setProfession={setProfession}
                          department={department}
                          setDepartment={setDepartment}
                          specialty={specialty}
                          setSpecialty={setSpecialty}
                          bio={bio}
                          setBio={setBio}
                          inlinePreferences={<PreferencesInline />}
                        />
                      }
                      extraSavePayload={supportExtraSavePayload}
                    />
                  )}

                  {/* Personal Security — admin-grade UX: overview strip + cards */}
                  {activeSub === "security" && <SupportMySecurityPanel />}

                  {/* Auto-Assignment */}
                  {activeSub === "assignment" && (
                    <AutoAssignmentPanel canEdit={true} />
                  )}

                  {/* Business Hours — admin-only edit; supervisors see read-only */}
                  {activeSub === "businessHours" && (
                    <BusinessHoursPanel canEdit={!!isAdmin} />
                  )}

                  {/* Notification preferences */}
                  {activeSub === "notifications" && <NotificationPrefsPanel />}

                  {/* Ticket Categories */}
                  {activeSub === "categories" && <TicketCategoriesPanel />}

                  {/* SLA Targets — extracted panel; same panel admins embed. */}
                  {activeSub === "sla" && (
                    <SLAPoliciesPanel canEdit={isSupervisorOrAdmin} />
                  )}

                  {/* Auto-Assignment */}

                  {/* Macros */}
                  {activeSub === "macros" && (
                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t("settingsPage.macrosPanel.title")}</h3>
                        {isSupervisorOrAdmin && (
                          <button className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90"
                            onClick={() => { setEditingMacro(null); setMacroForm({ title: '', bodyTemplate: '', kbArticleUrls: '' }); setShowMacroForm(true); }}>
                            {t("settingsPage.macrosPanel.newMacro")}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("settingsPage.macrosPanel.description", { variables: '{{learner_name}}, {{learner_first_name}}, {{course_name}}, {{ticket_id}}, {{ticket_subject}}, {{ticket_priority}}, {{ticket_category}}, {{ticket_status}}, {{agent_name}}' })}</p>
                      {showMacroForm && (
                        <div className="mb-6 p-4 border border-[#C7D5F0] bg-[#F0F4FF] rounded-lg">
                          <h4 className="text-sm font-semibold text-[var(--color-primary)] mb-3">{editingMacro ? t("settingsPage.macrosPanel.editTitle") : t("settingsPage.macrosPanel.createTitle")}</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.macrosPanel.formTitle")}</label>
                              <input type="text" value={macroForm.title} onChange={e => setMacroForm(p => ({...p, title: e.target.value}))}
                                className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]" placeholder={t("settingsPage.macrosPanel.formTitlePlaceholder")} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.macrosPanel.bodyTemplate")}</label>
                              <p className="text-[10px] text-[var(--color-text-secondary)] mb-1">{t("settingsPage.macrosPanel.insertVariablesHint")}</p>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {[
                                  { key: '{{learner_name}}', label: t("settingsPage.macrosPanel.variables.learnerName") },
                                  { key: '{{learner_first_name}}', label: t("settingsPage.macrosPanel.variables.learnerFirstName") },
                                  { key: '{{course_name}}', label: t("settingsPage.macrosPanel.variables.courseName") },
                                  { key: '{{ticket_id}}', label: t("settingsPage.macrosPanel.variables.ticketId") },
                                  { key: '{{ticket_subject}}', label: t("settingsPage.macrosPanel.variables.ticketSubject") },
                                  { key: '{{ticket_priority}}', label: t("settingsPage.macrosPanel.variables.ticketPriority") },
                                  { key: '{{ticket_category}}', label: t("settingsPage.macrosPanel.variables.ticketCategory") },
                                  { key: '{{ticket_status}}', label: t("settingsPage.macrosPanel.variables.ticketStatus") },
                                  { key: '{{agent_name}}', label: t("settingsPage.macrosPanel.variables.agentName") },
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
                                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--color-primary)]"
                                placeholder={t("settingsPage.macrosPanel.bodyTemplatePlaceholder", { learnerVar: '{{learner_name}}' })}
                              />
                              <p className="text-[10px] text-[var(--color-text-secondary)] text-right mt-0.5">{macroForm.bodyTemplate.length}/10,000</p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t("settingsPage.macrosPanel.kbUrls")}</label>
                              <textarea value={macroForm.kbArticleUrls} onChange={e => setMacroForm(p => ({...p, kbArticleUrls: e.target.value}))}
                                rows={2} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--color-primary)]"
                                placeholder="https://..." />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSaveMacro} disabled={macroSaving}
                                className="px-4 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50">
                                {macroSaving ? t("settingsPage.macrosPanel.saving") : editingMacro ? t("settingsPage.macrosPanel.update") : t("settingsPage.macrosPanel.create")}
                              </button>
                              <button onClick={() => setShowMacroForm(false)} className="px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:underline">{t("settingsPage.macrosPanel.cancel")}</button>
                            </div>
                          </div>
                        </div>
                      )}
                      {macrosLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" /></div>
                      ) : macrosList.length === 0 ? (
                        <p className="text-center py-8 text-sm text-[var(--color-text-secondary)]">{t("settingsPage.macrosPanel.noMacros")}</p>
                      ) : (
                        <div className="space-y-3">
                          {macrosList.map(macro => (
                            <div key={macro.id} className="p-4 border border-[var(--color-border)] rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{macro.title}</h4>
                                {isSupervisorOrAdmin && (
                                  <div className="flex items-center">
                                    <button onClick={() => {
                                      setEditingMacro(macro);
                                      setMacroForm({ title: macro.title, bodyTemplate: macro.bodyTemplate, kbArticleUrls: (macro.kbArticleUrls || []).join('\n') });
                                      setShowMacroForm(true);
                                    }} className="text-xs text-[var(--color-primary)] hover:underline mr-2">{t("settingsPage.macrosPanel.edit")}</button>
                                    <button onClick={async () => {
                                      if (confirm(t("settingsPage.macrosPanel.toasts.confirmDelete"))) {
                                        await supportApi.deleteMacro(macro.id);
                                        setMacrosList(prev => prev.filter(m => m.id !== macro.id));
                                        toast.success(t("settingsPage.macrosPanel.toasts.deleted"));
                                      }
                                    }} className="text-xs text-red-500 hover:underline">{t("settingsPage.macrosPanel.delete")}</button>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap line-clamp-3">{macro.bodyTemplate}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}


                  {/* Notifications */}

                  {/* Categories */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// SLA Policies panel — per-priority FRT/TTR/escalate targets.
// Self-contained so both the supervisor settings page and the admin
// support page can drop it in without duplicating state.
// ──────────────────────────────────────────────────────────────────

export function SLAPoliciesPanel({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("supportDashboard");
  const [slaPolicies, setSlaPolicies] = useState<any[]>([]);
  const [slaLoading, setSlaLoading] = useState(false);
  const [slaError, setSlaError] = useState<string | null>(null);
  const [slaSaving, setSlaSaving] = useState<string | null>(null);

  const fetchSlaPolicies = useCallback(() => {
    setSlaLoading(true);
    setSlaError(null);
    supportApi
      .getSlaPolicies()
      .then((data) => setSlaPolicies(Array.isArray(data) ? data : []))
      .catch((err: any) => {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          t("settingsPage.slaPanel.toasts.loadFailed");
        setSlaError(typeof message === "string" ? message : t("settingsPage.slaPanel.toasts.loadFailed"));
        toast.error(t("settingsPage.slaPanel.toasts.loadFailed"));
      })
      .finally(() => setSlaLoading(false));
  }, [t]);

  useEffect(() => {
    fetchSlaPolicies();
  }, [fetchSlaPolicies]);

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
        {t("settingsPage.slaPanel.title")}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {t("settingsPage.slaPanel.description")}
      </p>
      {slaLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : slaError ? (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-[#B91C1C]">{t("settingsPage.slaPanel.loadFailedTitle")}</p>
            <p className="text-xs text-[#991B1B] mt-0.5">{slaError}</p>
          </div>
          <button
            type="button"
            onClick={fetchSlaPolicies}
            className="px-3 py-1.5 bg-[var(--color-surface-card)] border border-[#FECACA] text-[#B91C1C] text-xs font-medium rounded-lg hover:bg-[#FEF2F2]"
          >
            {t("settingsPage.slaPanel.retry")}
          </button>
        </div>
      ) : slaPolicies.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
          {t("settingsPage.slaPanel.noPolicies")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">{t("settingsPage.slaPanel.columns.priority")}</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">{t("settingsPage.slaPanel.columns.frt")}</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">{t("settingsPage.slaPanel.columns.ttr")}</th>
                <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">{t("settingsPage.slaPanel.columns.escalate")}</th>
                <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]"></th>
              </tr>
            </thead>
            <tbody>
              {slaPolicies.map((policy) => (
                <SLAPolicyRow
                  key={policy.priority}
                  policy={policy}
                  canEdit={canEdit}
                  isSaving={slaSaving === policy.priority}
                  t={t as any}
                  onSave={async (data) => {
                    setSlaSaving(policy.priority);
                    try {
                      const updated = await supportApi.updateSlaPolicy(policy.priority, data);
                      setSlaPolicies((prev) =>
                        prev.map((p) => (p.priority === policy.priority ? updated : p)),
                      );
                      toast.success(t("settingsPage.slaPanel.toasts.updated"));
                    } catch (err: any) {
                      const message =
                        err?.response?.data?.message ||
                        err?.message ||
                        t("settingsPage.slaPanel.toasts.updateFailed");
                      toast.error(typeof message === "string" ? message : t("settingsPage.slaPanel.toasts.updateFailed"));
                    } finally {
                      setSlaSaving(null);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Auto-Assignment panel — round-robin / least-loaded / manual,
// business-hours respect, optional concurrent-ticket cap per agent.
// ──────────────────────────────────────────────────────────────────

export function AutoAssignmentPanel({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("supportDashboard");
  const [form, setForm] = useState<{
    enabled: boolean;
    strategy: "round_robin" | "least_loaded" | "manual";
    respectBusinessHours: boolean;
    maxConcurrentPerAgent: number;
  } | null>(null);
  const [original, setOriginal] = useState<typeof form>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    supportApi
      .getAutoAssignment()
      .then((d) => {
        setForm(d);
        setOriginal(d);
      })
      .catch(() => {
        toast.error(t("settingsPage.assignmentPanel.loadFailed"));
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(original),
    [form, original],
  );

  async function save() {
    if (!form) return;
    setIsSaving(true);
    try {
      const next = await supportApi.setAutoAssignment(form);
      setForm(next);
      setOriginal(next);
      toast.success(t("settingsPage.assignmentPanel.saved"));
    } catch (err: any) {
      toast.error(err?.message || t("settingsPage.assignmentPanel.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  const strategies: {
    key: typeof form.strategy;
    label: string;
    desc: string;
  }[] = [
    {
      key: "round_robin",
      label: t("settingsPage.assignmentPanel.strategy.roundRobin"),
      desc: t("settingsPage.assignmentPanel.strategy.roundRobinDesc"),
    },
    {
      key: "least_loaded",
      label: t("settingsPage.assignmentPanel.strategy.leastLoaded"),
      desc: t("settingsPage.assignmentPanel.strategy.leastLoadedDesc"),
    },
    {
      key: "manual",
      label: t("settingsPage.assignmentPanel.strategy.manual"),
      desc: t("settingsPage.assignmentPanel.strategy.manualDesc"),
    },
  ];

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {t("settingsPage.assignmentPanel.title")}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        {t("settingsPage.assignmentPanel.description")}
      </p>

      {/* Master toggle */}
      <ToggleRow
        label={t("settingsPage.assignmentPanel.enabledLabel")}
        hint={t("settingsPage.assignmentPanel.enabledHint")}
        checked={form.enabled}
        onChange={(v) => canEdit && setForm({ ...form, enabled: v })}
        disabled={!canEdit}
      />

      <div className="border-t border-[var(--color-border)] my-5" />

      {/* Strategy picker */}
      <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
        {t("settingsPage.assignmentPanel.strategyLabel")}
      </p>
      <div className="space-y-2 mb-5">
        {strategies.map((s) => (
          <label
            key={s.key}
            className={`flex items-start gap-3 p-3 border rounded-lg ${!canEdit ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-[var(--color-border-subtle)]"} ${
              form.strategy === s.key
                ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
                : "border-[var(--color-border)]"
            }`}
          >
            <input
              type="radio"
              name="strategy"
              checked={form.strategy === s.key}
              onChange={() => canEdit && setForm({ ...form, strategy: s.key })}
              disabled={!form.enabled || !canEdit}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {s.label}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {s.desc}
              </p>
            </div>
          </label>
        ))}
      </div>

      {/* Sub-options */}
      <ToggleRow
        label={t("settingsPage.assignmentPanel.respectBusinessHoursLabel")}
        hint={t("settingsPage.assignmentPanel.respectBusinessHoursHint")}
        checked={form.respectBusinessHours}
        onChange={(v) =>
          canEdit && setForm({ ...form, respectBusinessHours: v })
        }
        disabled={!form.enabled || !canEdit}
      />

      <div className="mt-5 mb-1">
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
          {t("settingsPage.assignmentPanel.maxConcurrentLabel")}
        </label>
        <p className="text-xs text-[var(--color-text-secondary)] mb-2">
          {t("settingsPage.assignmentPanel.maxConcurrentHint")}
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={String(form.maxConcurrentPerAgent)}
          onChange={(e) => {
            if (!canEdit) return;
            const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
            setForm({
              ...form,
              maxConcurrentPerAgent: digits === "" ? 0 : parseInt(digits, 10),
            });
          }}
          disabled={!form.enabled || !canEdit}
          className="w-32 h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-surface-page)]"
        />
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
          {t("settingsPage.assignmentPanel.maxConcurrentNote")}
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {dirty && (
          <button
            type="button"
            onClick={() => setForm(original)}
            disabled={isSaving}
            className="h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
          >
            {t("settingsPage.cancelChanges")}
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!canEdit || !dirty || isSaving}
          className="h-10 px-4 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t("settingsPage.saveChanges")}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Business Hours panel — working days + open/close + timezone.
// Read-only for supervisors; admin can edit.
// ──────────────────────────────────────────────────────────────────

export function BusinessHoursPanel({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("supportDashboard");
  const [form, setForm] = useState<{
    workingDays: number[];
    openTime: string;
    closeTime: string;
    timezoneOffsetHours: number;
  } | null>(null);
  const [original, setOriginal] = useState<typeof form>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    supportApi
      .getBusinessHours()
      .then((d) => {
        // Times are interpreted as Saudi Riyadh time (AST, UTC+3) —
        // we force the offset here so any legacy non-3 value stored
        // in support_config gets normalised on the next save.
        const riyadh = { ...d, timezoneOffsetHours: 3 };
        setForm(riyadh);
        setOriginal(riyadh);
      })
      .catch(() => {
        toast.error(t("settingsPage.businessHours.loadFailed"));
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(original),
    [form, original],
  );

  function toggleDay(day: number) {
    if (!canEdit || !form) return;
    const next = form.workingDays.includes(day)
      ? form.workingDays.filter((d) => d !== day)
      : [...form.workingDays, day].sort((a, b) => a - b);
    setForm({ ...form, workingDays: next });
  }

  async function save() {
    if (!form) return;
    if (form.workingDays.length === 0) {
      toast.error(t("settingsPage.businessHours.atLeastOneDay"));
      return;
    }
    setIsSaving(true);
    try {
      const next = await supportApi.setBusinessHours(form);
      setForm(next);
      setOriginal(next);
      toast.success(t("settingsPage.businessHours.saved"));
    } catch (err: any) {
      toast.error(err?.message || t("settingsPage.businessHours.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  const days = [
    { idx: 0, label: t("settingsPage.businessHours.days.sun") },
    { idx: 1, label: t("settingsPage.businessHours.days.mon") },
    { idx: 2, label: t("settingsPage.businessHours.days.tue") },
    { idx: 3, label: t("settingsPage.businessHours.days.wed") },
    { idx: 4, label: t("settingsPage.businessHours.days.thu") },
    { idx: 5, label: t("settingsPage.businessHours.days.fri") },
    { idx: 6, label: t("settingsPage.businessHours.days.sat") },
  ];

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("settingsPage.businessHours.title")}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("settingsPage.businessHours.description")}
          </p>
        </div>
        {!canEdit && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-medium whitespace-nowrap">
            {t("settingsPage.adminOnlyBadge")}
          </span>
        )}
      </div>

      {/* Working days */}
      <div className="mt-5">
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {t("settingsPage.businessHours.workingDays")}
        </label>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => {
            const active = form.workingDays.includes(d.idx);
            return (
              <button
                key={d.idx}
                type="button"
                onClick={() => toggleDay(d.idx)}
                disabled={!canEdit}
                className={`px-3 h-9 rounded-lg text-sm font-medium border transition-colors disabled:cursor-not-allowed ${
                  active
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                } ${!canEdit ? "opacity-70" : ""}`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Times — always in Saudi Riyadh time (Asia/Riyadh, AST = UTC+3). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {t("settingsPage.businessHours.openTime")}
          </label>
          <input
            type="time"
            value={form.openTime}
            onChange={(e) =>
              canEdit && setForm({ ...form, openTime: e.target.value })
            }
            disabled={!canEdit}
            className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-surface-page)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {t("settingsPage.businessHours.closeTime")}
          </label>
          <input
            type="time"
            value={form.closeTime}
            onChange={(e) =>
              canEdit && setForm({ ...form, closeTime: e.target.value })
            }
            disabled={!canEdit}
            className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-surface-page)]"
          />
        </div>
      </div>
      <p className="text-[11px] text-[var(--color-text-secondary)] mt-2">
        {t("settingsPage.businessHours.riyadhTimeNote")}
      </p>

      <div className="mt-5 p-3 bg-[var(--color-border-subtle)] rounded-lg text-xs text-[var(--color-text-secondary)]">
        <p className="font-medium text-[var(--color-text-primary)] mb-1">
          {t("settingsPage.businessHours.summaryTitle")}
        </p>
        <p>
          {form.workingDays
            .map((d) => days.find((dd) => dd.idx === d)?.label)
            .filter(Boolean)
            .join(", ")}{" "}
          · {form.openTime} – {form.closeTime}{" "}
          · {t("settingsPage.businessHours.riyadhLabel")}
        </p>
        <p className="mt-1">{t("settingsPage.businessHours.appliesTo")}</p>
      </div>

      {canEdit && (
        <div className="mt-6 flex justify-end gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setForm(original)}
              disabled={isSaving}
              className="h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
            >
              {t("settingsPage.cancelChanges")}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || isSaving}
            className="h-10 px-4 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("settingsPage.saveChanges")}
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Notification Preferences — per-user email + in-app toggles
// for support-specific events.
// ──────────────────────────────────────────────────────────────────

// Notification keys mirrored on the backend (5 events × 2 channels).
// Master toggles flip every key on the matching channel together —
// same honest pattern student/instructor/manager use, but wired to
// the support-staff pref blob (not user_preferences). The backend
// helper shouldNotifySupport() reads ANY(channelKeys) so a master OFF
// genuinely suppresses dispatch.
const SUPPORT_EMAIL_KEYS = [
  "emailNewTicket",
  "emailReassigned",
  "emailSlaWarning",
  "emailMention",
  "emailCsatResponse",
] as const;
const SUPPORT_INAPP_KEYS = [
  "inappNewTicket",
  "inappReassigned",
  "inappSlaWarning",
  "inappMention",
  "inappCsatResponse",
] as const;

function NotificationPrefsPanel() {
  const t = useTranslations("supportDashboard");
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingChannel, setTogglingChannel] = useState<"email" | "inApp" | null>(null);

  useEffect(() => {
    setIsLoading(true);
    supportApi
      .getSupportNotificationPrefs()
      .then((d) => setPrefs(d))
      .catch(() => toast.error(t("settingsPage.notificationsPanel.loadFailed")))
      .finally(() => setIsLoading(false));
  }, [t]);

  if (isLoading || !prefs) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  const emailOn = SUPPORT_EMAIL_KEYS.some((k) => prefs[k] === true);
  const inAppOn = SUPPORT_INAPP_KEYS.some((k) => prefs[k] === true);

  const setMaster = async (channel: "email" | "inApp", value: boolean) => {
    const keys = channel === "email" ? SUPPORT_EMAIL_KEYS : SUPPORT_INAPP_KEYS;
    const next = { ...prefs };
    keys.forEach((k) => {
      next[k] = value;
    });
    // Optimistic UI; revert on failure.
    const prev = prefs;
    setPrefs(next);
    setTogglingChannel(channel);
    try {
      const server = await supportApi.setSupportNotificationPrefs(next);
      setPrefs(server);
    } catch (err: any) {
      setPrefs(prev);
      toast.error(err?.message || t("settingsPage.notificationsPanel.saveFailed"));
    } finally {
      setTogglingChannel(null);
    }
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {t("settingsPage.notificationsPanel.title")}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-5">
        {t("settingsPage.notificationsPanel.description")}
      </p>

      <div className="space-y-3 max-w-2xl">
        {/* Email master */}
        <ChannelRow
          icon={<Mail className="w-5 h-5" />}
          title={t("settingsPage.notificationsPanel.emailMasterTitle")}
          hint={t("settingsPage.notificationsPanel.emailMasterHint")}
          checked={emailOn}
          busy={togglingChannel === "email"}
          onToggle={(v) => setMaster("email", v)}
        />

        {/* In-app master */}
        <ChannelRow
          icon={<Bell className="w-5 h-5" />}
          title={t("settingsPage.notificationsPanel.inAppMasterTitle")}
          hint={t("settingsPage.notificationsPanel.inAppMasterHint")}
          checked={inAppOn}
          busy={togglingChannel === "inApp"}
          onToggle={(v) => setMaster("inApp", v)}
        />
      </div>
    </div>
  );
}

function ChannelRow({
  icon,
  title,
  hint,
  checked,
  busy,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  busy: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 border border-[var(--color-border)] rounded-xl">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0 text-[var(--color-primary)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{hint}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={busy}
        onClick={() => onToggle(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
        }`}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-white mx-auto" />
        ) : (
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        )}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Ticket Categories panel — show built-ins (read-only) plus add /
// remove custom categories. Stored in support_config.
// ──────────────────────────────────────────────────────────────────

export function TicketCategoriesPanel() {
  const t = useTranslations("supportDashboard");
  const [cats, setCats] = useState<
    {
      slug: string;
      nameEn: string;
      nameAr: string | null;
      autoPriority: "high" | "medium" | "low" | null;
      builtin: boolean;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    nameEn: "",
    nameAr: "",
    autoPriority: "medium" as "high" | "medium" | "low",
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchCategories = useCallback(() => {
    setIsLoading(true);
    supportApi
      .listTicketCategories()
      .then((d) => setCats(d || []))
      .catch(() => setCats([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function addCategory() {
    if (!form.nameEn.trim()) {
      toast.error(t("settingsPage.ticketCategoriesPanel.nameEnRequired"));
      return;
    }
    setIsSaving(true);
    try {
      await supportApi.addTicketCategory({
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim() || undefined,
        autoPriority: form.autoPriority,
      });
      toast.success(t("settingsPage.ticketCategoriesPanel.added"));
      setForm({ nameEn: "", nameAr: "", autoPriority: "medium" });
      setShowAdd(false);
      fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || t("settingsPage.ticketCategoriesPanel.addFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCategory(slug: string) {
    if (!confirm(t("settingsPage.ticketCategoriesPanel.confirmDelete", { slug }))) return;
    try {
      await supportApi.removeTicketCategory(slug);
      toast.success(t("settingsPage.ticketCategoriesPanel.removed"));
      fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || t("settingsPage.ticketCategoriesPanel.removeFailed"));
    }
  }

  if (isLoading) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  const priorityStyles: Record<string, string> = {
    high: "bg-[#FEE2E2] text-[#DC2626]",
    medium: "bg-[#FFEDD5] text-[#EA580C]",
    low: "bg-[#DCFCE7] text-[#16A34A]",
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
      <div className="flex items-start justify-between mb-1 gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("settingsPage.ticketCategoriesPanel.title")}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("settingsPage.ticketCategoriesPanel.description")}
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 h-10 px-4 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white text-sm font-medium rounded-lg"
          >
            <Plus className="w-4 h-4" />
            {t("settingsPage.ticketCategoriesPanel.addCategory")}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mt-4 p-4 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-page)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("settingsPage.ticketCategoriesPanel.nameEn")}
              </label>
              <input
                type="text"
                value={form.nameEn}
                onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("settingsPage.ticketCategoriesPanel.nameAr")}
              </label>
              <input
                type="text"
                dir="rtl"
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {t("settingsPage.ticketCategoriesPanel.autoPriority")}
            </label>
            <div className="flex gap-2">
              {(["high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, autoPriority: p })}
                  className={`px-3 h-9 rounded-lg text-xs font-medium border transition-colors ${
                    form.autoPriority === p
                      ? `${priorityStyles[p]} border-current`
                      : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
                  }`}
                >
                  {t(`settingsPage.ticketCategoriesPanel.priorities.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)]"
            >
              {t("settingsPage.cancelChanges")}
            </button>
            <button
              type="button"
              onClick={addCategory}
              disabled={isSaving}
              className="h-9 px-4 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {t("settingsPage.ticketCategoriesPanel.addCategory")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {cats.map((c) => (
          <div
            key={c.slug}
            className="flex items-center gap-3 border border-[var(--color-border)] rounded-lg p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {c.nameEn}
                  {c.nameAr && (
                    <span className="text-[var(--color-text-secondary)] font-normal mx-1">
                      / {c.nameAr}
                    </span>
                  )}
                </p>
                {c.builtin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-medium">
                    {t("settingsPage.ticketCategoriesPanel.builtin")}
                  </span>
                )}
                {c.autoPriority && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${priorityStyles[c.autoPriority]}`}
                  >
                    {t(`settingsPage.ticketCategoriesPanel.priorities.${c.autoPriority}`)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-mono mt-0.5">
                {c.slug}
              </p>
            </div>
            {!c.builtin && (
              <button
                type="button"
                onClick={() => removeCategory(c.slug)}
                className="p-1.5 hover:bg-[#FEE2E2] rounded-md text-[#DC2626]"
                aria-label={t("settingsPage.ticketCategoriesPanel.removeCategory")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Small toggle row + toggle helpers reused across the panels.
// ──────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </p>
        {hint && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {hint}
          </p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
        checked ? "bg-[#22C55E]" : "bg-[var(--color-border)]"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? "ms-auto" : ""}`}
      />
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// Support-staff profile extras rendered inside <ProfileSection>.
// Mirrors the instructor / TA extras block but with role-relevant
// fields: Job Title, Department, Areas of Expertise, Bio. Values save
// through ProfileSection's Save button via extraSavePayload.
// ──────────────────────────────────────────────────────────────────

function SupportProfileExtras({
  profession,
  setProfession,
  department,
  setDepartment,
  specialty,
  setSpecialty,
  bio,
  setBio,
  inlinePreferences,
}: {
  profession: string;
  setProfession: (v: string) => void;
  department: string;
  setDepartment: (v: string) => void;
  specialty: string;
  setSpecialty: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  inlinePreferences: React.ReactNode;
}) {
  const t = useTranslations("supportDashboard.settingsPage.profileExtras");
  const inputClass =
    "w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]";
  const labelClass =
    "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5";

  return (
    <>
      <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("heading")}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="support-profession" className={labelClass}>
              {t("jobTitle")}
            </label>
            <input
              id="support-profession"
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder={t("jobTitlePlaceholder")}
              maxLength={255}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="support-department" className={labelClass}>
              {t("department")}
            </label>
            <input
              id="support-department"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={t("departmentPlaceholder")}
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="support-specialty" className={labelClass}>
              {t("specialty")}
            </label>
            <input
              id="support-specialty"
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder={t("specialtyPlaceholder")}
              maxLength={100}
              className={inputClass}
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {t("specialtyHint")}
            </p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="support-bio" className={labelClass}>
              {t("bio")}
            </label>
            <textarea
              id="support-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t("bioPlaceholder")}
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-end">
              {bio.length}/1000
            </p>
          </div>
        </div>
      </div>
      {inlinePreferences}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Support personal security — admin-grade UX (overview strip + cards).
// Reasoning: support staff handle customer data, so they deserve the
// same first-class security surface admins have, not the bare flat
// list student/instructor/manager use. Logic is identical to admin's
// MySecurityTab; presentation is adapted to live inside the support
// settings card (no TabShell wrapper).
// ──────────────────────────────────────────────────────────────────

function SupportMySecurityPanel() {
  const t = useTranslations("supportDashboard.settingsPage.mySecurity");
  const user = useAuth().user;
  const { policy } = usePasswordPolicy();
  const {
    twoFactorEnabled,
    devices,
    loading: securityLoading,
    toggling,
    revokingId,
    revokingAll,
    showRevokeAllConfirm,
    setShowRevokeAllConfirm,
    handleToggle2FA,
    handleRevokeDevice,
    handleRevokeAll,
    handleLogout,
  } = useSecuritySettings();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    const policyErrors = checkPasswordAgainstPolicy(newPassword, policy);
    if (policyErrors.length) {
      toast.error(policyErrors[0]);
      return;
    }
    setChanging(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      toast.success(t("passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || t("passwordChangeFailed"));
    } finally {
      setChanging(false);
    }
  };

  if (securityLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Overview Strip (2FA / Devices / Last sign-in) ────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          className={`rounded-xl p-4 border ${
            twoFactorEnabled
              ? "bg-gradient-to-br from-green-50 to-emerald-50/50 border-green-200"
              : "bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                  twoFactorEnabled ? "text-green-700" : "text-amber-700"
                }`}
              >
                {t("overview.twoFactorLabel")}
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {twoFactorEnabled ? t("overview.enabled") : t("overview.notEnabled")}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {twoFactorEnabled
                  ? t("overview.twoFactorOnHint")
                  : t("overview.twoFactorOffHint")}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                twoFactorEnabled ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 border bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-blue-700">
                {t("overview.devicesLabel")}
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {devices.length}{" "}
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {devices.length === 1
                    ? t("overview.deviceSingular")
                    : t("overview.devicePlural")}
                </span>
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t("overview.devicesHint")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600">
              <SmartphoneIcon />
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 border bg-gradient-to-br from-slate-50 to-gray-50/50 border-[var(--color-border)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-[var(--color-text-secondary)]">
                {t("overview.lastSignInLabel")}
              </p>
              <p className="text-base font-bold text-[var(--color-text-primary)] truncate">
                {user?.lastLoginAt ? (
                  <FmtDate value={user.lastLoginAt} variant="readable" includeTime />
                ) : (
                  t("overview.never")
                )}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                {user?.lastLoginIp ?? t("overview.ipUnknown")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 text-slate-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Change Password Card ─────────────────────────────────── */}
      <SecCard
        icon={<KeyRound className="w-5 h-5" />}
        title={t("changePassword")}
        subtitle={t("changePasswordHint")}
        accent="primary"
      >
        <div className="space-y-4 max-w-2xl">
          <SecPasswordInput
            label={t("currentPassword")}
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggleShow={() => setShowCurrent((v) => !v)}
            autoComplete="current-password"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SecPasswordInput
                label={t("newPassword")}
                value={newPassword}
                onChange={setNewPassword}
                show={showNew}
                onToggleShow={() => setShowNew((v) => !v)}
                autoComplete="new-password"
              />
              <PasswordPolicyHint password={newPassword} />
            </div>
            <SecPasswordInput
              label={t("confirmPassword")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              autoComplete="new-password"
            />
          </div>
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={changing || !currentPassword || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-2 px-5 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {changing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {t("updatePassword")}
          </button>
        </div>
      </SecCard>

      {/* ── 2FA Card ─────────────────────────────────────────────── */}
      <SecCard
        icon={<ShieldCheck className="w-5 h-5" />}
        title={t("twoFactorCardTitle")}
        subtitle={t("twoFactorCardHint")}
        accent={twoFactorEnabled ? "success" : "warning"}
        statusBadge={
          twoFactorEnabled
            ? { label: t("overview.enabled"), tone: "success" }
            : { label: t("overview.notEnabled"), tone: "warning" }
        }
      >
        <TwoFactorToggle
          enabled={twoFactorEnabled}
          toggling={toggling}
          onToggle={handleToggle2FA}
        />
      </SecCard>

      {/* ── Trusted Devices Card ─────────────────────────────────── */}
      <SecCard
        icon={<SmartphoneIcon />}
        title={t("devicesCardTitle")}
        subtitle={t("devicesCardHint")}
        accent="info"
      >
        <TrustedDevicesSection
          devices={devices}
          revokingId={revokingId}
          revokingAll={revokingAll}
          showRevokeAllConfirm={showRevokeAllConfirm}
          onRevokeDevice={handleRevokeDevice}
          onRevokeAll={handleRevokeAll}
          onShowRevokeAllConfirm={setShowRevokeAllConfirm}
          onLogout={handleLogout}
        />
      </SecCard>
    </div>
  );
}

type SecAccent = "primary" | "success" | "warning" | "info" | "neutral";

const SEC_ACCENT_RING: Record<SecAccent, string> = {
  primary: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-slate-100 text-slate-700",
};

function SecCard({
  icon,
  title,
  subtitle,
  accent,
  statusBadge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent: SecAccent;
  statusBadge?: { label: string; tone: "success" | "warning" };
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <header className="flex items-start gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${SEC_ACCENT_RING[accent]}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {title}
            </h3>
            {statusBadge && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  statusBadge.tone === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {statusBadge.label}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SecPasswordInput({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full h-10 px-3 pe-10 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// Local alias so we don't import `Smartphone` twice in the same file
function SmartphoneIcon() {
  return <Smartphone className="w-5 h-5" />;
}

export default SupportSettingsContent;
