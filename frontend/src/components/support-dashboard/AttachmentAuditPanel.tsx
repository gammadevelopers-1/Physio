"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Upload,
  Trash2,
  Eye,
  Globe2,
} from "lucide-react";
import { supportApi } from "@/lib/api";

interface Props {
  ticketId: string;
  /** Renders only if the current user has supervisor / admin rights.
   *  The download log endpoint enforces this server-side too; we
   *  hide the section client-side so the network call is skipped. */
  canSeeDownloadLog: boolean;
}

type HistoryRow = {
  id: string;
  url: string;
  filename: string | null;
  sizeBytes: number;
  mimeType: string | null;
  uploadedAt: string;
  removedAt: string | null;
  uploaderId: string | null;
  uploaderFirstName: string | null;
  uploaderLastName: string | null;
  uploaderEmail: string | null;
  removerId: string | null;
  removerFirstName: string | null;
  removerLastName: string | null;
  removerEmail: string | null;
};

type DownloadRow = {
  id: string;
  attachmentUrl: string;
  downloadedAt: string;
  ipAddress: string | null;
  downloaderFirstName: string | null;
  downloaderLastName: string | null;
  downloaderEmail: string | null;
};

export default function AttachmentAuditPanel({
  ticketId,
  canSeeDownloadLog,
}: Props) {
  const t = useTranslations("supportDashboard.attachmentAudit");
  const locale = useLocale();

  const [expanded, setExpanded] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [downloadRows, setDownloadRows] = useState<DownloadRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingDownloads, setLoadingDownloads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Lazy-load on first expand. Reload also fires after a soft-delete
  // so the timeline reflects the new state — that's owned by the
  // parent; the parent passes a fresh key or calls refresh().
  useEffect(() => {
    if (!expanded || loaded) return;
    let cancelled = false;
    setError(null);
    setLoadingHistory(true);
    setLoadingDownloads(canSeeDownloadLog);
    const tasks: Promise<void>[] = [
      supportApi
        .getAttachmentHistory(ticketId)
        .then((rows) => {
          if (!cancelled) setHistoryRows(rows);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : t("loadError"));
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingHistory(false);
        }),
    ];
    if (canSeeDownloadLog) {
      tasks.push(
        supportApi
          .getAttachmentDownloadLog(ticketId)
          .then((rows) => {
            if (!cancelled) setDownloadRows(rows);
          })
          .catch(() => {
            // Don't blow up the panel if just this one fails — the
            // history half is more important.
          })
          .finally(() => {
            if (!cancelled) setLoadingDownloads(false);
          }),
      );
    }
    Promise.all(tasks).then(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [expanded, loaded, ticketId, canSeeDownloadLog, t]);

  // Group downloads by attachment URL so the log reads as "for
  // each file, who downloaded it" instead of one long undifferentiated
  // list. The history rows give us the canonical labels.
  const downloadsByUrl = new Map<string, DownloadRow[]>();
  for (const row of downloadRows) {
    const list = downloadsByUrl.get(row.attachmentUrl) ?? [];
    list.push(row);
    downloadsByUrl.set(row.attachmentUrl, list);
  }
  const labelForUrl = (url: string): string => {
    const match = historyRows.find((h) => h.url === url);
    return match?.filename ?? url.split("/").pop() ?? url;
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-5 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
          <h3
            className="text-sm font-semibold text-[var(--color-text-primary)] truncate"
            title={t("title")}
          >
            {t("title")}
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* History timeline */}
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
              {t("historyHeading")}
            </h4>
            {loadingHistory && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t("loading")}
              </div>
            )}
            {!loadingHistory && error && (
              <div className="flex items-center gap-2 text-xs text-[#DC2626] py-2">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </div>
            )}
            {!loadingHistory && !error && historyRows.length === 0 && (
              <div className="text-xs text-[var(--color-text-secondary)] py-2">
                {t("historyEmpty")}
              </div>
            )}
            {!loadingHistory && !error && historyRows.length > 0 && (
              <ol className="relative ps-3 space-y-3 max-h-64 overflow-y-auto pe-1">
                {historyRows.map((row, idx) => (
                  <HistoryRowItem
                    key={row.id}
                    row={row}
                    locale={locale}
                    t={t}
                    isLast={idx === historyRows.length - 1}
                  />
                ))}
              </ol>
            )}
          </section>

          {/* Download log (supervisor + admin only) */}
          {canSeeDownloadLog && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t("downloadsHeading")}
              </h4>
              {loadingDownloads && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t("loading")}
                </div>
              )}
              {!loadingDownloads && downloadsByUrl.size === 0 && (
                <div className="text-xs text-[var(--color-text-secondary)] py-2">
                  {t("downloadsEmpty")}
                </div>
              )}
              {!loadingDownloads && downloadsByUrl.size > 0 && (
                <div className="space-y-3 max-h-72 overflow-y-auto pe-1">
                  {Array.from(downloadsByUrl.entries()).map(([url, list]) => (
                    <div
                      key={url}
                      className="border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-surface-page)]"
                    >
                      <div
                        className="text-xs font-semibold text-[var(--color-text-primary)] truncate mb-2"
                        title={labelForUrl(url)}
                      >
                        {labelForUrl(url)}
                      </div>
                      <ul className="space-y-1.5">
                        {list.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] flex-wrap"
                          >
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {formatPerson(row) ?? t("anonymous")}
                            </span>
                            <span>·</span>
                            <span>{formatDate(row.downloadedAt, locale)}</span>
                            {row.ipAddress && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <Globe2 className="w-3 h-3" />
                                  {row.ipAddress}
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────

type T = ReturnType<typeof useTranslations>;

function HistoryRowItem({
  row,
  locale,
  t,
  isLast,
}: {
  row: HistoryRow;
  locale: string;
  t: T;
  isLast: boolean;
}) {
  const isRemoved = !!row.removedAt;
  const filename =
    row.filename ?? row.url.split("/").pop() ?? t("untitled");
  return (
    <li className="relative">
      {!isLast && (
        <span
          aria-hidden
          className="absolute -start-[2px] top-[14px] -bottom-3 w-px bg-[var(--color-border)]"
        />
      )}
      {/* Upload event */}
      <span
        className="absolute -start-[7px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--color-surface-card)]"
        style={{ backgroundColor: "#16A34A" }}
      />
      <div className="ms-3">
        <div className="flex items-center gap-1.5 text-xs">
          <Upload className="w-3 h-3 text-[#16A34A]" />
          <span
            className={`font-medium truncate ${
              isRemoved
                ? "line-through text-[var(--color-text-secondary)]"
                : "text-[var(--color-text-primary)]"
            }`}
            title={filename}
          >
            {filename}
          </span>
          {row.sizeBytes > 0 && (
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              · {formatBytes(row.sizeBytes)}
            </span>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-text-secondary)]">
          {formatPersonNamed(
            row.uploaderFirstName,
            row.uploaderLastName,
            row.uploaderEmail,
          ) ?? t("uploadedByUnknown")}
          {" · "}
          {formatDate(row.uploadedAt, locale)}
        </div>

        {/* Removal event — only when removed */}
        {isRemoved && row.removedAt && (
          <div className="mt-2 ms-0">
            <div className="flex items-center gap-1.5 text-xs">
              <Trash2 className="w-3 h-3 text-[#DC2626]" />
              <span className="font-medium text-[#DC2626]">
                {t("removed")}
              </span>
            </div>
            <div className="text-[10px] text-[var(--color-text-secondary)]">
              {formatPersonNamed(
                row.removerFirstName,
                row.removerLastName,
                row.removerEmail,
              ) ?? t("removedByUnknown")}
              {" · "}
              {formatDate(row.removedAt, locale)}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function formatPerson(row: DownloadRow): string | null {
  return formatPersonNamed(
    row.downloaderFirstName,
    row.downloaderLastName,
    row.downloaderEmail,
  );
}

function formatPersonNamed(
  first: string | null,
  last: string | null,
  email: string | null,
): string | null {
  const full = `${first ?? ""} ${last ?? ""}`.trim();
  if (full) return full;
  if (email) return email;
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
