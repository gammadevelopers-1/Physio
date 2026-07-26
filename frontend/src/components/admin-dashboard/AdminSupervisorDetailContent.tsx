"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { supportApi } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { AdminSidebar, AdminNavbar } from "@/components/admin-dashboard";
import AdminMobileSidebar from "./AdminMobileSidebar";
import DatePicker from "@/components/ui/DatePicker";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  Phone,
  Users,
  Star,
  Clock,
  AlertTriangle,
  Inbox,
  X,
  Calendar,
} from "lucide-react";

type Range = "7d" | "30d" | "custom";

// Admin Supervisor Detail page.
//
// Three sections:
//   1. Header — supervisor profile (name, email, phone, last login)
//   2. Aggregates strip — team-wide perf for the chosen range
//   3. Team members list — each agent with their own perf row
//   4. Supervisor's own active tickets — supervisors can hold tickets
//      directly even though it's uncommon
export default function AdminSupervisorDetailContent() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("adminDashboard.supportPage.supervisorDetail");
  const locale = useLocale();
  const admin = useAdminProfile();
  const supervisorId = params?.id as string;

  const [range, setRange] = useState<Range>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<Awaited<
    ReturnType<typeof supportApi.getSupervisorDetail>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!supervisorId) return;
    setIsLoading(true);
    try {
      const params = rangeToParams(range, customFrom, customTo);
      const res = await supportApi.getSupervisorDetail(supervisorId, params);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [supervisorId, range, customFrom, customTo]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 text-center text-[var(--color-text-secondary)]">
        {t("notFound")}
      </div>
    );
  }

  const supervisorName =
    [data.supervisor.firstName, data.supervisor.lastName]
      .filter(Boolean)
      .join(" ") ||
    data.supervisor.email ||
    "—";

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

            <div className="flex-1 min-w-0">
              <button
                onClick={() =>
                  router.push(
                    `/${locale}/dashboard/admin/support?tab=supervisors`,
                  )
                }
                className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("backToList")}
              </button>

              {/* Header card */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-base font-semibold">
                    {(data.supervisor.firstName || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
                      {supervisorName}
                    </h1>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-secondary)] flex-wrap">
                      {data.supervisor.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {data.supervisor.email}
                        </span>
                      )}
                      {data.supervisor.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {data.supervisor.phone}
                        </span>
                      )}
                      {data.supervisor.lastLoginAt && (
                        <span>
                          {t("lastLogin")}:{" "}
                          {new Date(
                            data.supervisor.lastLoginAt,
                          ).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Range picker */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-[var(--color-text-secondary)] me-1">
                  {t("range")}
                </span>
                {(["7d", "30d", "custom"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 text-xs rounded-lg border ${
                      range === r
                        ? "border-[var(--color-primary)] bg-[#EFF6FF] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                  >
                    {t(`ranges.${r}`)}
                  </button>
                ))}
                {range === "custom" && (
                  <div className="flex items-center gap-2">
                    <DatePicker value={customFrom} onChange={setCustomFrom} />
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      →
                    </span>
                    <DatePicker value={customTo} onChange={setCustomTo} min={customFrom || undefined} />
                  </div>
                )}
              </div>

              {/* Aggregates strip */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <AggCard
                  label={t("teamSize")}
                  value={data.aggregates.teamSize}
                  icon={Users}
                />
                <AggCard
                  label={t("ticketsHandled")}
                  value={data.aggregates.ticketsHandled}
                  icon={Inbox}
                />
                <AggCard
                  label={t("avgFrt")}
                  value={
                    data.aggregates.avgFrtMinutes !== null
                      ? `${data.aggregates.avgFrtMinutes}m`
                      : "—"
                  }
                  icon={Clock}
                />
                <AggCard
                  label={t("avgTtr")}
                  value={
                    data.aggregates.avgTtrMinutes !== null
                      ? `${Math.round(data.aggregates.avgTtrMinutes / 60)}h`
                      : "—"
                  }
                  icon={Clock}
                />
                <AggCard
                  label={t("csat")}
                  value={
                    data.aggregates.csatScore !== null
                      ? `${data.aggregates.csatScore.toFixed(1)}/5`
                      : "—"
                  }
                  icon={Star}
                  tone={
                    data.aggregates.csatScore !== null &&
                    data.aggregates.csatScore >= 4
                      ? "success"
                      : "neutral"
                  }
                />
                <AggCard
                  label={t("slaBreaches")}
                  value={data.aggregates.slaBreachCount}
                  icon={AlertTriangle}
                  tone={
                    data.aggregates.slaBreachCount > 0 ? "danger" : "neutral"
                  }
                />
              </div>

              {/* Team members */}
              <Section title={t("teamMembers", { count: data.team.length })}>
                {data.team.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
                    {t("noTeamMembers")}
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {data.team.map((m) => {
                      const memberName =
                        [m.firstName, m.lastName].filter(Boolean).join(" ") ||
                        m.email ||
                        "—";
                      const perf = m.performance;
                      return (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() => setDetailAgentId(m.userId)}
                          className="w-full py-3 flex items-center gap-3 hover:bg-[var(--color-border-subtle)] -mx-2 px-2 rounded text-start"
                        >
                          <div className="w-8 h-8 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
                            {(m.firstName || "?")[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {memberName}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
                              {m.email}
                            </p>
                          </div>
                          {perf && (
                            <div className="hidden md:flex items-center gap-3 text-[10px] text-[var(--color-text-secondary)] flex-shrink-0">
                              <span>
                                {t("handled", {
                                  count: perf.ticketsHandled || 0,
                                })}
                              </span>
                              {perf.avgFrtMinutes !== null && (
                                <span>FRT {perf.avgFrtMinutes}m</span>
                              )}
                              {perf.avgTtrMinutes != null && (
                                <span>TTR {Math.round(perf.avgTtrMinutes / 60)}h</span>
                              )}
                              {perf.csatScore !== null && (
                                <span>CSAT {perf.csatScore.toFixed(1)}</span>
                              )}
                              {perf.slaBreachCount > 0 && (
                                <span className="text-[#991B1B]">
                                  {t("breaches", {
                                    count: perf.slaBreachCount,
                                  })}
                                </span>
                              )}
                            </div>
                          )}
                          <ArrowRight className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Supervisor's own tickets */}
              <Section
                title={t("supervisorTickets", {
                  count: data.supervisorTickets.length,
                })}
              >
                {data.supervisorTickets.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
                    {t("noSupervisorTickets")}
                  </p>
                ) : (
                  <div className="divide-y divide-[var(--color-border)]">
                    {data.supervisorTickets.map((tk) => (
                      <button
                        key={tk.id}
                        onClick={() =>
                          router.push(
                            `/${locale}/dashboard/admin/support/tickets/${tk.id}`,
                          )
                        }
                        className="w-full py-3 flex items-center gap-3 hover:bg-[var(--color-border-subtle)] -mx-2 px-2 rounded text-start"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--color-primary)]">
                            {tk.referenceNumber || tk.id.slice(0, 8)}
                          </p>
                          <p className="text-sm text-[var(--color-text-primary)] truncate">
                            {tk.subject}
                          </p>
                        </div>
                        {(tk.slaBreachedFrt || tk.slaBreachedTtr) && (
                          <span className="text-[10px] text-[#991B1B] bg-[#FEE2E2] px-2 py-0.5 rounded">
                            {t("breached")}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>
        </div>
      </div>

      {detailAgentId && (
        <AgentDetailModal
          agentId={detailAgentId}
          onClose={() => setDetailAgentId(null)}
        />
      )}
    </>
  );
}

/**
 * Read-only per-agent detail modal for admin. Reuses the supervisor's
 * existing `getTeamMemberDetail` endpoint (which already permits admin
 * access). Mirrors the supervisor `AgentDetailSheet` but drops the
 * "Remove from team" action — admin uses the team-reassignment flow
 * on the Users page for that, not this inspector.
 */
function AgentDetailModal({
  agentId,
  onClose,
}: {
  agentId: string;
  onClose: () => void;
}) {
  const t = useTranslations("adminDashboard.supportPage.supervisorDetail");
  const tSup = useTranslations("supportDashboard");
  const locale = useLocale();
  const router = useRouter();
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof supportApi.getTeamMemberDetail>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    supportApi
      .getTeamMemberDetail(agentId)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setIsLoading(false));
  }, [agentId]);

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
            {tSup("teamPage.detail.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"
            aria-label="Close"
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
              <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center text-lg font-bold text-[var(--color-primary)] flex-shrink-0">
                {(detail.agent.firstName || detail.agent.email[0] || "?")
                  .charAt(0)
                  .toUpperCase()}
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
                  {tSup("teamPage.detail.joinedTeam")}:{" "}
                  {new Date(detail.agent.assignedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Performance */}
            <div>
              <h5 className="text-xs uppercase font-semibold text-[var(--color-text-secondary)] mb-2">
                {tSup("teamPage.detail.performance")}
              </h5>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label={tSup("teamPage.detail.totalTickets")}
                  value={String(detail.performance?.totalTickets ?? 0)}
                />
                <Stat
                  label={tSup("teamPage.detail.resolved")}
                  value={String(detail.performance?.resolvedTickets ?? 0)}
                />
                <Stat
                  label={tSup("teamPage.detail.avgFrt")}
                  value={
                    detail.performance?.avgFrtMinutes != null
                      ? `${detail.performance.avgFrtMinutes}m`
                      : "—"
                  }
                />
                <Stat
                  label={t("avgTtr")}
                  value={
                    detail.performance?.avgTtrMinutes != null
                      ? `${Math.round(detail.performance.avgTtrMinutes / 60)}h`
                      : "—"
                  }
                />
                <Stat
                  label={tSup("teamPage.detail.csat")}
                  value={
                    detail.performance?.csatAvgScore != null
                      ? `${detail.performance.csatAvgScore.toFixed(1)}/5`
                      : "—"
                  }
                />
                <Stat
                  label={tSup("teamPage.detail.frtBreaches")}
                  value={String(detail.performance?.frtBreaches ?? 0)}
                />
                <Stat
                  label={tSup("teamPage.detail.ttrBreaches")}
                  value={String(detail.performance?.ttrBreaches ?? 0)}
                />
              </div>
            </div>

            {/* Open tickets */}
            <div>
              <h5 className="text-xs uppercase font-semibold text-[var(--color-text-secondary)] mb-2">
                {tSup("teamPage.detail.openTickets")} ({detail.openTickets.length})
              </h5>
              {detail.openTickets.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
                  {tSup("teamPage.detail.noOpenTickets")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {detail.openTickets.map((tk) => (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/${locale}/dashboard/admin/support/tickets/${tk.id}`,
                        )
                      }
                      className="w-full text-start px-3 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--color-primary)]">
                          {tk.referenceNumber || tk.id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] uppercase text-[var(--color-text-secondary)]">
                          {tk.status}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-primary)] truncate mt-0.5">
                        {tk.subject}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent CSAT */}
            {detail.recentCsat.length > 0 && (
              <div>
                <h5 className="text-xs uppercase font-semibold text-[var(--color-text-secondary)] mb-2">
                  {tSup("teamPage.detail.recentCsat")}
                </h5>
                <div className="space-y-2">
                  {detail.recentCsat.map((c, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 border border-[var(--color-border)] rounded-lg"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star
                            key={j}
                            className={`w-3 h-3 ${
                              c.score != null && j < c.score
                                ? "fill-[#FBBF24] text-[#FBBF24]"
                                : "text-[var(--color-border)]"
                            }`}
                          />
                        ))}
                      </div>
                      {c.comment && (
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {c.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border)]">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">
        {label}
      </p>
      <p className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
        {value}
      </p>
    </div>
  );
}

function AggCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "success" | "danger";
}) {
  const toneCls =
    tone === "success"
      ? "text-[#15803D]"
      : tone === "danger"
        ? "text-[#991B1B]"
        : "text-[var(--color-text-secondary)]";
  return (
    <div className="p-3 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${toneCls}`} />
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </span>
      </div>
      <p className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-4">
      <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function rangeToParams(
  range: Range,
  customFrom: string,
  customTo: string,
): { dateFrom?: string; dateTo?: string } {
  if (range === "custom") {
    return {
      dateFrom: customFrom || undefined,
      dateTo: customTo || undefined,
    };
  }
  const days = range === "7d" ? 7 : 30;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { dateFrom: from.toISOString() };
}
