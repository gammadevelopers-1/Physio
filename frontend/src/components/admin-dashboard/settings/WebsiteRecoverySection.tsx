"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import {
  websiteRecoveryAdminApi,
  type WebsiteRecoveryConfig,
  type WebsiteRevision,
  type WebsiteRevisionsResponse,
} from "@/lib/api";

const OLD_REVISION_WARN_DAYS = 30;

interface Props {
  /** Render only when the backups feature is enabled (gcp env). */
  enabled: boolean;
}

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

function shortImage(image: string | null): string {
  if (!image) return "—";
  // Show only the tag portion after the last ':' for compactness.
  const colon = image.lastIndexOf(":");
  return colon >= 0 ? image.slice(colon + 1) : image;
}

export default function WebsiteRecoverySection({ enabled }: Props) {
  const t = useTranslations("adminDashboard.settingsPage.backups");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WebsiteRevisionsResponse | null>(null);
  const [config, setConfig] = useState<WebsiteRecoveryConfig | null>(null);
  const [target, setTarget] = useState<WebsiteRevision | null>(null);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, list] = await Promise.all([
        websiteRecoveryAdminApi.getConfig().catch(() => null),
        websiteRecoveryAdminApi.listRevisions().catch(
          () =>
            ({
              available: false,
              items: [],
              currentRevision: null,
              service: "",
              region: "",
            }) as WebsiteRevisionsResponse,
        ),
      ]);
      if (cfg) setConfig(cfg);
      setData(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refresh();
  }, [enabled, refresh]);

  // Auto-focus the confirm input + close on Esc when the modal opens.
  useEffect(() => {
    if (!target) return;
    const f = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(f);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, submitting]);

  const openModal = (rev: WebsiteRevision) => {
    setTarget(rev);
    setTyped("");
  };

  const closeModal = () => {
    if (submitting) return;
    setTarget(null);
    setTyped("");
  };

  const confirmMatches =
    !!config &&
    typed.trim().toLowerCase() === config.confirmDomain.trim().toLowerCase();

  const handleRollback = async () => {
    if (!target || !config || !confirmMatches) return;
    setSubmitting(true);
    try {
      await websiteRecoveryAdminApi.rollback(
        target.shortName,
        typed.trim(),
      );
      toast.success(t("rolledBackToast", { revision: target.shortName }));
      setTarget(null);
      setTyped("");
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("rollbackFailedToast"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("websiteTitle")}
          </h3>
        </div>
        <button
          type="button"
          onClick={refresh}
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
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] mb-2">
        {t("websiteDesc")}
      </p>

      {/* API unavailable (e.g. missing IAM grant) — friendly inline notice */}
      {!loading && data && !data.available && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#92400E]">
            {t("websiteUnavailable")}
            {data.error ? (
              <span className="block font-mono mt-1 opacity-70">
                {data.error}
              </span>
            ) : null}
          </p>
        </div>
      )}

      {/* Revisions table */}
      {!loading && data && data.available && data.items.length > 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <tr>
                <Th isRTL={isRTL}>{t("colRevision")}</Th>
                <Th isRTL={isRTL}>{t("colDeployed")}</Th>
                <Th isRTL={isRTL}>{t("colImage")}</Th>
                <Th isRTL={isRTL}>{t("colTraffic")}</Th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr
                  key={r.shortName}
                  className="border-b border-[#F3F4F6] last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-[var(--color-text-primary)]">
                      {r.shortName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                    {formatTs(r.createdAt, locale)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono">
                    {shortImage(r.image)}
                  </td>
                  <td className="px-4 py-3">
                    {r.isLive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DCFCE7] text-[#15803D]">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("liveBadge")}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                        {r.percent}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!r.isLive && (
                      <button
                        type="button"
                        onClick={() => openModal(r)}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t("rollback")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.available && data.items.length === 0 && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("revisionsEmpty")}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {t("loadingRevisions")}
        </div>
      )}

      {/* Confirm modal */}
      {target && config && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={closeModal}
        >
          <div
            className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#D97706]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {t("rollbackTitle")}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("rollbackBody")}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="w-7 h-7 rounded-lg hover:bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3 mb-3 space-y-1">
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("rollbackTargetLabel")}
                </span>
                <span className="font-mono text-[var(--color-text-primary)] truncate">
                  {target.shortName}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colDeployed")}
                </span>
                <span className="font-mono text-[var(--color-text-primary)]">
                  {formatTs(target.createdAt, locale)}
                </span>
              </div>
            </div>

            {target.ageDays !== null && target.ageDays > OLD_REVISION_WARN_DAYS && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-2.5 mb-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-[#92400E] leading-relaxed">
                  {t("rollbackOldWarning", { days: target.ageDays })}
                </p>
              </div>
            )}

            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              {t("rollbackConfirmLabel", { domain: config.confirmDomain })}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={submitting}
              placeholder={config.confirmDomain}
              className="w-full px-3 h-10 text-sm font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 disabled:opacity-50"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              {t("rollbackConfirmHint")}
            </p>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="px-3 h-10 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {t("rollbackCancel")}
              </button>
              <button
                type="button"
                onClick={handleRollback}
                disabled={!confirmMatches || submitting}
                className="inline-flex items-center justify-center gap-2 px-4 h-10 text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#FCA5A5]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("rollingBack")}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    {t("rollbackCta")}
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

function Th({ children, isRTL }: { children: React.ReactNode; isRTL: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${
        isRTL ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
