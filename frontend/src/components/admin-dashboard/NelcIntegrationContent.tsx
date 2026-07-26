"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Copy,
  Database,
  Eye,
  FileJson,
  Globe,
  Inbox,
  Layout as LayoutIcon,
  Loader2,
  LogIn,
  LogOut,
  MoreHorizontal,
  Play,
  RefreshCw,
  Send,
  Server,
  Settings as SettingsIcon,
  Shield,
  Star,
  TrendingUp,
  User as UserIcon,
  UserPlus,
  Users as UsersIcon,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  nelcXapiApi,
  type NelcLrsMode,
  type NelcXapiConfig,
  type NelcXapiLogDetail,
  type NelcXapiLogRow,
  type NelcXapiMode,
  type NelcXapiStatementStatus,
  type NelcXapiStats,
  type NelcXapiTestConnectionResult,
} from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useUserRoles } from "@/contexts";

const PAGE_SIZE = 50;

type LucideIcon = React.ComponentType<{ className?: string }>;

/** Visual + i18n metadata per xAPI verb. Keeps the table, filter
 *  dropdown, and detail drawer consistent — change once, applies
 *  everywhere a verb is rendered. */
interface VerbDescriptor {
  icon: LucideIcon;
  badgeClass: string;
  labelKey: string;
}

const VERB_DESCRIPTORS: Record<string, VerbDescriptor> = {
  "http://adlnet.gov/expapi/verbs/logged-in": {
    icon: LogIn,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    labelKey: "verbLoggedIn",
  },
  "http://adlnet.gov/expapi/verbs/registered": {
    icon: UserPlus,
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    labelKey: "verbRegistered",
  },
  "http://adlnet.gov/expapi/verbs/initialized": {
    icon: Play,
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    labelKey: "verbInitialized",
  },
  "https://w3id.org/xapi/acrossx/verbs/watched": {
    icon: Eye,
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    labelKey: "verbWatched",
  },
  "http://adlnet.gov/expapi/verbs/completed": {
    icon: CheckCircle2,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    labelKey: "verbCompleted",
  },
  "http://adlnet.gov/expapi/verbs/attempted": {
    icon: ClipboardList,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    labelKey: "verbAttempted",
  },
  "http://id.tincanapi.com/verb/rated": {
    icon: Star,
    badgeClass: "bg-pink-50 text-pink-700 border-pink-200",
    labelKey: "verbRated",
  },
  "http://id.tincanapi.com/verb/earned": {
    icon: Award,
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200",
    labelKey: "verbEarned",
  },
  "http://adlnet.gov/expapi/verbs/progressed": {
    icon: TrendingUp,
    badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    labelKey: "verbProgressed",
  },
  "http://adlnet.gov/expapi/verbs/attended": {
    icon: UsersIcon,
    badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    labelKey: "verbAttended",
  },
};

const FALLBACK_VERB: VerbDescriptor = {
  icon: Activity,
  badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
  labelKey: "verbUnknown",
};

/** Order matches the natural learner journey so the verb filter menu
 *  reads top-to-bottom as you'd expect to see events fire. */
const VERB_FILTER_ORDER: string[] = [
  "http://adlnet.gov/expapi/verbs/logged-in",
  "http://adlnet.gov/expapi/verbs/registered",
  "http://adlnet.gov/expapi/verbs/initialized",
  "https://w3id.org/xapi/acrossx/verbs/watched",
  "http://adlnet.gov/expapi/verbs/completed",
  "http://adlnet.gov/expapi/verbs/attempted",
  "http://id.tincanapi.com/verb/rated",
  "http://id.tincanapi.com/verb/earned",
  "http://adlnet.gov/expapi/verbs/progressed",
  "http://adlnet.gov/expapi/verbs/attended",
];

type StatusFilterValue = "" | NelcXapiStatementStatus;
const STATUS_FILTERS: { value: StatusFilterValue; labelKey: string }[] = [
  { value: "", labelKey: "filters.allStatuses" },
  { value: "sent", labelKey: "status.sent" },
  { value: "pending", labelKey: "status.pending" },
  { value: "failed", labelKey: "status.failed" },
];

const NelcIntegrationContent = () => {
  const t = useTranslations("adminDashboard.nelcIntegration");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [config, setConfig] = useState<NelcXapiConfig | null>(null);
  const [stats, setStats] = useState<NelcXapiStats | null>(null);
  const [rows, setRows] = useState<NelcXapiLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("");
  const [verbFilter, setVerbFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] =
    useState<NelcXapiTestConnectionResult | null>(null);
  const [triggering, setTriggering] = useState<"joined" | "left" | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<NelcXapiLogDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"structured" | "raw">("structured");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  // ── Environment mode toggle ────────────────────────────────────────
  const [mode, setMode] = useState<NelcXapiMode | null>(null);
  const [modeSwitchTo, setModeSwitchTo] = useState<NelcLrsMode | null>(null);
  const [modeSwitching, setModeSwitching] = useState(false);
  const userRoles = useUserRoles();
  const isSuperAdmin = userRoles.includes("SUPER_ADMIN");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Data loading ────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, logRes, modeRes] = await Promise.allSettled([
        nelcXapiApi.getConfig(),
        nelcXapiApi.getStats(),
        nelcXapiApi.getLog({
          page,
          pageSize: PAGE_SIZE,
          status: statusFilter || undefined,
          verb: verbFilter || undefined,
        }),
        nelcXapiApi.getMode(),
      ]);
      if (configRes.status === "fulfilled") setConfig(configRes.value);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (logRes.status === "fulfilled") {
        setRows(logRes.value.rows);
        setTotal(logRes.value.total);
      }
      if (modeRes.status === "fulfilled") setMode(modeRes.value);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, verbFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, verbFilter]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await nelcXapiApi.testConnection();
      setTestResult(result);
      if (result.ok) {
        toast.success(t("testSuccess"));
      } else {
        toast.error(t("testFailure"));
      }
    } catch (err) {
      toast.error((err as Error).message || t("testFailure"));
    } finally {
      setTesting(false);
    }
  };

  // "left" trigger goes through a confirm dialog because it signals
  // offboarding to NELC and shouldn't be a one-click accident.
  const [confirmLeftOpen, setConfirmLeftOpen] = useState(false);

  const runTrigger = async (kind: "joined" | "left") => {
    setTriggering(kind);
    try {
      const res =
        kind === "joined"
          ? await nelcXapiApi.triggerJoined()
          : await nelcXapiApi.triggerLeft();
      if (res.ok && res.statementId) {
        toast.success(
          t(kind === "joined" ? "triggerJoinedSuccess" : "triggerLeftSuccess"),
        );
        setTimeout(() => void loadAll(), 1500);
      } else {
        toast.error(t("triggerFailed"));
      }
    } catch (err) {
      toast.error((err as Error).message || t("triggerFailed"));
    } finally {
      setTriggering(null);
    }
  };

  const handleTrigger = (kind: "joined" | "left") => {
    if (kind === "left") {
      setConfirmLeftOpen(true);
      return;
    }
    void runTrigger("joined");
  };

  const confirmLeftTrigger = async () => {
    setConfirmLeftOpen(false);
    await runTrigger("left");
  };

  const confirmModeSwitch = async () => {
    if (!modeSwitchTo) return;
    setModeSwitching(true);
    try {
      const res = await nelcXapiApi.setMode(modeSwitchTo);
      toast.success(
        t("mode.switched", { mode: t(`mode.modeLabel.${res.mode}`) }),
      );
      setModeSwitchTo(null);
      // Re-fetch everything: config endpoint + mode panel both change.
      await loadAll();
    } catch (err) {
      toast.error((err as Error).message || t("mode.switchFailed"));
    } finally {
      setModeSwitching(false);
    }
  };

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await nelcXapiApi.retry(id);
      if (res.enqueued) {
        toast.success(t("retryQueued"));
        setTimeout(() => void loadAll(), 1500);
      } else {
        toast.message(t("retryNotEnqueued"));
      }
    } catch (err) {
      toast.error((err as Error).message || t("retryFailed"));
    } finally {
      setRetrying(null);
    }
  };

  const openDrawer = async (id: string) => {
    setDrawerOpen(true);
    setDrawerData(null);
    setDrawerTab("structured");
    setDrawerLoading(true);
    try {
      const detail = await nelcXapiApi.getLogDetail(id);
      setDrawerData(detail);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return "—";
      try {
        return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        });
      } catch {
        return iso;
      }
    },
    [locale],
  );

  const verbLabel = useCallback(
    (verb: string) => {
      const d = VERB_DESCRIPTORS[verb];
      return d ? t(d.labelKey) : verb;
    },
    [t],
  );

  const filtersActive = statusFilter !== "" || verbFilter !== "";

  // Lookup labels for the trigger dropdowns.
  const statusFilterLabel = useMemo(() => {
    const entry = STATUS_FILTERS.find((s) => s.value === statusFilter);
    return entry ? t(entry.labelKey) : t("filters.allStatuses");
  }, [statusFilter, t]);

  const verbFilterLabel = useMemo(() => {
    if (!verbFilter) return t("filters.allVerbs");
    return verbLabel(verbFilter);
  }, [verbFilter, t, verbLabel]);

  return (
    <>
      <AdminNavbar admin={admin} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0 space-y-6">
              {/* ─── Header ──────────────────────────────────────── */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2.5">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] text-[var(--color-primary)]">
                      <Wifi className="w-4.5 h-4.5" />
                    </span>
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 ml-12">
                    {t("subtitle")}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => void loadAll()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-60"
                    aria-label={t("refresh")}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                    />
                    <span className="hidden sm:inline">{t("refresh")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg disabled:opacity-60 font-medium text-sm"
                  >
                    {testing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                    {t("testConnection")}
                  </button>

                  {/* Admin actions — destructive items hidden behind a
                      menu so 'Send left' isn't one careless click away. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("adminActions")}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-page)] transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">
                          {t("adminActions")}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align={isRTL ? "start" : "end"}
                      className="min-w-[240px]"
                    >
                      <DropdownMenuItem
                        onClick={() => void handleTrigger("joined")}
                        disabled={triggering !== null}
                        title={t("triggerJoinedHint")}
                      >
                        {triggering === "joined" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogIn className="w-4 h-4" />
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {t("triggerJoined")}
                          </span>
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {t("triggerJoinedShort")}
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        danger
                        onClick={() => void handleTrigger("left")}
                        disabled={triggering !== null}
                        title={t("triggerLeftHint")}
                      >
                        {triggering === "left" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogOut className="w-4 h-4" />
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {t("triggerLeft")}
                          </span>
                          <span className="text-xs opacity-80">
                            {t("triggerLeftShort")}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* ─── Test result banner ──────────────────────────── */}
              {testResult && (
                <TestResultBanner
                  result={testResult}
                  onClose={() => setTestResult(null)}
                  onCopy={handleCopy}
                  t={t}
                />
              )}

              {/* ─── KPI strip ───────────────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  icon={Activity}
                  iconBg="bg-[var(--color-border-subtle)]"
                  iconColor="text-[var(--color-primary)]"
                  label={t("kpi.last24hTotal")}
                  value={String(stats?.last24h.total ?? "—")}
                  sub={t("kpi.statementsTried")}
                />
                <KpiCard
                  icon={CheckCircle2}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                  label={t("kpi.last24hSent")}
                  value={String(stats?.last24h.sent ?? "—")}
                  sub={
                    stats?.lastSuccessAt
                      ? `${t("kpi.lastSync")} ${fmtDate(stats.lastSuccessAt)}`
                      : t("kpi.never")
                  }
                />
                <KpiCard
                  icon={Clock}
                  iconBg="bg-amber-50"
                  iconColor="text-amber-600"
                  label={t("kpi.pending")}
                  value={String(stats?.pendingTotal ?? "—")}
                  sub={t("kpi.awaitingRetry")}
                />
                <KpiCard
                  icon={AlertCircle}
                  iconBg="bg-red-50"
                  iconColor="text-red-600"
                  label={t("kpi.failed")}
                  value={String(stats?.failedTotal ?? "—")}
                  sub={t("kpi.needsAttention")}
                />
              </div>

              {/* ─── Environment mode panel ──────────────────────── */}
              {mode && (
                <div
                  className={`rounded-xl border p-5 ${
                    mode.mode === "production"
                      ? "bg-emerald-50/40 border-emerald-200"
                      : "bg-amber-50/40 border-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`shrink-0 p-3 rounded-lg ${
                        mode.mode === "production"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {t("mode.title")}
                        </h2>
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                            mode.mode === "production"
                              ? "bg-emerald-600 text-white border-emerald-700"
                              : "bg-amber-500 text-white border-amber-600"
                          }`}
                        >
                          {t(`mode.modeLabel.${mode.mode}`)}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                          {t(`mode.source.${mode.source}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {mode.mode === "production"
                          ? t("mode.descriptionProd")
                          : t("mode.descriptionStaging")}
                      </p>
                      <div className="mt-3 text-xs font-mono break-all text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] rounded-md border border-[var(--color-border)] px-3 py-2">
                        {mode.activeEndpoint}
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setModeSwitchTo(
                            mode.mode === "production"
                              ? "staging"
                              : "production",
                          )
                        }
                        disabled={
                          modeSwitching ||
                          (mode.mode === "production"
                            ? !mode.passwordsAvailable.staging
                            : !mode.passwordsAvailable.production)
                        }
                        title={
                          mode.mode === "production"
                            ? mode.passwordsAvailable.staging
                              ? t("mode.switchToStaging")
                              : t("mode.passwordMissingStaging")
                            : mode.passwordsAvailable.production
                              ? t("mode.switchToProd")
                              : t("mode.passwordMissingProd")
                        }
                        className={`shrink-0 px-4 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          mode.mode === "production"
                            ? "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
                            : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        }`}
                      >
                        {mode.mode === "production"
                          ? t("mode.switchToStaging")
                          : t("mode.switchToProd")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Config card (collapsible, grouped) ──────────── */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setConfigOpen((v) => !v)}
                  className="w-full flex items-center gap-2 px-5 py-4 hover:bg-[var(--color-surface-page)] transition-colors"
                  aria-expanded={configOpen}
                >
                  <SettingsIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("configTitle")}
                  </h2>
                  {config && (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        config.enabled
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {config.enabled ? t("enabled") : t("disabled")}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    {configOpen ? t("hideDetails") : t("showDetails")}
                    {configOpen ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>

                {configOpen && (
                  <div className="border-t border-[var(--color-border)]">
                    {config ? (
                      <div className="divide-y divide-[var(--color-border)]">
                        <ConfigGroup
                          icon={Server}
                          title={t("configGroups.connection")}
                          items={[
                            {
                              label: t("config.endpoint"),
                              value: config.endpoint,
                              mono: true,
                              copyable: true,
                            },
                            {
                              label: t("config.xapiVersion"),
                              value: config.xapiVersion,
                              mono: true,
                            },
                            {
                              label: t("config.maxAttempts"),
                              value: String(config.maxAttempts),
                              mono: true,
                            },
                            {
                              label: t("config.timeoutMs"),
                              value: `${config.timeoutMs} ms`,
                              mono: true,
                            },
                          ]}
                          onCopy={handleCopy}
                          t={t}
                        />
                        <ConfigGroup
                          icon={Shield}
                          title={t("configGroups.auth")}
                          items={[
                            {
                              label: t("config.username"),
                              value: config.username || "—",
                              mono: true,
                              copyable: !!config.username,
                            },
                            {
                              label: t("config.password"),
                              value: config.passwordMasked || "—",
                              mono: true,
                              secret: true,
                            },
                          ]}
                          onCopy={handleCopy}
                          t={t}
                        />
                        <ConfigGroup
                          icon={Globe}
                          title={t("configGroups.platform")}
                          items={[
                            {
                              label: t("config.platformIdentifier"),
                              value: config.platformIdentifier,
                              mono: true,
                              copyable: true,
                            },
                            {
                              label: t("config.lmsUrl"),
                              value: config.lmsUrl,
                              mono: true,
                              copyable: true,
                            },
                            {
                              label: t("config.platformNameEn"),
                              value: config.platformNameEn,
                            },
                            {
                              label: t("config.platformNameAr"),
                              value: config.platformNameAr,
                            },
                          ]}
                          onCopy={handleCopy}
                          t={t}
                        />
                      </div>
                    ) : (
                      <div className="px-5 py-6 text-sm text-[var(--color-text-secondary)]">
                        {loading ? t("loading") : t("configUnavailable")}
                      </div>
                    )}
                    <div className="px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-page)] text-xs text-[var(--color-text-secondary)]">
                      {t("configHint")}
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Transmission log ────────────────────────────── */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-border)]">
                  <Database className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t("logTitle")}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                    {t("logCount", { count: total })}
                  </span>
                </div>

                {/* Filters */}
                <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]/50">
                  <FilterDropdown
                    label={t("filterStatus")}
                    triggerLabel={statusFilterLabel}
                    isRTL={isRTL}
                  >
                    {STATUS_FILTERS.map((s) => (
                      <DropdownMenuItem
                        key={s.value}
                        onClick={() => setStatusFilter(s.value)}
                      >
                        <StatusIcon status={s.value} />
                        <span className="text-sm text-[var(--color-text-primary)]">
                          {t(s.labelKey)}
                        </span>
                        {statusFilter === s.value && (
                          <CheckCircle2 className="w-3.5 h-3.5 ms-auto text-[var(--color-primary)]" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </FilterDropdown>

                  <FilterDropdown
                    label={t("filterVerb")}
                    triggerLabel={verbFilterLabel}
                    isRTL={isRTL}
                  >
                    <DropdownMenuItem onClick={() => setVerbFilter("")}>
                      <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {t("filters.allVerbs")}
                      </span>
                      {verbFilter === "" && (
                        <CheckCircle2 className="w-3.5 h-3.5 ms-auto text-[var(--color-primary)]" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {VERB_FILTER_ORDER.map((iri) => {
                      const d = VERB_DESCRIPTORS[iri] || FALLBACK_VERB;
                      const Icon = d.icon;
                      return (
                        <DropdownMenuItem
                          key={iri}
                          onClick={() => setVerbFilter(iri)}
                        >
                          <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          <span className="text-sm text-[var(--color-text-primary)]">
                            {t(d.labelKey)}
                          </span>
                          {verbFilter === iri && (
                            <CheckCircle2 className="w-3.5 h-3.5 ms-auto text-[var(--color-primary)]" />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </FilterDropdown>

                  {filtersActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("");
                        setVerbFilter("");
                      }}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline underline-offset-2"
                    >
                      {t("clearFilters")}
                    </button>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-surface-page)]/60 text-[var(--color-text-secondary)]">
                      <tr>
                        <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} font-medium text-xs uppercase tracking-wide`}>
                          {t("table.time")}
                        </th>
                        <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} font-medium text-xs uppercase tracking-wide`}>
                          {t("table.verb")}
                        </th>
                        <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} font-medium text-xs uppercase tracking-wide`}>
                          {t("table.activity")}
                        </th>
                        <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} font-medium text-xs uppercase tracking-wide`}>
                          {t("table.status")}
                        </th>
                        <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} font-medium text-xs uppercase tracking-wide`}>
                          {t("table.attempts")}
                        </th>
                        <th className={`px-4 py-3 ${isRTL ? "text-right" : "text-left"} font-medium text-xs uppercase tracking-wide`}>
                          {t("table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-[var(--color-text-secondary)]"
                          >
                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12">
                            <EmptyState
                              icon={Inbox}
                              title={
                                filtersActive ? t("emptyFiltered") : t("emptyLog")
                              }
                              subtitle={
                                filtersActive
                                  ? t("emptyFilteredHint")
                                  : t("emptyLogHint")
                              }
                              actionLabel={
                                filtersActive ? t("clearFilters") : undefined
                              }
                              onAction={
                                filtersActive
                                  ? () => {
                                      setStatusFilter("");
                                      setVerbFilter("");
                                    }
                                  : undefined
                              }
                            />
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => {
                          const desc = VERB_DESCRIPTORS[r.verb] || FALLBACK_VERB;
                          const Icon = desc.icon;
                          return (
                            <tr
                              key={r.id}
                              className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-page)]/40 transition-colors"
                            >
                              <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--color-text-secondary)]">
                                {fmtDate(r.createdAt)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${desc.badgeClass}`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {t(desc.labelKey)}
                                </span>
                              </td>
                              <td className="px-4 py-3 max-w-[420px]">
                                <div
                                  className="truncate font-mono text-xs text-[var(--color-text-primary)]"
                                  title={r.objectActivityId}
                                >
                                  {r.objectActivityId}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <StatusPill
                                  status={r.status}
                                  httpStatus={r.lastHttpStatus}
                                  t={t}
                                />
                                {r.lastError && (
                                  <div
                                    className="text-xs text-red-600 mt-1 max-w-[300px] truncate"
                                    title={r.lastError}
                                  >
                                    {r.lastError}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                                {r.attemptCount}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void openDrawer(r.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-page)] transition-colors"
                                  >
                                    <FileJson className="w-3 h-3" />
                                    {t("viewJson")}
                                  </button>
                                  {r.status !== "sent" && (
                                    <button
                                      type="button"
                                      onClick={() => void handleRetry(r.id)}
                                      disabled={retrying === r.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-50"
                                    >
                                      {retrying === r.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <RefreshCw className="w-3 h-3" />
                                      )}
                                      {t("retry")}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] text-sm bg-[var(--color-surface-page)]/40">
                    <div className="text-[var(--color-text-secondary)] text-xs">
                      {t("pagination", { page, totalPages })}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-card)] transition-colors disabled:opacity-50"
                      >
                        {t("prev")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-card)] transition-colors disabled:opacity-50"
                      >
                        {t("next")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Detail drawer ───────────────────────────────────── */}
      {drawerOpen && (
        <StatementDetailDrawer
          loading={drawerLoading}
          data={drawerData}
          tab={drawerTab}
          onTabChange={setDrawerTab}
          onClose={() => setDrawerOpen(false)}
          onCopy={handleCopy}
          fmtDate={fmtDate}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* ─── Mode-switch confirmation modal ──────────────────── */}
      {modeSwitchTo && mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-2xl max-w-md w-full">
            <div
              className={`px-5 py-4 border-b border-[var(--color-border)] flex items-center gap-3 ${
                modeSwitchTo === "production"
                  ? "bg-emerald-50/50"
                  : "bg-amber-50/50"
              }`}
            >
              <Shield
                className={`w-5 h-5 ${
                  modeSwitchTo === "production"
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {modeSwitchTo === "production"
                  ? t("mode.confirmProdTitle")
                  : t("mode.confirmStagingTitle")}
              </h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[var(--color-text-primary)]">
                {modeSwitchTo === "production"
                  ? t("mode.confirmProdBody")
                  : t("mode.confirmStagingBody")}
              </p>
              <div className="text-xs font-mono break-all bg-[var(--color-surface-page)] rounded-md border border-[var(--color-border)] px-3 py-2 text-[var(--color-text-secondary)]">
                {modeSwitchTo === "production"
                  ? mode.endpoints.production
                  : mode.endpoints.staging}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModeSwitchTo(null)}
                disabled={modeSwitching}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50"
              >
                {t("mode.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmModeSwitch()}
                disabled={modeSwitching}
                className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 flex items-center gap-2 ${
                  modeSwitchTo === "production"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {modeSwitching && <Loader2 className="w-4 h-4 animate-spin" />}
                {modeSwitchTo === "production"
                  ? t("mode.confirmProdButton")
                  : t("mode.confirmStagingButton")}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmLeftOpen}
        title={t("confirmLeftTitle")}
        message={t("confirmLeft")}
        confirmLabel={t("confirmLeftLabel")}
        cancelLabel={t("cancel")}
        loading={triggering === "left"}
        danger
        onConfirm={confirmLeftTrigger}
        onClose={() => triggering !== "left" && setConfirmLeftOpen(false)}
      />
    </>
  );
};

// ══════════════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════════════

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--color-text-secondary)] truncate">
            {label}
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight">
            {value}
          </div>
        </div>
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] mt-2 truncate">
        {sub}
      </div>
    </div>
  );
}

interface ConfigItem {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  secret?: boolean;
}

function ConfigGroup({
  icon: Icon,
  title,
  items,
  onCopy,
  t,
}: {
  icon: LucideIcon;
  title: string;
  items: ConfigItem[];
  onCopy: (text: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {title}
        </h3>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <dt className="text-xs text-[var(--color-text-secondary)]">
              {item.label}
            </dt>
            <dd className="flex items-center gap-2 group">
              <span
                className={`flex-1 min-w-0 break-all text-[var(--color-text-primary)] ${
                  item.mono ? "font-mono text-xs" : "text-sm"
                } ${item.secret ? "tracking-widest" : ""}`}
              >
                {item.value}
              </span>
              {item.copyable && (
                <button
                  type="button"
                  onClick={() => onCopy(item.value)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--color-surface-page)]"
                  aria-label={t("copy")}
                  title={t("copy")}
                >
                  <Copy className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FilterDropdown({
  label,
  triggerLabel,
  isRTL,
  children,
}: {
  label: string;
  triggerLabel: string;
  isRTL: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-text-secondary)] hidden sm:inline">
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 min-w-[160px] justify-between px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-page)] transition-colors"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-secondary)] flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isRTL ? "end" : "start"}
          className="min-w-[220px] max-h-[400px] overflow-y-auto"
        >
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StatusIcon({ status }: { status: StatusFilterValue }) {
  if (status === "sent")
    return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  if (status === "failed")
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  if (status === "pending")
    return <Clock className="w-4 h-4 text-amber-600" />;
  return <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />;
}

function StatusPill({
  status,
  httpStatus,
  t,
}: {
  status: NelcXapiStatementStatus;
  httpStatus: number | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const config =
    status === "sent"
      ? {
          icon: CheckCircle2,
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          border: "border-emerald-200",
        }
      : status === "failed"
        ? {
            icon: AlertCircle,
            bg: "bg-red-50",
            text: "text-red-700",
            border: "border-red-200",
          }
        : {
            icon: Clock,
            bg: "bg-amber-50",
            text: "text-amber-700",
            border: "border-amber-200",
          };

  const Icon = config.icon;
  const label =
    status === "sent"
      ? t("status.sent")
      : status === "failed"
        ? t("status.failed")
        : t("status.pending");

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${config.bg} ${config.text} ${config.border}`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {httpStatus !== null && (
        <span className="opacity-70 font-mono ms-0.5">{httpStatus}</span>
      )}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-[var(--color-text-secondary)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {title}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-md">
        {subtitle}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function TestResultBanner({
  result,
  onClose,
  onCopy,
  t,
}: {
  result: NelcXapiTestConnectionResult;
  onClose: () => void;
  onCopy: (text: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const debugText = [
    `Endpoint: ${result.endpoint}`,
    `HTTP: ${result.httpStatus ?? "n/a"}`,
    result.errorText ? `Error: ${result.errorText}` : null,
    result.responseBody ? `Body: ${result.responseBody}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className={`rounded-xl border ${
        result.ok
          ? "bg-emerald-50 border-emerald-200"
          : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {result.ok ? (
          <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-medium text-sm ${
                result.ok ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {result.ok ? t("testSuccess") : t("testFailure")}
            </span>
            {result.httpStatus !== null && (
              <span
                className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                  result.ok
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                HTTP {result.httpStatus}
              </span>
            )}
          </div>
          <div className="text-xs mt-1.5 text-[var(--color-text-secondary)] break-all font-mono">
            {result.endpoint}
          </div>
          {result.errorText && (
            <div className="text-xs mt-2 text-red-700 break-all">
              {result.errorText}
            </div>
          )}
          {result.responseBody && (
            <pre className="text-xs mt-2 font-mono whitespace-pre-wrap break-all opacity-80 bg-white/60 p-2 rounded border border-[var(--color-border)] max-h-32 overflow-auto">
              {result.responseBody.slice(0, 400)}
            </pre>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onCopy(debugText)}
            className="p-1.5 rounded hover:bg-white/60 transition-colors"
            aria-label={t("testResult.copyDebug")}
            title={t("testResult.copyDebug")}
          >
            <Copy className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/60 transition-colors"
            aria-label={t("close")}
          >
            <X className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatementDetailDrawer({
  loading,
  data,
  tab,
  onTabChange,
  onClose,
  onCopy,
  fmtDate,
  isRTL,
  t,
}: {
  loading: boolean;
  data: NelcXapiLogDetail | null;
  tab: "structured" | "raw";
  onTabChange: (tab: "structured" | "raw") => void;
  onClose: () => void;
  onCopy: (text: string) => void;
  fmtDate: (iso: string | null) => string;
  isRTL: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const payload = data?.payload as Record<string, any> | undefined;
  const verb = payload?.verb as { id?: string; display?: Record<string, string> } | undefined;
  const verbDescriptor = verb?.id
    ? VERB_DESCRIPTORS[verb.id] || FALLBACK_VERB
    : FALLBACK_VERB;
  const VerbIcon = verbDescriptor.icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-stretch justify-end animate-in fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl bg-[var(--color-surface-card)] h-full overflow-y-auto flex flex-col ${
          isRTL ? "border-r" : "border-l"
        } border-[var(--color-border)] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface-card)] z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
              <FileJson className="w-4 h-4 text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t("drawerTitle")}
              </h3>
              {data && (
                <p className="text-xs text-[var(--color-text-secondary)] truncate font-mono">
                  {data.id}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--color-surface-page)] rounded transition-colors"
            aria-label={t("close")}
          >
            <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center px-5">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("drawer.notFound")}
            </p>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-[var(--color-border)] sticky top-[73px] bg-[var(--color-surface-card)] z-10">
              <button
                type="button"
                onClick={() => onTabChange("structured")}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === "structured"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <LayoutIcon className="w-4 h-4" />
                {t("drawer.tabs.structured")}
              </button>
              <button
                type="button"
                onClick={() => onTabChange("raw")}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === "raw"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <FileJson className="w-4 h-4" />
                {t("drawer.tabs.raw")}
              </button>
            </div>

            <div className="p-5 space-y-5">
              {tab === "structured" ? (
                <StructuredView
                  payload={payload || {}}
                  verbDescriptor={verbDescriptor}
                  VerbIcon={VerbIcon}
                  fmtDate={fmtDate}
                  t={t}
                />
              ) : (
                <RawJsonView
                  payload={payload || {}}
                  onCopy={onCopy}
                  t={t}
                />
              )}

              {/* Transmission attempts (always shown below) */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  {t("drawer.transmissions", { count: data.transmissions.length })}
                </h4>
                {data.transmissions.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)] italic px-3 py-4 bg-[var(--color-surface-page)] rounded border border-[var(--color-border)]">
                    {t("drawer.noTransmissions")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.transmissions.map((tr) => {
                      const ok = tr.httpStatus !== null && tr.httpStatus >= 200 && tr.httpStatus < 300;
                      return (
                        <div
                          key={tr.attemptNo}
                          className={`border rounded-lg p-3 text-xs ${
                            ok
                              ? "border-emerald-200 bg-emerald-50/40"
                              : "border-red-200 bg-red-50/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {t("drawer.attempt", { n: tr.attemptNo })}
                            </span>
                            <span className="text-[var(--color-text-secondary)]">
                              {fmtDate(tr.sentAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {ok ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                            )}
                            <span
                              className={`font-mono ${
                                ok ? "text-emerald-700" : "text-red-700"
                              }`}
                            >
                              HTTP {tr.httpStatus ?? "—"}
                            </span>
                          </div>
                          {tr.errorText && (
                            <div className="text-red-700 mt-1.5 break-all">
                              {tr.errorText}
                            </div>
                          )}
                          {tr.responseBody && (
                            <pre className="mt-1.5 whitespace-pre-wrap break-all opacity-70 bg-white/60 p-2 rounded text-[10px]">
                              {tr.responseBody.slice(0, 600)}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StructuredView({
  payload,
  verbDescriptor,
  VerbIcon,
  fmtDate,
  t,
}: {
  payload: Record<string, any>;
  verbDescriptor: VerbDescriptor;
  VerbIcon: LucideIcon;
  fmtDate: (iso: string | null) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  const actor = payload.actor as
    | { mbox?: string; name?: string; objectType?: string }
    | undefined;
  const verb = payload.verb as
    | { id?: string; display?: Record<string, string> }
    | undefined;
  const object = payload.object as
    | {
        id?: string;
        definition?: {
          name?: Record<string, string>;
          type?: string;
          description?: Record<string, string>;
        };
        objectType?: string;
      }
    | undefined;
  const context = payload.context as
    | {
        language?: string;
        platform?: string;
        instructor?: { name?: string; mbox?: string };
        contextActivities?: { parent?: any[] };
        extensions?: Record<string, any>;
      }
    | undefined;

  const objectName =
    object?.definition?.name?.["en-US"] ||
    object?.definition?.name?.["ar-SA"] ||
    "—";
  const actorEmail = actor?.mbox?.replace(/^mailto:/, "") || "—";

  return (
    <div className="space-y-4">
      {/* Verb chip */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${verbDescriptor.badgeClass}`}
        >
          <VerbIcon className="w-4 h-4" />
          {t(verbDescriptor.labelKey)}
        </span>
        {payload.timestamp && (
          <span className="text-xs text-[var(--color-text-secondary)] font-mono">
            {fmtDate(String(payload.timestamp))}
          </span>
        )}
      </div>

      {/* Actor */}
      <DetailCard icon={UserIcon} title={t("drawer.structured.actor")}>
        <DetailRow label={t("drawer.structured.nationalId")}>
          <span className="font-mono text-sm text-[var(--color-text-primary)] bg-[var(--color-border-subtle)] px-2 py-0.5 rounded">
            {actor?.name || "—"}
          </span>
        </DetailRow>
        <DetailRow label={t("drawer.structured.email")}>
          <span className="font-mono text-sm text-[var(--color-text-primary)]">
            {actorEmail}
          </span>
        </DetailRow>
      </DetailCard>

      {/* Object */}
      <DetailCard icon={Activity} title={t("drawer.structured.object")}>
        <DetailRow label={t("drawer.structured.name")}>
          <span className="text-sm text-[var(--color-text-primary)]">
            {objectName}
          </span>
        </DetailRow>
        <DetailRow label={t("drawer.structured.activityId")}>
          <span className="font-mono text-xs text-[var(--color-text-primary)] break-all">
            {object?.id || "—"}
          </span>
        </DetailRow>
        {object?.definition?.type && (
          <DetailRow label={t("drawer.structured.activityType")}>
            <span className="font-mono text-xs text-[var(--color-text-secondary)] break-all">
              {object.definition.type}
            </span>
          </DetailRow>
        )}
      </DetailCard>

      {/* Context */}
      {context && (
        <DetailCard icon={Globe} title={t("drawer.structured.context")}>
          {context.platform && (
            <DetailRow label={t("drawer.structured.platform")}>
              <span className="font-mono text-xs text-[var(--color-text-primary)]">
                {context.platform}
              </span>
            </DetailRow>
          )}
          {context.language && (
            <DetailRow label={t("drawer.structured.language")}>
              <span className="font-mono text-xs text-[var(--color-text-primary)]">
                {context.language}
              </span>
            </DetailRow>
          )}
          {context.instructor && (
            <DetailRow label={t("drawer.structured.instructor")}>
              <div className="flex flex-col text-xs">
                <span className="text-[var(--color-text-primary)]">
                  {context.instructor.name || "—"}
                </span>
                {context.instructor.mbox && (
                  <span className="font-mono text-[var(--color-text-secondary)]">
                    {context.instructor.mbox.replace(/^mailto:/, "")}
                  </span>
                )}
              </div>
            </DetailRow>
          )}
        </DetailCard>
      )}
    </div>
  );
}

function DetailCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-page)]/60 border-b border-[var(--color-border)]">
        <Icon className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {title}
        </h4>
      </div>
      <div className="px-4 py-3 space-y-2.5">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <dt className="text-xs text-[var(--color-text-secondary)] sm:w-32 sm:flex-shrink-0">
        {label}
      </dt>
      <dd className="flex-1 min-w-0">{children}</dd>
    </div>
  );
}

function RawJsonView({
  payload,
  onCopy,
  t,
}: {
  payload: Record<string, any>;
  onCopy: (text: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const json = JSON.stringify(payload, null, 2);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          {t("drawer.payload")}
        </h4>
        <button
          type="button"
          onClick={() => onCopy(json)}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-page)] transition-colors"
        >
          <Copy className="w-3 h-3" />
          {t("copy")}
        </button>
      </div>
      <pre className="text-xs font-mono bg-[#0F172A] text-[#E2E8F0] p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-all border border-[var(--color-border)] max-h-[400px] overflow-y-auto">
        {json}
      </pre>
    </div>
  );
}

export default NelcIntegrationContent;
