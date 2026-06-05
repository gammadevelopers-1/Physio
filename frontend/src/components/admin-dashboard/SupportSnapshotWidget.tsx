"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Headphones,
  ArrowRight,
  Clock,
  AlertTriangle,
  Smile,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { supportApi } from "@/lib/api";

interface Snapshot {
  openTickets: number;
  highPriorityOpen: number;
  slaBreaches: number;
  slaCompliance: number;
  csatAvgScore: number;
  csatResponses: number;
  avgFrtMinutes: number | null;
  avgTtrMinutes: number | null;
}

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

const SupportSnapshotWidget = () => {
  const t = useTranslations("adminDashboard.supportSnapshot");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const k = await supportApi.getKPIs();
        if (cancelled) return;
        setData({
          openTickets: Number(k.openTickets) || 0,
          highPriorityOpen: Number(k.highPriorityOpen) || 0,
          slaBreaches: Number(k.slaBreaches) || 0,
          slaCompliance: Number(k.slaCompliance) || 0,
          csatAvgScore: Number(k.csatAvgScore) || 0,
          csatResponses: Number(k.csatResponses) || 0,
          avgFrtMinutes: k.avgFrtMinutes,
          avgTtrMinutes: k.avgTtrMinutes,
        });
      } catch {
        // Leave previous state intact
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Refresh every 2 minutes (admin glance — doesn't need 60s pulse)
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 120_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const supportHref = `/${locale}/dashboard/admin/support`;

  const healthState =
    !data
      ? "neutral"
      : data.slaBreaches === 0 && data.slaCompliance >= 90
        ? "healthy"
        : data.slaBreaches > 5 || data.slaCompliance < 70
          ? "critical"
          : "warning";

  const healthChipClass: Record<typeof healthState, string> = {
    healthy: "bg-[#DCFCE7] text-[#15803D]",
    warning: "bg-[#FFEDD5] text-[#C2410C]",
    critical: "bg-[#FEE2E2] text-[#DC2626]",
    neutral: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
            <Headphones className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h3>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-1 rounded-full uppercase ${healthChipClass[healthState]}`}
        >
          {t(`health.${healthState}`)}
        </span>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : !data ? (
        <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
          {t("loadFailed")}
        </p>
      ) : (
        <>
          {/* Headline stat — Open tickets */}
          <div className="mb-4">
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {t("openTickets")}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--color-text-primary)]">
                {data.openTickets}
              </span>
              {data.highPriorityOpen > 0 && (
                <span className="text-[11px] font-medium text-[#DC2626] inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t("highPriorityOpen", { count: data.highPriorityOpen })}
                </span>
              )}
            </div>
          </div>

          {/* Stat grid — 2x2 */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="p-2.5 bg-[var(--color-surface-page)] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3 h-3 text-[#8B5CF6]" />
                <p className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold tracking-wide">
                  {t("sla")}
                </p>
              </div>
              <p
                className={`text-sm font-bold ${
                  data.slaCompliance >= 90
                    ? "text-[#15803D]"
                    : data.slaCompliance >= 70
                      ? "text-[#C2410C]"
                      : "text-[#DC2626]"
                }`}
              >
                {data.slaCompliance}%
              </p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                {t("breachesToday", { count: data.slaBreaches })}
              </p>
            </div>

            <div className="p-2.5 bg-[var(--color-surface-page)] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Smile className="w-3 h-3 text-[#16A34A]" />
                <p className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold tracking-wide">
                  {t("csat")}
                </p>
              </div>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {data.csatAvgScore > 0
                  ? `${data.csatAvgScore.toFixed(1)}/5`
                  : "—"}
              </p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                {data.csatResponses > 0
                  ? t("csatResponses", { count: data.csatResponses })
                  : t("noResponses")}
              </p>
            </div>

            <div className="p-2.5 bg-[var(--color-surface-page)] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-[#3B82F6]" />
                <p className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold tracking-wide">
                  {t("frt")}
                </p>
              </div>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {formatMinutes(data.avgFrtMinutes)}
              </p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                {t("avgFirstReply")}
              </p>
            </div>

            <div className="p-2.5 bg-[var(--color-surface-page)] rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-[#EA580C]" />
                <p className="text-[10px] text-[var(--color-text-secondary)] uppercase font-semibold tracking-wide">
                  {t("ttr")}
                </p>
              </div>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                {formatMinutes(data.avgTtrMinutes)}
              </p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                {t("avgResolution")}
              </p>
            </div>
          </div>

          <Link
            href={supportHref}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
          >
            {t("openSupport")}
            <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </>
      )}
    </div>
  );
};

export default SupportSnapshotWidget;
