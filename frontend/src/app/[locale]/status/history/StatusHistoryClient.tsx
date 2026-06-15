"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2 } from "lucide-react";
import {
  serviceStatusApi,
  type StatusHistoryIncident,
  type StatusHistoryResponse,
} from "@/lib/api";

interface Props {
  locale: string;
}

type Severity = "minor" | "major" | "critical";

const PAGE_SIZE = 50;

// Preset date-range chips. Each maps to a `from` date relative to
// "now" (computed at render time); `to` stays open-ended.
const RANGE_PRESETS: { key: string; label: { en: string; ar: string }; days: number | null }[] = [
  { key: "30d", label: { en: "Last 30 days", ar: "آخر 30 يوم" }, days: 30 },
  { key: "90d", label: { en: "Last 90 days", ar: "آخر 90 يوم" }, days: 90 },
  { key: "6m", label: { en: "Last 6 months", ar: "آخر 6 أشهر" }, days: 180 },
  { key: "1y", label: { en: "Last 12 months", ar: "آخر 12 شهر" }, days: 365 },
  { key: "all", label: { en: "All time", ar: "كل الوقت" }, days: null },
];

function sevTheme(sev: Severity) {
  if (sev === "critical")
    return "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]";
  if (sev === "major") return "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]";
  return "bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]";
}

function fmtDuration(min: number, isAr: boolean): string {
  if (min < 1) return isAr ? "< 1 دقيقة" : "< 1 min";
  if (min < 60) return isAr ? `${min} دقيقة` : `${min} min`;
  const hours = min / 60;
  if (hours < 24)
    return isAr ? `${hours.toFixed(1)} ساعة` : `${hours.toFixed(1)} h`;
  const days = hours / 24;
  return isAr ? `${days.toFixed(1)} يوم` : `${days.toFixed(1)} d`;
}

export default function StatusHistoryClient({ locale }: Props) {
  const isAr = locale === "ar";
  const [rangeKey, setRangeKey] = useState<string>("90d");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StatusHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fromDate = useMemo(() => {
    const preset = RANGE_PRESETS.find((p) => p.key === rangeKey);
    if (!preset || preset.days === null) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - preset.days);
    return d.toISOString();
  }, [rangeKey]);

  // Reset to page 1 whenever filters change so the user isn't stuck
  // on page 5 of a smaller filtered result set.
  useEffect(() => {
    setPage(1);
  }, [rangeKey, severity]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    serviceStatusApi
      .getPublicHistory({
        page,
        pageSize: PAGE_SIZE,
        from: fromDate,
        severity: severity || undefined,
      })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, fromDate, severity]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] me-1">
            {isAr ? "النطاق:" : "Range:"}
          </span>
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                rangeKey === r.key
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "bg-white border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
              }`}
            >
              {isAr ? r.label.ar : r.label.en}
            </button>
          ))}
          <span className="ms-auto" />
          <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] me-1">
            {isAr ? "الخطورة:" : "Severity:"}
          </span>
          {(["", "minor", "major", "critical"] as const).map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setSeverity(s)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors capitalize ${
                severity === s
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "bg-white border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
              }`}
            >
              {s === "" ? (isAr ? "كل" : "All") : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-sm text-[var(--color-text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin me-2" />
            {isAr ? "جارٍ التحميل…" : "Loading…"}
          </div>
        ) : !data || data.incidents.length === 0 ? (
          <div className="text-center py-16 text-sm text-[var(--color-text-secondary)]">
            {isAr ? "لا توجد حوادث في هذا النطاق." : "No incidents in this range."}
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[1fr_100px_140px_140px_100px_40px] gap-3 px-4 py-2.5 bg-[var(--color-surface-page)] text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              <div>{isAr ? "العنوان" : "Title"}</div>
              <div>{isAr ? "الخطورة" : "Severity"}</div>
              <div>{isAr ? "بدأ" : "Started"}</div>
              <div>{isAr ? "تم الحل" : "Resolved"}</div>
              <div>{isAr ? "المدة" : "Duration"}</div>
              <div />
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {data.incidents.map((inc) => (
                <HistoryRow
                  key={inc.id}
                  incident={inc}
                  locale={locale}
                  isAr={isAr}
                  expanded={expandedId === inc.id}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === inc.id ? null : inc.id))
                  }
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {isAr
              ? `صفحة ${data.page} من ${totalPages} — ${data.total} حادث`
              : `Page ${data.page} of ${totalPages} — ${data.total} incidents`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-2.5 h-8 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className={`w-3 h-3 ${isAr ? "rotate-180" : ""}`} />
              {isAr ? "السابق" : "Prev"}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 px-2.5 h-8 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAr ? "التالي" : "Next"}
              <ChevronRight className={`w-3 h-3 ${isAr ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  incident,
  locale,
  isAr,
  expanded,
  onToggle,
}: {
  incident: StatusHistoryIncident;
  locale: string;
  isAr: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const title = isAr && incident.titleAr ? incident.titleAr : incident.titleEn;
  const dateFmt = new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const latest = incident.latestUpdate;
  const latestMsg = latest
    ? isAr && latest.messageAr
      ? latest.messageAr
      : latest.messageEn
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-start px-4 py-3 hover:bg-[var(--color-surface-page)] transition-colors"
      >
        <div className="hidden md:grid grid-cols-[1fr_100px_140px_140px_100px_40px] gap-3 items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {title}
            </p>
            {incident.affectedComponents.length > 0 && (
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                {incident.affectedComponents.join(" · ")}
              </p>
            )}
          </div>
          <div>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${sevTheme(incident.severity)}`}
            >
              {incident.severity}
            </span>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {dateFmt.format(new Date(incident.startedAt))}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {dateFmt.format(new Date(incident.resolvedAt))}
          </div>
          <div className="text-xs text-[var(--color-text-primary)] font-medium">
            {fmtDuration(incident.durationMinutes, isAr)}
          </div>
          <div className="flex justify-end">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
          </div>
        </div>
        {/* Mobile stacked layout */}
        <div className="md:hidden space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-[var(--color-text-primary)] flex-1">
              {title}
            </p>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded border capitalize ${sevTheme(incident.severity)}`}
            >
              {incident.severity}
            </span>
          </div>
          <div className="text-[10px] text-[var(--color-text-secondary)] flex items-center gap-2 flex-wrap">
            <span>{dateFmt.format(new Date(incident.startedAt))}</span>
            <span>·</span>
            <span>{fmtDuration(incident.durationMinutes, isAr)}</span>
          </div>
        </div>
      </button>

      {expanded && latestMsg && (
        <div className="px-4 pb-3 -mt-1 text-xs text-[var(--color-text-primary)] whitespace-pre-line bg-[var(--color-surface-page)] border-t border-[var(--color-border)] pt-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] mb-1">
            {isAr ? "آخر تحديث" : "Final update"} — {locale === "ar" ? new Date(latest!.postedAt).toLocaleString("ar-SA") : new Date(latest!.postedAt).toLocaleString("en-US")}
          </p>
          {latestMsg}
        </div>
      )}
    </li>
  );
}
