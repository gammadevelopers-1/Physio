"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { toast } from "sonner";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import PanelErrorState from "./PanelErrorState";
import Select from "@/components/admin-dashboard/Select";
import SaudiPhoneInput from "@/components/shared/SaudiPhoneInput";
import { normalizeSaudiMobile } from "@/lib/saudi-phone";
import {
  Users,
  Clock,
  Smile,
  Search,
  Plus,
  TrendingUp,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trophy,
  Mail,
  Phone,
  Calendar,
  Star,
  Trash2,
  History,
  Send,
  MailQuestion,
} from "lucide-react";

// ── Local helpers ───────────────────────────────────────────────────
function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

function getInitials(firstName: string | null, lastName: string | null, email: string) {
  const f = firstName?.[0] || "";
  const l = lastName?.[0] || "";
  if (f || l) return (f + l).toUpperCase();
  return email[0]?.toUpperCase() || "?";
}

// ── Types ───────────────────────────────────────────────────────────
type TeamMember = NonNullable<Awaited<ReturnType<typeof supportApi.getMyTeam>>>[number];
type AvailableAgent = NonNullable<Awaited<ReturnType<typeof supportApi.getAvailableAgents>>>[number];
type MyRequest = NonNullable<Awaited<ReturnType<typeof supportApi.getMyTeamRequests>>>[number];

const TeamContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const profile = useSupportProfile();

  // ── Data ─────────────────────────────────────────────────────────
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Filters ─────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "csat" | "frt" | "open">("name");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // ── Modals / panels ─────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────
  const fetchTeam = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [teamRes, reqRes] = await Promise.all([
        supportApi.getMyTeam(),
        supportApi.getMyTeamRequests().catch(() => []),
      ]);
      setTeam(teamRes || []);
      setRequests(reqRes || []);
    } catch (err: any) {
      setFetchError(err?.message || t("teamPage.fetchError"));
      setTeam([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // ── Derived ─────────────────────────────────────────────────────
  // Defensive: supervisor self should never appear in the team result
  // since they own the team. The backend already excludes them, but
  // keep the client-side guard so a future bug can't surprise the user.
  const teamMembers = useMemo(
    () => team.filter((m) => m.userId !== user?.id),
    [team, user?.id],
  );

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = teamMembers.filter((m) => {
      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "inactive" && m.isActive) return false;
      if (!q) return true;
      const name = [m.firstName, m.lastName].filter(Boolean).join(" ").toLowerCase();
      return (
        name.includes(q) ||
        (m.email || "").toLowerCase().includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "csat": {
          const av = a.performance?.csatAvgScore ?? -1;
          const bv = b.performance?.csatAvgScore ?? -1;
          return bv - av;
        }
        case "frt": {
          // Lower is better — null last.
          const av = a.performance?.avgFrtMinutes ?? Infinity;
          const bv = b.performance?.avgFrtMinutes ?? Infinity;
          return av - bv;
        }
        case "open": {
          const av = a.performance?.openTickets ?? 0;
          const bv = b.performance?.openTickets ?? 0;
          return bv - av;
        }
        case "name":
        default: {
          const an = [a.firstName, a.lastName].filter(Boolean).join(" ");
          const bn = [b.firstName, b.lastName].filter(Boolean).join(" ");
          return an.localeCompare(bn);
        }
      }
    });
    return list;
  }, [teamMembers, searchQuery, statusFilter, sortBy]);

  // ── KPIs ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const sumOpen = teamMembers.reduce(
      (acc, m) => acc + (m.performance?.openTickets ?? 0),
      0,
    );
    const sumResolved = teamMembers.reduce(
      (acc, m) => acc + (m.performance?.resolvedTickets ?? 0),
      0,
    );
    const frtSamples = teamMembers
      .map((m) => m.performance?.avgFrtMinutes)
      .filter((v): v is number => typeof v === "number");
    const teamFrt =
      frtSamples.length > 0
        ? frtSamples.reduce((a, b) => a + b, 0) / frtSamples.length
        : null;
    const csatSamples = teamMembers
      .map((m) => m.performance?.csatAvgScore)
      .filter((v): v is number => typeof v === "number");
    const teamCsat =
      csatSamples.length > 0
        ? csatSamples.reduce((a, b) => a + b, 0) / csatSamples.length
        : null;
    const breaches = teamMembers.reduce(
      (acc, m) =>
        acc +
        (m.performance?.frtBreaches ?? 0) +
        (m.performance?.ttrBreaches ?? 0),
      0,
    );
    return {
      totalAgents: teamMembers.length,
      openTickets: sumOpen,
      resolvedTickets: sumResolved,
      teamFrt,
      teamCsat,
      breaches,
    };
  }, [teamMembers]);

  // ── Top performers (used by Performance Overview) ─────────────
  const topPerformers = useMemo(() => {
    if (teamMembers.length === 0) return { fastestFrt: null, highestCsat: null, mostResolved: null };

    const candidates = teamMembers.filter((m) => m.performance);

    const fastestFrt = candidates
      .filter((m) => typeof m.performance?.avgFrtMinutes === "number")
      .sort((a, b) => (a.performance!.avgFrtMinutes! - b.performance!.avgFrtMinutes!))[0] || null;

    const highestCsat = candidates
      .filter((m) => typeof m.performance?.csatAvgScore === "number")
      .sort((a, b) => (b.performance!.csatAvgScore! - a.performance!.csatAvgScore!))[0] || null;

    const mostResolved = candidates
      .filter((m) => (m.performance?.resolvedTickets ?? 0) > 0)
      .sort((a, b) => (b.performance!.resolvedTickets - a.performance!.resolvedTickets))[0] || null;

    return { fastestFrt, highestCsat, mostResolved };
  }, [teamMembers]);

  const pendingRequestsCount = requests.filter((r) => r.status === "pending").length;

  // ── Render ─────────────────────────────────────────────────────
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
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("teamPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("teamPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestsOpen(true)}
                    className="relative flex items-center gap-1.5 h-10 px-3 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
                  >
                    <History className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {t("teamPage.myRequests")}
                    </span>
                    {pendingRequestsCount > 0 && (
                      <span className="min-w-[20px] h-5 inline-flex items-center justify-center rounded-full px-1.5 text-[11px] font-semibold bg-[#F97316] text-white">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="flex items-center gap-2 h-10 px-4 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[#001d5e]"
                  >
                    <Plus className="w-4 h-4" />
                    {t("teamPage.addAgent")}
                  </button>
                </div>
              </div>

              {/* KPI cards — meaningful, real data */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                <KpiCard
                  label={t("teamPage.kpis.totalAgents")}
                  value={String(kpis.totalAgents)}
                  icon={Users}
                  iconBg="bg-[var(--color-border-subtle)]"
                  iconColor="text-[var(--color-primary)]"
                />
                <KpiCard
                  label={t("teamPage.kpis.openTickets")}
                  value={String(kpis.openTickets)}
                  icon={MailQuestion}
                  iconBg="bg-[#EFF6FF]"
                  iconColor="text-[#3B82F6]"
                />
                <KpiCard
                  label={t("teamPage.kpis.resolvedTotal")}
                  value={String(kpis.resolvedTickets)}
                  icon={CheckCircle2}
                  iconBg="bg-[#DCFCE7]"
                  iconColor="text-[#22C55E]"
                />
                <KpiCard
                  label={t("teamPage.kpis.teamFrt")}
                  value={formatMinutes(kpis.teamFrt)}
                  icon={Clock}
                  iconBg="bg-[#FFEDD5]"
                  iconColor="text-[#EA580C]"
                />
                <KpiCard
                  label={t("teamPage.kpis.teamCsat")}
                  value={kpis.teamCsat == null ? "—" : `${kpis.teamCsat.toFixed(1)}/5`}
                  icon={Smile}
                  iconBg="bg-[#EDE9FE]"
                  iconColor="text-[#8B5CF6]"
                />
              </div>

              {/* Performance Overview — positioned ABOVE the team list */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {t("teamPage.performance")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <PerformerCard
                    label={t("teamPage.performanceCards.bestResponseTime")}
                    accent="orange"
                    icon={Clock}
                    member={topPerformers.fastestFrt}
                    metric={
                      topPerformers.fastestFrt
                        ? formatMinutes(topPerformers.fastestFrt.performance?.avgFrtMinutes ?? null)
                        : null
                    }
                    emptyHint={t("teamPage.noData")}
                  />
                  <PerformerCard
                    label={t("teamPage.performanceCards.highestCSAT")}
                    accent="violet"
                    icon={Smile}
                    member={topPerformers.highestCsat}
                    metric={
                      topPerformers.highestCsat
                        ? `${topPerformers.highestCsat.performance?.csatAvgScore?.toFixed(1)}/5`
                        : null
                    }
                    emptyHint={t("teamPage.noData")}
                  />
                  <PerformerCard
                    label={t("teamPage.performanceCards.mostResolved")}
                    accent="green"
                    icon={Trophy}
                    member={topPerformers.mostResolved}
                    metric={
                      topPerformers.mostResolved
                        ? String(topPerformers.mostResolved.performance?.resolvedTickets ?? 0)
                        : null
                    }
                    emptyHint={t("teamPage.noData")}
                  />
                </div>
              </div>

              {/* Filters card */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={t("teamPage.searchPlaceholder")}
                      className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                    className="w-full md:w-40"
                    options={[
                      { value: "all", label: t("teamPage.filters.allStatus") },
                      { value: "active", label: t("teamPage.filters.active") },
                      { value: "inactive", label: t("teamPage.filters.inactive") },
                    ]}
                  />
                  <Select
                    value={sortBy}
                    onChange={(v) => setSortBy(v as typeof sortBy)}
                    className="w-full md:w-52"
                    options={[
                      { value: "name", label: t("teamPage.filters.sortName") },
                      { value: "csat", label: t("teamPage.filters.sortCsat") },
                      { value: "frt", label: t("teamPage.filters.sortFrt") },
                      { value: "open", label: t("teamPage.filters.sortOpen") },
                    ]}
                  />
                </div>
              </div>

              {/* Team Members Grid */}
              {fetchError ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] mb-6">
                  <PanelErrorState
                    onRetry={fetchTeam}
                    isRetrying={isLoading}
                    message={fetchError}
                  />
                </div>
              ) : isLoading ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <Users className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-primary)] font-medium mb-1">
                    {teamMembers.length === 0
                      ? t("teamPage.emptyTitle")
                      : t("teamPage.noMatches")}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                    {teamMembers.length === 0
                      ? t("teamPage.emptyHint")
                      : t("teamPage.noMatchesHint")}
                  </p>
                  {teamMembers.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setAddOpen(true)}
                      className="inline-flex items-center gap-2 h-10 px-4 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[#001d5e]"
                    >
                      <Plus className="w-4 h-4" />
                      {t("teamPage.addAgent")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredMembers.map((m) => (
                    <TeamMemberCard
                      key={m.userId}
                      member={m}
                      onClick={() => setDetailAgentId(m.userId)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Agent Modal */}
      {addOpen && (
        <AddAgentModal
          onClose={() => setAddOpen(false)}
          onSubmitted={() => {
            setAddOpen(false);
            fetchTeam();
          }}
        />
      )}

      {/* My Requests Side Sheet */}
      {requestsOpen && (
        <MyRequestsSheet
          requests={requests}
          onClose={() => setRequestsOpen(false)}
        />
      )}

      {/* Agent Detail Side Sheet */}
      {detailAgentId && (
        <AgentDetailSheet
          agentId={detailAgentId}
          onClose={() => setDetailAgentId(null)}
          onRemoved={() => {
            setDetailAgentId(null);
            fetchTeam();
          }}
        />
      )}
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-text-secondary)] font-medium truncate">
          {label}
        </p>
        <p className="text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
      </div>
    </div>
  );
}

function PerformerCard({
  label,
  accent,
  icon: Icon,
  member,
  metric,
  emptyHint,
}: {
  label: string;
  accent: "orange" | "violet" | "green";
  icon: React.ElementType;
  member: TeamMember | null;
  metric: string | null;
  emptyHint: string;
}) {
  const accentMap = {
    orange: "bg-[#FFEDD5] text-[#EA580C]",
    violet: "bg-[#EDE9FE] text-[#8B5CF6]",
    green: "bg-[#DCFCE7] text-[#16A34A]",
  };
  return (
    <div className="bg-[var(--color-surface-page)] rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] font-medium">{label}</p>
      </div>
      {member && metric ? (
        <>
          <p className="text-xl font-bold text-[var(--color-text-primary)]">{metric}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">
            {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.email}
          </p>
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-[var(--color-text-secondary)]">—</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{emptyHint}</p>
        </>
      )}
    </div>
  );
}

function TeamMemberCard({
  member,
  onClick,
}: {
  member: TeamMember;
  onClick: () => void;
}) {
  const t = useTranslations("supportDashboard");
  const fullName =
    [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
  const initials = getInitials(member.firstName, member.lastName, member.email);
  const csat = member.performance?.csatAvgScore;
  const open = member.performance?.openTickets ?? 0;
  const frt = formatMinutes(member.performance?.avgFrtMinutes ?? null);
  const breaches =
    (member.performance?.frtBreaches ?? 0) + (member.performance?.ttrBreaches ?? 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 text-start hover:border-[var(--color-primary)] hover:shadow-sm transition-all w-full"
    >
      {/* Header — avatar + name + status */}
      <div className="flex items-start gap-3 mb-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center">
            {member.avatar ? (
              <Image
                src={member.avatar}
                alt={fullName}
                width={48}
                height={48}
                className="object-cover w-full h-full"
                unoptimized
              />
            ) : (
              <span className="text-sm font-bold text-[var(--color-primary)]">
                {initials}
              </span>
            )}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface-card)] ${
              member.isActive ? "bg-[#22C55E]" : "bg-[#9CA3AF]"
            }`}
            aria-hidden
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {fullName}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {member.email}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                member.isActive
                  ? "bg-[#DCFCE7] text-[#15803D]"
                  : "bg-[#F3F4F6] text-[#4B5563]"
              }`}
            >
              {member.isActive ? t("teamPage.statusActive") : t("teamPage.statusInactive")}
            </span>
            {breaches > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#FEE2E2] text-[#DC2626]">
                <AlertTriangle className="w-2.5 h-2.5" />
                {breaches} {t("teamPage.breaches")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics — grid */}
      <div className="grid grid-cols-3 gap-2 py-3 border-t border-[var(--color-border)]">
        <Metric label={t("teamPage.agentCard.openTickets")} value={String(open)} />
        <Metric label={t("teamPage.agentCard.avgResponse")} value={frt} />
        <Metric
          label={t("teamPage.agentCard.csat")}
          value={csat == null ? "—" : `${csat.toFixed(1)}/5`}
        />
      </div>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{label}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Add Agent modal — request-based flow (existing agent or new user)
// ──────────────────────────────────────────────────────────────────

function AddAgentModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const t = useTranslations("supportDashboard");
  const tPhone = useTranslations("commonSettings.phoneField");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [available, setAvailable] = useState<AvailableAgent[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [newForm, setNewForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    setLoadingAvail(true);
    supportApi
      .getAvailableAgents()
      .then((data) => setAvailable(data || []))
      .catch(() => setAvailable([]))
      .finally(() => setLoadingAvail(false));
  }, []);

  const filteredAvailable = useMemo(() => {
    const q = search.toLowerCase();
    return available.filter((a) => {
      if (!q) return true;
      const name = [a.firstName, a.lastName].filter(Boolean).join(" ").toLowerCase();
      return name.includes(q) || (a.email || "").toLowerCase().includes(q);
    });
  }, [available, search]);

  async function submit() {
    setSubmitting(true);
    try {
      if (mode === "existing") {
        if (!selectedUserId) {
          toast.error(t("teamPage.modal.selectAgentError"));
          setSubmitting(false);
          return;
        }
        await supportApi.createTeamRequest({
          kind: "add_existing",
          candidateUserId: selectedUserId,
          reason: reason.trim() || undefined,
        });
      } else {
        if (!newForm.firstName || !newForm.lastName || !newForm.email) {
          toast.error(t("teamPage.modal.fillAll"));
          setSubmitting(false);
          return;
        }
        let candidatePhone: string | undefined = undefined;
        if (newForm.phone) {
          const normalized = normalizeSaudiMobile(newForm.phone);
          if (!normalized) {
            toast.error(tPhone("invalid"));
            setSubmitting(false);
            return;
          }
          candidatePhone = normalized;
        }
        await supportApi.createTeamRequest({
          kind: "add_new",
          candidateEmail: newForm.email.trim(),
          candidateFirstName: newForm.firstName.trim(),
          candidateLastName: newForm.lastName.trim(),
          candidatePhone,
          reason: reason.trim() || undefined,
        });
      }
      toast.success(t("teamPage.modal.requestSent"));
      onSubmitted();
    } catch (err: any) {
      toast.error(err?.message || t("teamPage.modal.requestFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-lg p-6 pointer-events-auto max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {t("teamPage.modal.title")}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t("teamPage.modal.helpText")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"
              aria-label={t("teamPage.modal.cancel")}
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 bg-[var(--color-border-subtle)] rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                mode === "existing"
                  ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {t("teamPage.modal.tabExisting")}
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                mode === "new"
                  ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {t("teamPage.modal.tabNew")}
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("teamPage.modal.searchAvailable")}
                  className="w-full h-10 pl-9 pr-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
              <div className="max-h-[280px] overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border-subtle)]">
                {loadingAvail && (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                )}
                {!loadingAvail && filteredAvailable.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {available.length === 0
                        ? t("teamPage.modal.noAvailable")
                        : t("teamPage.modal.noMatches")}
                    </p>
                  </div>
                )}
                {!loadingAvail &&
                  filteredAvailable.map((a) => {
                    const name =
                      [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email;
                    const selected = selectedUserId === a.userId;
                    return (
                      <button
                        key={a.userId}
                        type="button"
                        onClick={() => setSelectedUserId(a.userId)}
                        className={`w-full flex items-center gap-3 p-3 text-start ${
                          selected
                            ? "bg-[var(--color-border-subtle)]"
                            : "hover:bg-[var(--color-border-subtle)]"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                          {a.avatar ? (
                            <Image
                              src={a.avatar}
                              alt={name}
                              width={36}
                              height={36}
                              className="object-cover w-full h-full"
                              unoptimized
                            />
                          ) : (
                            <span className="text-xs font-bold text-[var(--color-primary)]">
                              {getInitials(a.firstName, a.lastName, a.email)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {name}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)] truncate">
                            {a.email}
                          </p>
                        </div>
                        {selected && (
                          <CheckCircle2 className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t("teamPage.modal.firstName")}
                  value={newForm.firstName}
                  onChange={(v) => setNewForm((p) => ({ ...p, firstName: v }))}
                />
                <Field
                  label={t("teamPage.modal.lastName")}
                  value={newForm.lastName}
                  onChange={(v) => setNewForm((p) => ({ ...p, lastName: v }))}
                />
              </div>
              <Field
                type="email"
                label={t("teamPage.modal.email")}
                value={newForm.email}
                onChange={(v) => setNewForm((p) => ({ ...p, email: v }))}
              />
              <SaudiPhoneInput
                label={t("teamPage.modal.phone")}
                value={newForm.phone}
                onChange={(v) => setNewForm((p) => ({ ...p, phone: v }))}
              />
              <p className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] rounded-lg p-2.5">
                {t("teamPage.modal.adminWillSetPassword")}
              </p>
            </div>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {t("teamPage.modal.reasonLabel")}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("teamPage.modal.reasonPlaceholder")}
              className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
          </div>

          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
            >
              {t("teamPage.modal.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 h-10 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {t("teamPage.modal.sendRequest")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
        {label}{" "}
        {optional && (
          <span className="text-xs text-[var(--color-text-secondary)] font-normal">
            (optional)
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// My Requests side sheet
// ──────────────────────────────────────────────────────────────────

function MyRequestsSheet({
  requests,
  onClose,
}: {
  requests: MyRequest[];
  onClose: () => void;
}) {
  const t = useTranslations("supportDashboard");
  const statusStyles: Record<string, string> = {
    pending: "bg-[#FEF9C3] text-[#A16207]",
    approved: "bg-[#DCFCE7] text-[#15803D]",
    rejected: "bg-[#FEE2E2] text-[#DC2626]",
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--color-surface-card)] z-[70] shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("teamPage.myRequests")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"
            aria-label={t("teamPage.modal.cancel")}
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {requests.length === 0 && (
            <div className="text-center py-10">
              <History className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("teamPage.requestsEmpty")}
              </p>
            </div>
          )}
          {requests.map((r) => {
            const name =
              [r.candidateFirstName, r.candidateLastName].filter(Boolean).join(" ") ||
              r.candidateEmail ||
              t("teamPage.requestUnknownCandidate");
            return (
              <div
                key={r.id}
                className="border border-[var(--color-border)] rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {name}
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusStyles[r.status] || ""}`}
                  >
                    {t(`teamPage.requestStatus.${r.status}`)}
                  </span>
                </div>
                {r.candidateEmail && (
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {r.candidateEmail}
                  </p>
                )}
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  {t("teamPage.requestKindLabel")}:{" "}
                  {t(`teamPage.requestKind.${r.kind}`)}
                </p>
                {r.reason && (
                  <p className="text-xs text-[var(--color-text-primary)] mt-2 bg-[var(--color-border-subtle)] rounded p-2">
                    {r.reason}
                  </p>
                )}
                {r.decisionReason && (
                  <div className="mt-2">
                    <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                      {t("teamPage.adminDecision")}:
                    </p>
                    <p className="text-xs text-[var(--color-text-primary)] mt-0.5">
                      {r.decisionReason}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Agent Detail side sheet — stats + tickets + CSAT
// ──────────────────────────────────────────────────────────────────

function AgentDetailSheet({
  agentId,
  onClose,
  onRemoved,
}: {
  agentId: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const t = useTranslations("supportDashboard");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof supportApi.getTeamMemberDetail>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    supportApi
      .getTeamMemberDetail(agentId)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setIsLoading(false));
  }, [agentId]);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await supportApi.removeTeamMember(agentId);
      toast.success(t("teamPage.detail.removeSuccess"));
      onRemoved();
    } catch (err: any) {
      toast.error(err?.message || t("teamPage.detail.removeFailed"));
    } finally {
      setIsRemoving(false);
    }
  }

  const name = detail?.agent
    ? [detail.agent.firstName, detail.agent.lastName].filter(Boolean).join(" ") ||
      detail.agent.email
    : "";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--color-surface-card)] z-[70] shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("teamPage.detail.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"
            aria-label={t("teamPage.modal.cancel")}
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {isLoading || !detail ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Profile block */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                {detail.agent.avatar ? (
                  <Image
                    src={detail.agent.avatar}
                    alt={name}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-lg font-bold text-[var(--color-primary)]">
                    {getInitials(detail.agent.firstName, detail.agent.lastName, detail.agent.email)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                  {name}
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{detail.agent.email}</span>
                </p>
                {detail.agent.phone && (
                  <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />
                    {detail.agent.phone}
                  </p>
                )}
                <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3" />
                  {t("teamPage.detail.joinedTeam")}:{" "}
                  {new Date(detail.agent.assignedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Performance stats */}
            <div>
              <h5 className="text-xs uppercase font-semibold text-[var(--color-text-secondary)] mb-2">
                {t("teamPage.detail.performance")}
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label={t("teamPage.detail.totalTickets")}
                  value={String(detail.performance?.totalTickets ?? 0)}
                />
                <Stat
                  label={t("teamPage.detail.resolved")}
                  value={String(detail.performance?.resolvedTickets ?? 0)}
                />
                <Stat
                  label={t("teamPage.detail.avgFrt")}
                  value={formatMinutes(detail.performance?.avgFrtMinutes ?? null)}
                />
                <Stat
                  label={t("teamPage.detail.csat")}
                  value={
                    detail.performance?.csatAvgScore == null
                      ? "—"
                      : `${detail.performance.csatAvgScore.toFixed(1)}/5 (${detail.performance.csatResponses})`
                  }
                />
                <Stat
                  label={t("teamPage.detail.frtBreaches")}
                  value={String(detail.performance?.frtBreaches ?? 0)}
                  bad={Boolean(detail.performance?.frtBreaches && detail.performance.frtBreaches > 0)}
                />
                <Stat
                  label={t("teamPage.detail.ttrBreaches")}
                  value={String(detail.performance?.ttrBreaches ?? 0)}
                  bad={Boolean(detail.performance?.ttrBreaches && detail.performance.ttrBreaches > 0)}
                />
              </div>
            </div>

            {/* Open tickets */}
            <div>
              <h5 className="text-xs uppercase font-semibold text-[var(--color-text-secondary)] mb-2">
                {t("teamPage.detail.openTickets")} ({detail.openTickets.length})
              </h5>
              {detail.openTickets.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] italic">
                  {t("teamPage.detail.noOpenTickets")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {detail.openTickets.map((tk) => (
                    <div
                      key={tk.id}
                      className="border border-[var(--color-border)] rounded-lg p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-mono text-[var(--color-primary)]">
                          {tk.referenceNumber || `#${tk.id.substring(0, 8)}`}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                          {new Date(tk.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[var(--color-text-primary)] truncate">{tk.subject}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent CSAT */}
            {detail.recentCsat.length > 0 && (
              <div>
                <h5 className="text-xs uppercase font-semibold text-[var(--color-text-secondary)] mb-2">
                  {t("teamPage.detail.recentCsat")}
                </h5>
                <div className="space-y-2">
                  {detail.recentCsat.map((c, idx) => (
                    <div
                      key={idx}
                      className="border border-[var(--color-border)] rounded-lg p-2.5"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3 h-3 ${
                              c.score != null && n <= c.score
                                ? "text-[#F59E0B] fill-[#F59E0B]"
                                : "text-[var(--color-border)]"
                            }`}
                          />
                        ))}
                      </div>
                      {c.comment && (
                        <p className="text-xs text-[var(--color-text-primary)]">{c.comment}</p>
                      )}
                      {c.submittedAt && (
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                          {new Date(c.submittedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger zone */}
            <div className="border-t border-[var(--color-border)] pt-4">
              {!confirmRemove ? (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="w-full flex items-center justify-center gap-2 h-10 px-4 border border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626] rounded-lg text-sm font-medium hover:bg-[#FEE2E2]"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("teamPage.detail.removeButton")}
                </button>
              ) : (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3">
                  <p className="text-sm font-medium text-[#991B1B] mb-1">
                    {t("teamPage.detail.confirmRemoveTitle")}
                  </p>
                  <p className="text-xs text-[#7F1D1D] mb-3">
                    {t("teamPage.detail.confirmRemoveBody")}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="flex-1 h-9 border border-[var(--color-border)] bg-[var(--color-surface-card)] text-sm rounded-lg"
                    >
                      {t("teamPage.modal.cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={isRemoving}
                      className="flex-1 h-9 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {isRemoving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {t("teamPage.detail.confirmRemoveButton")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="bg-[var(--color-surface-page)] rounded-lg p-3 border border-[var(--color-border)]">
      <p className="text-[10px] text-[var(--color-text-secondary)] uppercase font-medium">
        {label}
      </p>
      <p
        className={`text-base font-bold mt-0.5 ${
          bad ? "text-[#DC2626]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default TeamContent;
