"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  FlaskConical,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Timer,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import {
  backupsAdminApi,
  type BackupRecord,
  type RestoreCloneEntry,
  type RestoreClonesResponse,
} from "@/lib/api";

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_MS = 6_000;

function formatTs(value: string | null, locale: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

/** Returns ms until expiry (negative if past). */
function msUntil(iso: string): number {
  return new Date(iso).getTime() - Date.now();
}

function formatRemaining(iso: string, t: ReturnType<typeof useTranslations>): {
  label: string;
  tone: "ok" | "warn" | "danger" | "expired";
} {
  const ms = msUntil(iso);
  if (ms <= 0) return { label: t("sandboxExpired"), tone: "expired" };
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  if (ms < 60 * 60 * 1000) return { label, tone: "danger" };
  if (ms < 6 * 60 * 60 * 1000) return { label, tone: "warn" };
  return { label, tone: "ok" };
}

function statusBadge(
  status: RestoreCloneEntry["status"],
  t: ReturnType<typeof useTranslations>,
) {
  switch (status) {
    case "creating":
    case "importing":
      return {
        cls: "bg-[#FEF3C7] text-[#92400E]",
        Icon: Loader2,
        label: status === "creating" ? t("sandboxCreating") : t("sandboxImporting"),
        spin: true,
      };
    case "ready":
      return {
        cls: "bg-[#DCFCE7] text-[#15803D]",
        Icon: CheckCircle2,
        label: t("sandboxReady"),
      };
    case "failed":
      return {
        cls: "bg-[#FEE2E2] text-[#DC2626]",
        Icon: XCircle,
        label: t("sandboxFailed"),
      };
    case "dropped":
      return {
        cls: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
        Icon: Trash2,
        label: t("sandboxDropped"),
      };
    case "expired":
      return {
        cls: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
        Icon: Clock,
        label: t("sandboxExpiredStatus"),
      };
    default:
      return {
        cls: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
        Icon: Clock,
        label: status,
      };
  }
}

interface Props {
  enabled: boolean;
  exportBackups: BackupRecord[];
  onAfterMutate?: () => void;
}

export default function RestoreSandboxSection({
  enabled,
  exportBackups,
  onAfterMutate,
}: Props) {
  const t = useTranslations("adminDashboard.settingsPage.backups");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RestoreClonesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [dropTarget, setDropTarget] = useState<RestoreCloneEntry | null>(null);
  const [, setTick] = useState(0);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const result = await backupsAdminApi
          .listRestoreClones(targetPage, PAGE_SIZE)
          .catch(
            () =>
              ({
                items: [],
                total: 0,
                page: targetPage,
                limit: PAGE_SIZE,
                totalPages: 1,
                caps: {
                  maxConcurrent: 3,
                  defaultLifetimeHours: 24,
                  maxLifetimeHours: 48,
                },
              }) as RestoreClonesResponse,
          );
        setData(result);
      } finally {
        setLoading(false);
      }
    },
    [page],
  );

  // Initial + page-change load
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page]);

  // Tick every second so the countdown moves
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh while any sandbox is mid-import (every 6s)
  useEffect(() => {
    if (!data) return;
    const importing = data.items.some(
      (i) => i.status === "creating" || i.status === "importing",
    );
    if (!importing) return;
    const id = setInterval(() => refresh(page), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [data, page, refresh]);

  useEffect(() => {
    if (!createOpen && !dropTarget) return;
    const f = setTimeout(() => closeBtnRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || submitting) return;
      if (createOpen) setCreateOpen(false);
      if (dropTarget) setDropTarget(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(f);
      document.removeEventListener("keydown", onKey);
    };
  }, [createOpen, dropTarget, submitting]);

  const eligibleBackups = useMemo(
    () =>
      exportBackups
        .filter((b) => b.mode === "export" && b.status === "completed")
        .slice(0, 50),
    [exportBackups],
  );

  const caps = data?.caps;
  const activeCount =
    data?.items.filter((i) =>
      ["creating", "importing", "ready"].includes(i.status),
    ).length ?? 0;
  const atCap = caps ? activeCount >= caps.maxConcurrent : false;

  const handleCreate = async () => {
    if (!selectedBackupId) return;
    setSubmitting(true);
    try {
      const res = await backupsAdminApi.createRestoreClone(selectedBackupId);
      toast.success(t("sandboxCreatingToast", { dbName: res.dbName }));
      setCreateOpen(false);
      setSelectedBackupId("");
      setPage(1);
      await refresh(1);
      onAfterMutate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sandboxCreateFailedToast"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtend = async (entry: RestoreCloneEntry) => {
    try {
      await backupsAdminApi.extendRestoreClone(entry.id);
      toast.success(t("sandboxExtendedToast"));
      await refresh(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sandboxExtendFailedToast"));
    }
  };

  const handleDrop = async () => {
    if (!dropTarget) return;
    setSubmitting(true);
    try {
      await backupsAdminApi.dropRestoreClone(dropTarget.id);
      toast.success(t("sandboxDroppedToast"));
      setDropTarget(null);
      await refresh(page);
      onAfterMutate?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sandboxDropFailedToast"));
    } finally {
      setSubmitting(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t("copied", { label })))
      .catch(() => toast.error(t("copyFailed")));
  };

  if (!enabled) return null;

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("sandboxTitle")}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refresh(page)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {t("refresh")}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={atCap || eligibleBackups.length === 0}
            title={
              atCap
                ? t("sandboxCapReached", { max: caps?.maxConcurrent ?? 3 })
                : eligibleBackups.length === 0
                  ? t("sandboxNoBackups")
                  : ""
            }
            className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-[var(--color-button-text)] btn-gold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("sandboxCreateCta")}
          </button>
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] mb-2">
        {t("sandboxDesc", {
          hours: caps?.defaultLifetimeHours ?? 24,
          maxHours: caps?.maxLifetimeHours ?? 48,
        })}
      </p>

      {!loading && data && data.items.length === 0 && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("sandboxEmpty")}
        </div>
      )}

      {loading && !data && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {t("sandboxLoading")}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="space-y-2.5">
          {data.items.map((c) => {
            const badge = statusBadge(c.status, t);
            const remaining = formatRemaining(c.expiresAt, t);
            const remainingCls =
              remaining.tone === "danger"
                ? "text-[#DC2626]"
                : remaining.tone === "warn"
                  ? "text-[#D97706]"
                  : remaining.tone === "expired"
                    ? "text-[var(--color-text-secondary)]"
                    : "text-[#15803D]";
            const isLive = c.status === "ready";
            const isTerminal = c.status === "dropped" || c.status === "expired";

            return (
              <div
                key={c.id}
                className={`bg-[var(--color-surface-card)] border rounded-xl p-4 ${
                  isLive
                    ? "border-[#A7F3D0] shadow-[0_0_0_3px_rgba(167,243,208,0.18)]"
                    : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}
                      >
                        <badge.Icon
                          className={`w-3 h-3 ${("spin" in badge && badge.spin) ? "animate-spin" : ""}`}
                        />
                        {badge.label}
                      </span>
                      {isLive && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${remainingCls}`}
                        >
                          <Timer className="w-3 h-3" />
                          {t("sandboxExpiresIn", { value: remaining.label })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-mono text-[var(--color-text-primary)] truncate" title={c.dbName}>
                      {c.dbName}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate" title={c.backupObject || ""}>
                      {t("sandboxFromBackup", {
                        when: formatTs(c.backupCreatedAt, locale),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isLive && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleExtend(c)}
                          title={t("sandboxExtendTitle", {
                            hours: caps?.defaultLifetimeHours ?? 24,
                            maxHours: caps?.maxLifetimeHours ?? 48,
                          })}
                          className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
                        >
                          <Timer className="w-3.5 h-3.5" />
                          {t("sandboxExtend")}
                        </button>
                        <a
                          href={c.cloudStudioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {t("sandboxOpenStudio")}
                        </a>
                      </>
                    )}
                    {!isTerminal && (
                      <button
                        type="button"
                        onClick={() => setDropTarget(c)}
                        title={t("sandboxDropTitle")}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs text-[#DC2626] border border-[#FECACA] rounded-lg hover:bg-[#FEE2E2]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t("sandboxDrop")}
                      </button>
                    )}
                  </div>
                </div>

                {isLive && (
                  <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-2.5 flex items-center justify-between gap-2">
                    <code className="text-[11px] text-[var(--color-text-secondary)] font-mono truncate">
                      database: {c.dbName}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(c.dbName, t("sandboxDbNameLabel"))}
                      className="inline-flex items-center gap-1 px-2 h-7 text-[11px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-card)]"
                    >
                      <Copy className="w-3 h-3" />
                      {t("copy")}
                    </button>
                  </div>
                )}

                {c.error && (
                  <div className="mt-2 bg-[#FEE2E2] border border-[#FECACA] rounded-lg p-2.5 flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 text-[#DC2626] mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-[#991B1B] font-mono break-all">
                      {c.error}
                    </p>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-[#F3F4F6] flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-secondary)]">
                  <span>
                    {t("sandboxCreated")}: {formatTs(c.createdAt, locale)}
                  </span>
                  {c.droppedAt && (
                    <span>
                      {t("sandboxDroppedAt")}: {formatTs(c.droppedAt, locale)}
                    </span>
                  )}
                  <span>
                    {t("sandboxBy")}: {c.createdBy.name || c.createdBy.email || "—"}
                  </span>
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t("pagination", {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, total),
                  total,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  aria-label={t("paginationPrev")}
                  className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  aria-label={t("paginationNext")}
                  className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create sandbox modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => !submitting && setCreateOpen(false)}
        >
          <div
            className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl shadow-xl max-w-lg w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-[#1E40AF]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {t("sandboxCreateTitle")}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("sandboxCreateBody", {
                    hours: caps?.defaultLifetimeHours ?? 24,
                  })}
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
                className="w-7 h-7 rounded-lg hover:bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              {t("sandboxPickBackup")}
            </label>
            <select
              value={selectedBackupId}
              onChange={(e) => setSelectedBackupId(e.target.value)}
              disabled={submitting}
              className="w-full px-3 h-10 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] disabled:opacity-50"
            >
              <option value="">{t("sandboxPickBackupPlaceholder")}</option>
              {eligibleBackups.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatTs(b.createdAt, locale)} ({b.gcsObject})
                </option>
              ))}
            </select>

            <div className="mt-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
              <div className="text-xs text-[#92400E] leading-relaxed space-y-1">
                <p>{t("sandboxCreateWarning1")}</p>
                <p>{t("sandboxCreateWarning2")}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
                className="px-3 h-10 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {t("rollbackCancel")}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting || !selectedBackupId}
                className="inline-flex items-center justify-center gap-2 px-4 h-10 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("sandboxCreatingShort")}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    {t("sandboxCreateConfirm")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop confirm modal */}
      {dropTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => !submitting && setDropTarget(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[#DC2626]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {t("sandboxDropTitleModal")}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("sandboxDropBody")}
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setDropTarget(null)}
                disabled={submitting}
                className="w-7 h-7 rounded-lg hover:bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3 mb-3">
              <p className="font-mono text-xs text-[var(--color-text-primary)] truncate" title={dropTarget.dbName}>
                {dropTarget.dbName}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDropTarget(null)}
                disabled={submitting}
                className="px-3 h-10 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {t("rollbackCancel")}
              </button>
              <button
                type="button"
                onClick={handleDrop}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-4 h-10 text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("sandboxDropping")}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {t("sandboxDropConfirm")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
