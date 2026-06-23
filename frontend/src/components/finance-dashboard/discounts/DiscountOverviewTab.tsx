"use client";

/**
 * Overview tab — first thing finance sees when they open Discounts.
 *
 * Layout:
 *   • 6 KPI cards (live + period stats with deltas)
 *   • Period picker → drives all charts
 *   • 3 chart panels: daily savings (line), code-type breakdown (donut),
 *                     validation funnel (bar)
 *   • Top 10 codes (horizontal bar)
 *   • 2 activity feeds: recent redemptions, recent failed validations
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Tag,
  Megaphone,
  Sparkles,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { discountApi } from "@/lib/api";
import Money from "../shared/Money";
import { FINANCE_COLORS, CHART_PALETTE } from "../shared/financeColors";
import DateRangeFilter from "../DateRangeFilter";

interface Summary {
  live: { activeCodes: number; autoApplyCodes: number; activeCampaigns: number };
  window: { redemptions: number; totalSaved: number; avgSaved: number; uniqueUsers: number };
}
interface ChartData {
  daily: Array<{ day: string; saved: number; redemptions: number }>;
  typeBreakdown: { percentage: number; fixed: number; earlyBird: number; campaign: number; autoApply: number };
  topCodes: Array<{ id: string; code: string; type: string; value: number; totalSaved: number; conversions: number }>;
  funnel: { attempted: number; validated: number; redeemed: number; failed: number };
}
interface Activity {
  recentRedemptions: Array<{
    id: string;
    discountId: string | null;
    code: string | null;
    userEmail: string | null;
    amountSaved: number;
    paymentId: string;
    usedAt: string;
  }>;
  recentFailures: Array<{
    id: string;
    code: string | null;
    error: string | null;
    userEmail: string | null;
    createdAt: string;
  }>;
}

interface RangeState {
  startDate?: string;
  endDate?: string;
  label: string;
}

function defaultRange(): RangeState {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: today.toISOString().slice(0, 10),
    label: "30d",
  };
}

function fmtRelative(iso: string, locale: string) {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return locale === "ar" ? "الآن" : "Just now";
  if (mins < 60) return locale === "ar" ? `قبل ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return locale === "ar" ? `قبل ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return locale === "ar" ? `قبل ${days} يوم` : `${days}d ago`;
}

interface Props {
  onOpenCoupon: (id: string | null) => void;
  onSwitchTab: (tab: string) => void;
}

const DiscountOverviewTab = ({ onOpenCoupon, onSwitchTab }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.overview");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [range, setRange] = useState<RangeState>(defaultRange());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);

  const fetchData = useCallback(async () => {
    const [s, c, a] = await Promise.all([
      discountApi.getSummary({ startDate: range.startDate, endDate: range.endDate }).catch(() => null),
      discountApi.getChartSeries({ startDate: range.startDate, endDate: range.endDate }).catch(() => null),
      discountApi.getRecentActivity(8).catch(() => null),
    ]);
    setSummary(s);
    setChart(c);
    setActivity(a);
  }, [range.startDate, range.endDate]);

  useEffect(() => {
    // Intentional: fetchData is async and writes state when it resolves.
    // The eager call here just kicks off the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const kpis = useMemo(() => {
    const live = summary?.live;
    const win = summary?.window;
    return [
      {
        label: t("kpi.activeCodes"),
        value: live?.activeCodes ?? "—",
        sublabel: t("kpi.activeCodesSub", { n: live?.autoApplyCodes ?? 0 }),
        icon: Tag,
        color: FINANCE_COLORS.success,
        onClick: () => onSwitchTab("codes"),
      },
      {
        label: t("kpi.activeCampaigns"),
        value: live?.activeCampaigns ?? "—",
        sublabel: t("kpi.activeCampaignsSub"),
        icon: Megaphone,
        color: FINANCE_COLORS.violet,
        onClick: () => onSwitchTab("campaigns"),
      },
      {
        label: t("kpi.totalSaved"),
        value: win ? <Money amount={win.totalSaved} decimals={0} className="text-2xl font-bold" /> : "—",
        sublabel: t("kpi.totalSavedSub"),
        icon: TrendingUp,
        color: FINANCE_COLORS.info,
      },
      {
        label: t("kpi.redemptions"),
        value: win?.redemptions ?? "—",
        sublabel: t("kpi.redemptionsSub"),
        icon: ShoppingCart,
        color: FINANCE_COLORS.warning,
      },
      {
        label: t("kpi.avgSaved"),
        value: win ? <Money amount={win.avgSaved} decimals={0} className="text-2xl font-bold" /> : "—",
        sublabel: t("kpi.avgSavedSub"),
        icon: Sparkles,
        color: FINANCE_COLORS.slate,
      },
      {
        label: t("kpi.failedValidations"),
        value: chart?.funnel.failed ?? "—",
        sublabel: t("kpi.failedValidationsSub"),
        icon: AlertTriangle,
        color: FINANCE_COLORS.error,
      },
    ];
  }, [summary, chart, t, onSwitchTab]);

  const typeData = useMemo(() => {
    if (!chart) return [];
    const b = chart.typeBreakdown;
    return [
      { name: t("charts.typePercentage"), value: b.percentage },
      { name: t("charts.typeFixed"), value: b.fixed },
      { name: t("charts.typeEarlyBird"), value: b.earlyBird },
      { name: t("charts.typeCampaign"), value: b.campaign },
    ].filter((d) => d.value > 0);
  }, [chart, t]);

  const funnelData = useMemo(() => {
    if (!chart) return [];
    return [
      { stage: t("charts.funnelAttempted"), value: chart.funnel.attempted },
      { stage: t("charts.funnelValidated"), value: chart.funnel.validated },
      { stage: t("charts.funnelRedeemed"), value: chart.funnel.redeemed },
    ];
  }, [chart, t]);

  return (
    <div className="space-y-5">
      {/* Period picker row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("rangeLabel", {
            range: (t as (k: string) => string)(`ranges.${range.label}`) || range.label,
          })}
        </p>
        <DateRangeFilter onChange={setRange} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          const clickable = !!k.onClick;
          return (
            <button
              key={i}
              type="button"
              onClick={k.onClick}
              disabled={!clickable}
              className={`bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 text-start transition-shadow ${
                clickable ? "hover:shadow-md cursor-pointer" : "cursor-default"
              }`}
            >
              <div className={`flex items-start justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <div className={`w-9 h-9 rounded-lg ${k.color.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${k.color.text}`} />
                </div>
                {clickable && <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]/40" />}
              </div>
              <p className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
                {k.label}
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5 leading-tight">
                {k.value}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{k.sublabel}</p>
            </button>
          );
        })}
      </div>

      {/* Charts row 1: Daily savings (wider) + type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("charts.dailyTitle")}</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">{t("charts.dailySubtitle")}</p>
            </div>
          </div>
          <div className="h-64">
            {chart && chart.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart.daily} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="savedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={FINANCE_COLORS.success.hex} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={FINANCE_COLORS.success.hex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => d.slice(5)}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v, n) =>
                      String(n) === "saved"
                        ? [`SAR ${v}`, t("charts.saved")]
                        : [v as number, t("charts.redemptions")]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="saved"
                    stroke={FINANCE_COLORS.success.hex}
                    strokeWidth={2.5}
                    dot={false}
                    fill="url(#savedGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="redemptions"
                    stroke={FINANCE_COLORS.info.hex}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.dailyEmpty")} />
            )}
          </div>
        </div>

        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            {t("charts.typeTitle")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">{t("charts.typeSubtitle")}</p>
          <div className="h-64">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" outerRadius={70} innerRadius={42} paddingAngle={2}>
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.typeEmpty")} />
            )}
          </div>
        </div>
      </div>

      {/* Charts row 2: Funnel + Top codes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            {t("charts.funnelTitle")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">{t("charts.funnelSubtitle")}</p>
          <div className="h-56">
            {chart && chart.funnel.attempted > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" fill={FINANCE_COLORS.violet.hex} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("charts.funnelEmpty")} />
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            {t("charts.topCodesTitle")}
          </h3>
          {chart && chart.topCodes.length > 0 ? (
            <div className="space-y-2">
              {chart.topCodes.slice(0, 8).map((c) => {
                const max = chart.topCodes[0]?.totalSaved || 1;
                const pct = Math.max((c.totalSaved / max) * 100, 8);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpenCoupon(c.id)}
                    className="w-full flex items-center gap-3 hover:bg-[var(--color-surface-page)] rounded-md px-2 py-1 -mx-2 transition-colors text-start"
                  >
                    <span className="font-mono text-[11px] font-bold text-[var(--color-text-primary)] w-24 truncate">
                      {c.code}
                    </span>
                    <div className="flex-1 h-6 bg-[var(--color-surface-page)] rounded-md overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/70 rounded-md flex items-center px-2"
                        style={{ width: `${pct}%` }}
                      >
                        <span className="text-[10px] text-white font-bold whitespace-nowrap">
                          <Money amount={c.totalSaved} decimals={0} iconClassName="text-white" />
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-secondary)] w-16 text-end">
                      {c.conversions} uses
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyChart label={t("charts.topCodesEmpty")} small />
          )}
        </div>
      </div>

      {/* Activity feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityCard
          title={t("activity.recentTitle")}
          empty={t("activity.recentEmpty")}
          icon={ArrowUpRight}
          accent={FINANCE_COLORS.success}
        >
          {activity?.recentRedemptions.length ? (
            activity.recentRedemptions.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 py-2 border-b border-[var(--color-border-subtle)] last:border-b-0"
              >
                <div className="w-7 h-7 rounded-md bg-[#DCFCE7] flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#15803D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[var(--color-text-primary)] truncate">
                    <span className="font-mono font-bold">{r.code ?? "—"}</span>
                    {" · "}
                    <span className="text-[var(--color-text-secondary)]">{r.userEmail ?? "—"}</span>
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    {fmtRelative(r.usedAt, locale)}
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-[#15803D]">
                  <Money amount={r.amountSaved} decimals={0} />
                </span>
              </div>
            ))
          ) : null}
        </ActivityCard>

        <ActivityCard
          title={t("activity.failuresTitle")}
          empty={t("activity.failuresEmpty")}
          icon={ArrowDownRight}
          accent={FINANCE_COLORS.error}
        >
          {activity?.recentFailures.length ? (
            activity.recentFailures.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 py-2 border-b border-[var(--color-border-subtle)] last:border-b-0"
              >
                <div className="w-7 h-7 rounded-md bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[var(--color-text-primary)] truncate">
                    <span className="font-mono font-bold">{r.code ?? "—"}</span>
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
                    {r.error ?? "—"} · {fmtRelative(r.createdAt, locale)}
                  </p>
                </div>
                <span className="text-[10px] text-[var(--color-text-secondary)] truncate max-w-[120px]">
                  {r.userEmail ?? "—"}
                </span>
              </div>
            ))
          ) : null}
        </ActivityCard>
      </div>
    </div>
  );
};

const EmptyChart = ({ label, small }: { label: string; small?: boolean }) => (
  <div className={`flex items-center justify-center h-full text-[var(--color-text-secondary)] ${small ? "text-xs" : "text-sm"}`}>
    {label}
  </div>
);

const ActivityCard = ({
  title,
  empty,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  empty: string;
  icon: typeof Tag;
  accent: { bg: string; text: string };
  children: React.ReactNode;
}) => {
  const hasChildren = !!children && (Array.isArray(children) ? children.length > 0 : true);
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-md ${accent.bg} flex items-center justify-center`}>
          <Icon className={`w-3.5 h-3.5 ${accent.text}`} />
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      {hasChildren ? children : (
        <p className="text-center py-6 text-xs text-[var(--color-text-secondary)]">{empty}</p>
      )}
    </div>
  );
};

export default DiscountOverviewTab;
