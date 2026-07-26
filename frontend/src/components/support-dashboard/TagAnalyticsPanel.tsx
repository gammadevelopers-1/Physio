"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, TrendingUp, Archive, Tag as TagIcon, CheckCircle2 } from "lucide-react";
import { supportApi } from "@/lib/api";

type Analytics = Awaited<ReturnType<typeof supportApi.getTagAnalytics>>;

function textForBg(hex: string): string {
  const m = hex.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return "#111827";
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
    ? "#1F2937"
    : "#FFFFFF";
}

// Settings → Tags → Analytics. Three rolled-up surfaces:
//   • KPI strip   — totals (active + archived)
//   • Top tags    — usage rank with last-30d delta + resolved count
//   • Trend bars  — daily applications over the last 30 days
//   • Per-category — which tags dominate each ticket category
//
// Everything is computed server-side; this view is pure render.
export default function TagAnalyticsPanel() {
  const tr = useTranslations("supportDashboard.tagAnalytics");
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supportApi
      .getTagAnalytics()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || tr("loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="text-xs text-[#DC2626] py-6 text-center">{error}</div>
    );
  }

  if (data === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const maxTrend = data.trend.reduce(
    (a, b) => Math.max(a, b.count),
    0,
  );

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KpiCard
          label={tr("totalTags")}
          value={data.totalTags}
          icon={<TagIcon className="w-3.5 h-3.5" />}
        />
        <KpiCard
          label={tr("active")}
          value={data.totalTags - data.archivedTags}
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          accent="text-[var(--color-primary)]"
        />
        <KpiCard
          label={tr("archived")}
          value={data.archivedTags}
          icon={<Archive className="w-3.5 h-3.5" />}
          accent="text-[#92400E]"
        />
      </div>

      {/* Top tags */}
      <section>
        <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-2 uppercase">
          {tr("topTags")}
        </h4>
        {data.topTags.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
            {tr("noActivity")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {data.topTags.map((tag) => (
              <div
                key={tag.tagId}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border-subtle)]"
              >
                <span
                  className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full"
                  style={{
                    backgroundColor: tag.color,
                    color: textForBg(tag.color),
                  }}
                >
                  {tag.name}
                </span>
                {tag.archived && (
                  <span className="text-[10px] uppercase text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] px-1.5 py-0.5 rounded">
                    {tr("archivedBadge")}
                  </span>
                )}
                <span className="text-xs text-[var(--color-text-secondary)] ms-auto flex items-center gap-3">
                  <span title={tr("stats.totalAssignmentsTitle")}>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {tag.usageCount}
                    </span>{" "}
                    {tr("stats.total")}
                  </span>
                  <span title={tr("stats.last30DaysTitle")}>
                    <span
                      className={`font-semibold ${
                        tag.last30Count > 0
                          ? "text-[var(--color-primary)]"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {tag.last30Count}
                    </span>{" "}
                    {tr("stats.in30d")}
                  </span>
                  <span title={tr("stats.resolvedTitle")}>
                    <span className="font-semibold text-[#16A34A]">
                      {tag.resolvedCount}
                    </span>{" "}
                    {tr("stats.resolved")}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 30-day trend */}
      <section>
        <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-2 uppercase flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          {tr("trendTitle")}
        </h4>
        {data.trend.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
            {tr("trendEmpty")}
          </p>
        ) : (
          <div className="px-3 py-3 rounded-xl border border-[var(--color-border)] bg-white">
            {/* h-full on the per-day column is critical — without it the
                column collapses to 0px and the bar's % height resolves
                to 0, giving an empty chart. */}
            <div className="flex items-end gap-1 h-40">
              {data.trend.map((d) => {
                const ratio = maxTrend > 0 ? d.count / maxTrend : 0;
                return (
                  <div
                    key={d.day}
                    className="flex-1 h-full flex flex-col items-center justify-end gap-1 group relative"
                    title={`${d.day} — ${d.count}`}
                  >
                    <div
                      className="w-full rounded-t-md bg-[var(--color-primary)]/70 group-hover:bg-[var(--color-primary)] transition-colors min-h-[2px]"
                      style={{
                        height: `${Math.max(4, ratio * 100)}%`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center text-[10px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
              <span>{data.trend[0]?.day || ""}</span>
              <span className="font-medium">
                {maxTrend > 0 && tr("peakPerDay", { value: maxTrend })}
              </span>
              <span>{data.trend[data.trend.length - 1]?.day || ""}</span>
            </div>
          </div>
        )}
      </section>

      {/* By category */}
      <section>
        <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-2 uppercase">
          {tr("byCategoryTitle")}
        </h4>
        {data.byCategory.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
            {tr("byCategoryEmpty")}
          </p>
        ) : (
          <div className="space-y-2">
            {data.byCategory.map((row) => (
              <div
                key={row.category}
                className="px-3 py-2 rounded-lg border border-[var(--color-border-subtle)]"
              >
                <div className="text-[11px] uppercase font-medium text-[var(--color-text-secondary)] mb-1.5">
                  {translateCategory(tr, row.category)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {row.tags.map((tag) => (
                    <span
                      key={tag.tagId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full"
                      style={{
                        backgroundColor: tag.color,
                        color: textForBg(tag.color),
                      }}
                    >
                      {tag.name}
                      <span className="opacity-70">· {tag.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// Translate a category slug via the reportsPage.categories dictionary.
// Falls back to the raw slug if no entry exists.
function translateCategory(
  translator: ReturnType<typeof useTranslations>,
  category: string | null | undefined,
): string {
  if (!category) return "—";
  const key = `categories.${category.toLowerCase()}`;
  try {
    const val = translator(key);
    if (val && val !== key) return val;
  } catch {
    // ignore missing keys
  }
  return category;
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="px-4 py-3 rounded-xl border border-[var(--color-border)] bg-white">
      <div className="text-[10px] uppercase font-semibold tracking-wide text-[var(--color-text-secondary)] flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div
        className={`text-2xl font-semibold mt-1.5 ${
          accent || "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
