"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Award,
  Coins,
  Gift,
  History,
  Loader2,
  Plus,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { useAuth } from "@/contexts";
import {
  pointsAdminApi,
  type PointRule,
  type PointsConfig,
  type AdminCourseRedemption,
  type AdminUserSearchResult,
  type PointsTransaction,
} from "@/lib/api";

type Tab = "rules" | "config" | "courses" | "grants" | "history";

interface AdminProfile {
  name: string;
  email: string;
  totalUsers: number;
  totalCourses: number;
  uptime: number;
}

const PointsSystemContent = () => {
  const t = useTranslations("adminDashboard.points");
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("rules");

  const adminProfile: AdminProfile = {
    name:
      [currentUser?.firstName, currentUser?.lastName]
        .filter(Boolean)
        .join(" ") ||
      currentUser?.email ||
      "",
    email: currentUser?.email || "",
    totalUsers: 0,
    totalCourses: 0,
    uptime: 99.9,
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof Award }> = [
    { key: "rules", label: t("tabs.rules"), icon: TrendingUp },
    { key: "config", label: t("tabs.config"), icon: Settings },
    { key: "courses", label: t("tabs.courses"), icon: Gift },
    { key: "grants", label: t("tabs.grants"), icon: Plus },
    { key: "history", label: t("tabs.history"), icon: History },
  ];

  return (
    <>
      <AdminNavbar admin={adminProfile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={adminProfile} />
            </div>
            <AdminMobileSidebar admin={adminProfile} />

            <div className="flex-1 min-w-0">
              {/* Page header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                  <Coins className="w-5 h-5 text-[#D4A520]" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    {t("subtitle")}
                  </p>
                </div>
              </div>

              {/* Tab strip */}
              <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] mb-4 -mx-1 px-1 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        active
                          ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              {activeTab === "rules" && <RulesTab t={t} />}
              {activeTab === "config" && <ConfigTab t={t} />}
              {activeTab === "courses" && <CoursesTab t={t} />}
              {activeTab === "grants" && <GrantsTab t={t} />}
              {activeTab === "history" && <HistoryTab t={t} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Rules Tab ────────────────────────────────────────────────

interface TabProps {
  t: ReturnType<typeof useTranslations>;
}

function RulesTab({ t }: TabProps) {
  const [rules, setRules] = useState<PointRule[] | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    pointsAdminApi.listRules().then(setRules).catch(() => setRules([]));
  }, []);

  const handleSave = async (rule: PointRule, patch: Partial<PointRule>) => {
    setSavingKey(rule.ruleKey);
    try {
      const updated = await pointsAdminApi.updateRule(rule.ruleKey, patch);
      setRules((prev) =>
        prev ? prev.map((r) => (r.ruleKey === rule.ruleKey ? updated : r)) : prev,
      );
      toast.success(t("toasts.ruleUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setSavingKey(null);
    }
  };

  if (!rules) return <TabLoader />;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-page)] text-xs text-[var(--color-text-secondary)]">
          <tr>
            <th className="text-start px-4 py-3 font-medium">{t("rules.ruleColumn")}</th>
            <th className="text-start px-4 py-3 font-medium">{t("rules.amountColumn")}</th>
            <th className="text-start px-4 py-3 font-medium">{t("rules.expiryColumn")}</th>
            <th className="text-start px-4 py-3 font-medium">{t("rules.statusColumn")}</th>
            <th className="text-end px-4 py-3 font-medium">{t("rules.actionsColumn")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rules.map((rule) => (
            <RuleRow
              key={rule.ruleKey}
              rule={rule}
              saving={savingKey === rule.ruleKey}
              onSave={(patch) => handleSave(rule, patch)}
              t={t}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RuleRowProps {
  rule: PointRule;
  saving: boolean;
  onSave: (patch: Partial<PointRule>) => void;
  t: ReturnType<typeof useTranslations>;
}

// Known rule keys we have translations for. Anything else (future rules
// added in DB before code catches up) falls through to the raw key.
const KNOWN_RULE_KEYS = ["signup", "course_completed", "review_approved"] as const;

function RuleRow({ rule, saving, onSave, t }: RuleRowProps) {
  const [amount, setAmount] = useState(rule.pointsAmount);
  const [expiry, setExpiry] = useState<number | "">(rule.expiresAfterDays ?? "");
  const dirty =
    amount !== rule.pointsAmount ||
    (expiry === "" ? rule.expiresAfterDays != null : expiry !== rule.expiresAfterDays);

  const isKnown = (KNOWN_RULE_KEYS as readonly string[]).includes(rule.ruleKey);
  const titleText = isKnown
    ? t(`rules.keys.${rule.ruleKey}.title` as `rules.keys.signup.title`)
    : rule.ruleKey;
  const descriptionText =
    rule.description ||
    (isKnown
      ? t(`rules.keys.${rule.ruleKey}.description` as `rules.keys.signup.description`)
      : "");

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-[var(--color-text-primary)]">
          {titleText}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
          {descriptionText}
        </p>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-20 px-2 py-1 text-sm border border-[var(--color-input-border)] rounded"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          value={expiry}
          onChange={(e) =>
            setExpiry(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder={t("rules.neverExpires")}
          className="w-24 px-2 py-1 text-sm border border-[var(--color-input-border)] rounded"
        />
        <span className="text-xs text-[var(--color-text-secondary)] ms-2">
          {t("rules.daysSuffix")}
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onSave({ isActive: !rule.isActive })}
          className={`px-2 py-1 rounded text-xs font-medium ${rule.isActive ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}
        >
          {rule.isActive ? t("rules.active") : t("rules.inactive")}
        </button>
      </td>
      <td className="px-4 py-3 text-end">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() =>
            onSave({
              pointsAmount: amount,
              expiresAfterDays: expiry === "" ? null : Number(expiry),
            })
          }
          className="px-3 py-1.5 text-xs font-medium btn-gold rounded-lg text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : t("save")}
        </button>
      </td>
    </tr>
  );
}

// ─── Config Tab ───────────────────────────────────────────────

function ConfigTab({ t }: TabProps) {
  const [config, setConfig] = useState<PointsConfig | null>(null);
  const [draft, setDraft] = useState<PointsConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    pointsAdminApi.getConfig().then((cfg) => {
      setConfig(cfg);
      setDraft(cfg);
    });
  }, []);

  const dirty = useMemo(() => {
    if (!config || !draft) return false;
    return JSON.stringify(config) !== JSON.stringify(draft);
  }, [config, draft]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await pointsAdminApi.updateConfig(draft);
      setConfig(updated);
      setDraft(updated);
      toast.success(t("toasts.configUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setSaving(false);
    }
  };

  if (!draft) return <TabLoader />;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <ConfigField
          label={t("config.conversionRate")}
          hint={t("config.conversionRateHint")}
          value={draft.conversionRatePointsPerSar}
          onChange={(v) =>
            setDraft({ ...draft, conversionRatePointsPerSar: v })
          }
          min={1}
        />
        <ConfigField
          label={t("config.minRedemption")}
          hint={t("config.minRedemptionHint")}
          value={draft.minRedemptionPoints}
          onChange={(v) => setDraft({ ...draft, minRedemptionPoints: v })}
          min={1}
        />
        <ConfigField
          label={t("config.maxRedemptionPct")}
          hint={t("config.maxRedemptionPctHint")}
          value={draft.maxRedemptionPct}
          onChange={(v) => setDraft({ ...draft, maxRedemptionPct: v })}
          min={0}
          max={100}
        />
        <ConfigField
          label={t("config.defaultExpiration")}
          hint={t("config.defaultExpirationHint")}
          value={draft.defaultExpirationDays ?? 0}
          onChange={(v) =>
            setDraft({ ...draft, defaultExpirationDays: v === 0 ? null : v })
          }
          min={0}
        />
      </div>

      <label className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={draft.combinableWithCoupons}
          onChange={(e) =>
            setDraft({ ...draft, combinableWithCoupons: e.target.checked })
          }
        />
        <span className="text-sm">{t("config.combinable")}</span>
      </label>

      <div className="pt-4 border-t border-[var(--color-border)]">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium btn-gold rounded-lg text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t("save")}
        </button>
      </div>
    </div>
  );
}

interface ConfigFieldProps {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

function ConfigField({ label, hint, value, onChange, min, max }: ConfigFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)]">
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg"
      />
      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{hint}</p>
    </div>
  );
}

// ─── Courses Tab ──────────────────────────────────────────────

function CoursesTab({ t }: TabProps) {
  const [courses, setCourses] = useState<AdminCourseRedemption[] | null>(null);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      pointsAdminApi.listCourses(search || undefined).then(setCourses);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const handleToggle = async (course: AdminCourseRedemption) => {
    setSavingId(course.id);
    try {
      const updated = await pointsAdminApi.updateCourseRedemption(course.id, {
        redeemableForFree: !course.redeemableForFree,
      });
      setCourses((prev) =>
        prev
          ? prev.map((c) =>
              c.id === course.id
                ? { ...c, ...updated, redeemableForFree: updated.redeemableForFree ?? false }
                : c,
            )
          : prev,
      );
      toast.success(t("toasts.courseUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setSavingId(null);
    }
  };

  const handleCostChange = async (
    course: AdminCourseRedemption,
    cost: number | null,
  ) => {
    setSavingId(course.id);
    try {
      const updated = await pointsAdminApi.updateCourseRedemption(course.id, {
        freeUnlockCostPoints: cost,
      });
      setCourses((prev) =>
        prev
          ? prev.map((c) =>
              c.id === course.id ? { ...c, ...updated, redeemableForFree: updated.redeemableForFree ?? false } : c,
            )
          : prev,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("courses.searchPlaceholder")}
          className="w-full pl-10 pr-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg"
        />
      </div>

      {!courses ? (
        <TabLoader />
      ) : (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-page)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium">{t("courses.titleColumn")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("courses.priceColumn")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("courses.costColumn")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("courses.redeemableColumn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {courses.map((course) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  saving={savingId === course.id}
                  onToggle={() => handleToggle(course)}
                  onCostChange={(cost) => handleCostChange(course, cost)}
                  t={t}
                />
              ))}
              {courses.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]"
                  >
                    {t("courses.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface CourseRowProps {
  course: AdminCourseRedemption;
  saving: boolean;
  onToggle: () => void;
  onCostChange: (cost: number | null) => void;
  t: ReturnType<typeof useTranslations>;
}

function CourseRow({ course, saving, onToggle, onCostChange, t }: CourseRowProps) {
  const [cost, setCost] = useState<string>(
    course.freeUnlockCostPoints != null ? String(course.freeUnlockCostPoints) : "",
  );

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-[var(--color-text-primary)]">
          {course.title}
        </p>
        {course.titleAr && (
          <p className="text-xs text-[var(--color-text-secondary)]" dir="rtl">
            {course.titleAr}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
        {Number(course.price ?? 0)} SAR
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={1}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onBlur={() => {
            const val = cost === "" ? null : Number(cost);
            if (val !== course.freeUnlockCostPoints) {
              onCostChange(val);
            }
          }}
          placeholder={t("courses.autoCost")}
          className="w-24 px-2 py-1 text-xs border border-[var(--color-input-border)] rounded"
        />
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          className={`px-3 py-1 rounded-full text-xs font-medium ${course.redeemableForFree ? "bg-[#16A34A] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}
        >
          {saving ? "…" : course.redeemableForFree ? t("courses.enabled") : t("courses.disabled")}
        </button>
      </td>
    </tr>
  );
}

// ─── Grants Tab ───────────────────────────────────────────────

function GrantsTab({ t }: TabProps) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<AdminUserSearchResult[] | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserSearchResult | null>(null);
  const [delta, setDelta] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [granting, setGranting] = useState(false);

  // Load students on mount + reload (debounced) on every search change.
  // Backend returns the 30 most-recent students when search is empty/short,
  // so the picker is never blank.
  useEffect(() => {
    const handle = setTimeout(() => {
      pointsAdminApi.searchUsers(search).then(setStudents);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const handleGrant = async () => {
    if (!selectedUser || delta === 0 || reason.trim().length < 3) return;
    setGranting(true);
    try {
      await pointsAdminApi.grant({
        userId: selectedUser.id,
        delta,
        reason: reason.trim(),
      });
      toast.success(t("toasts.granted"));
      setDelta(0);
      setReason("");
      setSelectedUser(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.error"));
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: student picker (2/3 width) — always visible with default list */}
      <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("grants.pickStudentTitle")}
          </h3>
          {students && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {t("grants.studentCount", { count: students.length })}
            </span>
          )}
        </div>
        <div className="relative mb-3">
          <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("grants.searchPlaceholder")}
            className="w-full pl-10 pr-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg"
          />
        </div>
        {!students ? (
          <TabLoader />
        ) : students.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">
            {t("grants.noStudents")}
          </p>
        ) : (
          <ul className="max-h-[480px] overflow-y-auto divide-y divide-[var(--color-border)]">
            {students.map((u) => {
              const isActive = selectedUser?.id === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-start px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-[var(--color-primary)]/10" : "hover:bg-[var(--color-border-subtle)]"}`}
                  >
                    <div className="font-medium text-[var(--color-text-primary)]">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                        u.email}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {u.email}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Right: form (1/3 width) */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 self-start">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {t("grants.formTitle")}
        </h3>

        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            {t("grants.userLabel")}
          </label>
          {selectedUser ? (
            <div className="bg-[var(--color-border-subtle)] px-3 py-2 rounded-lg text-sm">
              <div className="font-medium">
                {[selectedUser.firstName, selectedUser.lastName]
                  .filter(Boolean)
                  .join(" ") || selectedUser.email}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                {selectedUser.email}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)] italic">
              {t("grants.noUserSelected")}
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            {t("grants.deltaLabel")}
          </label>
          <input
            type="number"
            value={delta || ""}
            onChange={(e) => setDelta(Number(e.target.value))}
            placeholder="±100"
            className="w-full px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg"
          />
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
            {t("grants.deltaHint")}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            {t("grants.reasonLabel")}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t("grants.reasonPlaceholder")}
            className="w-full px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg"
          />
        </div>

        <button
          type="button"
          disabled={
            !selectedUser || delta === 0 || reason.trim().length < 3 || granting
          }
          onClick={handleGrant}
          className="w-full px-4 py-2 text-sm font-medium btn-gold rounded-lg text-white disabled:opacity-40"
        >
          {granting ? (
            <Loader2 className="w-4 h-4 animate-spin inline" />
          ) : (
            t("grants.applyButton")
          )}
        </button>
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────

function HistoryTab({ t }: TabProps) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<AdminUserSearchResult[] | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserSearchResult | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  // Always-loaded student list (default 30 most-recent if no search).
  useEffect(() => {
    const handle = setTimeout(() => {
      pointsAdminApi.searchUsers(search).then(setStudents);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Auto-select the first (most-recent) student on initial load so the
  // panel isn't blank — avoids forcing the admin to click before they
  // see anything. Once they've picked someone manually, leave it alone.
  useEffect(() => {
    if (selectedUser) return;
    if (!students || students.length === 0) return;
    setSelectedUser(students[0]);
  }, [students, selectedUser]);

  useEffect(() => {
    if (!selectedUser) {
      setBalance(null);
      setTransactions([]);
      return;
    }
    setLoading(true);
    Promise.all([
      pointsAdminApi.getUserBalance(selectedUser.id),
      pointsAdminApi.getUserTransactions(selectedUser.id, { limit: 50 }),
    ])
      .then(([bal, txs]) => {
        setBalance(bal.balance);
        setTransactions(txs.data);
      })
      .finally(() => setLoading(false));
  }, [selectedUser]);

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: student picker — always visible */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 self-start">
        <div className="relative mb-3">
          <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="w-full pl-10 pr-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg"
          />
        </div>
        {!students ? (
          <TabLoader />
        ) : students.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">
            {t("grants.noStudents")}
          </p>
        ) : (
          <ul className="max-h-[600px] overflow-y-auto divide-y divide-[var(--color-border)]">
            {students.map((u) => {
              const isActive = selectedUser?.id === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-start px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-[var(--color-primary)]/10" : "hover:bg-[var(--color-border-subtle)]"}`}
                  >
                    <div className="font-medium text-[var(--color-text-primary)] truncate">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") ||
                        u.email}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] truncate">
                      {u.email}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Right: ledger view (2/3 width) */}
      <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
        {!selectedUser ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--color-text-secondary)]">
            <History className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">{t("history.selectAStudent")}</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4 pb-4 border-b border-[var(--color-border)]">
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {[selectedUser.firstName, selectedUser.lastName]
                    .filter(Boolean)
                    .join(" ") || selectedUser.email}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {selectedUser.email}
                </p>
              </div>
              <div className="text-end">
                <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wide">
                  {t("history.balanceLabel")}
                </p>
                <p className="text-3xl font-bold text-[var(--color-primary)]">
                  {balance ?? "—"}
                </p>
              </div>
            </div>

            {loading ? (
              <TabLoader />
            ) : transactions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">
                {t("history.noTransactions")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="text-start px-3 py-2 font-medium">{t("history.dateColumn")}</th>
                      <th className="text-start px-3 py-2 font-medium">{t("history.reasonColumn")}</th>
                      <th className="text-end px-3 py-2 font-medium">{t("history.deltaColumn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                          {dateFmt.format(new Date(tx.createdAt))}
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-[var(--color-text-primary)]">
                            {tx.ruleDescription || tx.reason}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-secondary)]">
                            {tx.reason}
                          </p>
                        </td>
                        <td
                          className={`px-3 py-2 text-end font-semibold whitespace-nowrap ${tx.delta > 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}
                        >
                          {tx.delta > 0 ? "+" : ""}
                          {tx.delta}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────

function TabLoader() {
  return (
    <div className="flex items-center justify-center py-16 text-[var(--color-text-secondary)]">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}

export default PointsSystemContent;
