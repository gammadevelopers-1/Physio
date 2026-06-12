"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import { Loader2, Users, ArrowRight, Star, Clock, AlertTriangle, X, UserCheck } from "lucide-react";

// Admin Supervisors tab — list every supervisor with team-aggregate
// performance metrics. Date-range picker lets admin toggle between
// 7d / 30d / custom; default is 30d. Row click → supervisor detail
// page at /dashboard/admin/support/supervisors/[id].

type Range = "7d" | "30d" | "custom";

export default function AdminSupervisorsTab() {
  const t = useTranslations("adminDashboard.supportPage.supervisors");
  const router = useRouter();
  const locale = useLocale();

  const [range, setRange] = useState<Range>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rows, setRows] = useState<Awaited<
    ReturnType<typeof supportApi.listSupervisorsWithStats>
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = rangeToParams(range, customFrom, customTo);
      const data = await supportApi.listSupervisorsWithStats(params);
      setRows(data || []);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [range, customFrom, customTo]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  function openSupervisor(id: string) {
    router.push(`/${locale}/dashboard/admin/support/supervisors/${id}`);
  }

  return (
    <div className="space-y-4">
      <OrphanAgentsBanner />
      {/* Range picker */}
      <div className="flex items-center gap-2 flex-wrap">
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
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 px-2 border border-[var(--color-input-border)] rounded text-xs"
            />
            <span className="text-xs text-[var(--color-text-secondary)]">
              →
            </span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 px-2 border border-[var(--color-input-border)] rounded text-xs"
            />
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {isLoading ? (
          <div className="text-center py-10">
            <Loader2 className="w-5 h-5 animate-spin inline text-[var(--color-primary)]" />
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="text-center py-10 text-[var(--color-text-secondary)]">
            {t("empty")}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {rows.map((row) => {
              const name =
                [row.firstName, row.lastName].filter(Boolean).join(" ") ||
                row.email ||
                "—";
              return (
                <button
                  key={row.userId}
                  onClick={() => openSupervisor(row.userId)}
                  className="w-full text-start p-4 hover:bg-[var(--color-border-subtle)] flex items-center gap-4"
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-semibold">
                    {(row.firstName || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {name}
                      </p>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {row.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <Stat
                        icon={Users}
                        label={t("teamSize", { count: row.teamSize })}
                      />
                      <Stat
                        icon={Clock}
                        label={t("activeTickets", { count: row.activeTickets })}
                      />
                      {row.csatScore != null && (
                        <Stat
                          icon={Star}
                          label={`${row.csatScore.toFixed(1)} CSAT`}
                          tone="success"
                        />
                      )}
                      {row.slaBreachCount > 0 && (
                        <Stat
                          icon={Clock}
                          label={t("slaBreaches", {
                            count: row.slaBreachCount,
                          })}
                          tone="danger"
                        />
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone?: "success" | "danger";
}) {
  const cls =
    tone === "success"
      ? "text-[#15803D]"
      : tone === "danger"
        ? "text-[#991B1B]"
        : "text-[var(--color-text-secondary)]";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
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

/**
 * Orphan-agent visibility banner.
 *
 * Surfaces any Support Agent that doesn't have a supervisor — a state
 * created agents wouldn't enter going forward (the no-orphan invariant
 * is now enforced server-side at create/promotion time), but that can
 * persist from earlier data. Lets admin bulk-assign them to a
 * supervisor in one click without leaving the page.
 */
function OrphanAgentsBanner() {
  const t = useTranslations("adminDashboard.supportPage.supervisors.orphans");
  const [orphans, setOrphans] = useState<
    Awaited<ReturnType<typeof supportApi.listOrphanAgents>>
  >([]);
  const [supervisors, setSupervisors] = useState<
    Awaited<ReturnType<typeof supportApi.listActiveSupervisors>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [targetSupervisorId, setTargetSupervisorId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        supportApi.listOrphanAgents().catch(() => []),
        supportApi.listActiveSupervisors().catch(() => []),
      ]);
      setOrphans(o || []);
      setSupervisors(s || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openModal() {
    setSelectedIds(new Set(orphans.map((o) => o.userId)));
    setTargetSupervisorId("");
    setShowModal(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!targetSupervisorId) {
      toast.error(t("pickSupervisor"));
      return;
    }
    if (selectedIds.size === 0) {
      toast.error(t("pickAgent"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await supportApi.bulkAssignOrphans({
        supervisorId: targetSupervisorId,
        agentIds: Array.from(selectedIds),
      });
      toast.success(t("assigned", { count: res.assigned }));
      setShowModal(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (orphans.length === 0) return null;

  return (
    <>
      <div className="flex items-start gap-3 p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl">
        <AlertTriangle className="w-5 h-5 text-[#B45309] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#92400E]">
            {t("title", { count: orphans.length })}
          </p>
          <p className="text-xs text-[#92400E] mt-0.5">{t("description")}</p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-medium rounded-lg"
        >
          <UserCheck className="w-3.5 h-3.5" />
          {t("assignButton")}
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !submitting && setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("modalTitle")}
              </h3>
              <button
                onClick={() => !submitting && setShowModal(false)}
                disabled={submitting}
                className="p-1 hover:bg-[var(--color-border-subtle)] rounded-md disabled:opacity-50"
              >
                <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("targetSupervisor")}
              </label>
              {supervisors.length === 0 ? (
                <div className="px-3 py-2 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg text-xs text-[#92400E]">
                  {t("noSupervisors")}
                </div>
              ) : (
                <select
                  value={targetSupervisorId}
                  onChange={(e) => setTargetSupervisorId(e.target.value)}
                  className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm"
                >
                  <option value="">{t("pickSupervisor")}</option>
                  {supervisors.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {[s.firstName, s.lastName].filter(Boolean).join(" ") ||
                        s.email}{" "}
                      · {t("teamCount", { count: s.teamSize })}
                    </option>
                  ))}
                </select>
              )}

              <p className="text-xs font-medium text-[var(--color-text-secondary)] mt-4 mb-2">
                {t("agentList", { count: orphans.length })}
              </p>
              <div className="space-y-1.5 border border-[var(--color-border)] rounded-lg p-2 max-h-[40vh] overflow-y-auto">
                {orphans.map((a) => {
                  const checked = selectedIds.has(a.userId);
                  const name =
                    [a.firstName, a.lastName].filter(Boolean).join(" ") ||
                    a.email;
                  return (
                    <label
                      key={a.userId}
                      className="flex items-center gap-3 p-2 hover:bg-[var(--color-border-subtle)] rounded-md cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(a.userId)}
                        className="w-4 h-4 text-[#002D87]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {name}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] truncate">
                          {a.email}
                        </p>
                      </div>
                      {!a.isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#FEE2E2] text-[#991B1B] rounded-full font-medium">
                          {t("suspended")}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-5 border-t border-[var(--color-border)] flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={submitting}
                className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !targetSupervisorId || selectedIds.size === 0}
                className="flex-1 h-10 bg-[#002D87] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("confirm", { count: selectedIds.size })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
