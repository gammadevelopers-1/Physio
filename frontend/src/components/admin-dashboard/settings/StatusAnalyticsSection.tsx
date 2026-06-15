"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { serviceStatusApi, type StatusAnalytics } from "@/lib/api";

/**
 * Admin Analytics section — sits inside the Service Status tab.
 * Date-range chip filter, summary cards, monthly trend, top
 * components, and CSV/PDF export buttons.
 */

const PRESETS: { key: string; label: string; days: number }[] = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "180", label: "Last 6 months", days: 180 },
  { key: "365", label: "Last 12 months", days: 365 },
];

function fmtMinutes(min: number): string {
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const hours = min / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function StatusAnalyticsSection() {
  const [presetKey, setPresetKey] = useState("30");
  const [data, setData] = useState<StatusAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fromDate = useMemo(() => {
    const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
    const d = new Date();
    d.setDate(d.getDate() - preset.days);
    return d.toISOString();
  }, [presetKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    serviceStatusApi
      .getAnalytics({ from: fromDate })
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
  }, [fromDate]);

  const handleExportCsv = () => {
    try {
      const url = serviceStatusApi.exportIncidentsCsvUrl({ from: fromDate });
      window.open(url, "_blank");
    } catch {
      toast.error("Couldn't start export");
    }
  };

  const handleExportPdf = () => {
    if (!data) return;
    exportAnalyticsPdf(data);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EDE9FE] flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-[#6D28D9]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Analytics
            </h3>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Status page views, incident trends, and export.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPresetKey(p.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                presetKey === p.key
                  ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                  : "bg-white border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-8 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading…
        </div>
      ) : !data ? (
        <div className="text-center py-8 text-sm text-[var(--color-text-secondary)] border border-dashed border-[var(--color-border)] rounded-lg">
          Couldn't load analytics.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Eye}
              iconBg="bg-[#DBEAFE]"
              iconColor="text-[#1D4ED8]"
              label="Page views"
              value={fmtNumber(data.views.total)}
              sub={`${fmtNumber(data.views.uniqueSessions)} unique sessions`}
            />
            <StatCard
              icon={Users}
              iconBg="bg-[#FEE2E2]"
              iconColor="text-[#DC2626]"
              label="Affected users"
              value={fmtNumber(data.affectedUsersTotal)}
              sub="across resolved incidents"
            />
            <StatCard
              icon={Clock}
              iconBg="bg-[#FFFBEB]"
              iconColor="text-[#D97706]"
              label="Avg resolution"
              value={fmtMinutes(data.resolutionMinutes.avg)}
              sub={`Median: ${fmtMinutes(data.resolutionMinutes.median)}`}
            />
            <StatCard
              icon={TrendingUp}
              iconBg="bg-[#DCFCE7]"
              iconColor="text-[#16A34A]"
              label="Total incidents"
              value={fmtNumber(data.incidents.total)}
              sub={`${data.incidents.resolved} resolved`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Trend chart */}
            <div className="lg:col-span-2 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4">
              <h4 className="text-xs uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] mb-3">
                Incidents by month
              </h4>
              {data.monthlyTrend.length === 0 ? (
                <div className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
                  No incidents in this range.
                </div>
              ) : (
                <TrendBars trend={data.monthlyTrend} />
              )}
            </div>

            {/* Top components */}
            <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4">
              <h4 className="text-xs uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] mb-3">
                Top affected components
              </h4>
              {data.topComponents.length === 0 ? (
                <div className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
                  No data.
                </div>
              ) : (
                <ul className="space-y-2">
                  {data.topComponents.map((c, i) => {
                    const max = data.topComponents[0]?.count ?? 1;
                    const pct = Math.round((c.count / max) * 100);
                    return (
                      <li key={c.component}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[var(--color-text-primary)] font-medium">
                            {c.component}
                          </span>
                          <span className="text-[var(--color-text-secondary)]">
                            {c.count}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--color-primary)] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Export buttons */}
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-[var(--color-text-secondary)]">
              Export the incidents in this range for compliance / reporting.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90"
              >
                <FileText className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 flex items-start gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
      >
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide font-medium text-[var(--color-text-secondary)]">
          {label}
        </p>
        <p className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function TrendBars({
  trend,
}: {
  trend: { month: string; minor: number; major: number; critical: number; total: number }[];
}) {
  const maxTotal = Math.max(1, ...trend.map((t) => t.total));
  return (
    <div className="flex items-end justify-between gap-2 h-40 px-1">
      {trend.map((t) => {
        const totalPct = (t.total / maxTotal) * 100;
        const critPct = t.total ? (t.critical / t.total) * 100 : 0;
        const majPct = t.total ? (t.major / t.total) * 100 : 0;
        return (
          <div
            key={t.month}
            className="flex-1 flex flex-col items-center justify-end h-full"
          >
            <div className="w-full max-w-[28px] flex flex-col items-stretch h-full justify-end">
              <div
                className="w-full rounded-t flex flex-col-reverse overflow-hidden"
                style={{ height: `${totalPct}%` }}
                title={`${t.month}: ${t.total} incidents (critical ${t.critical}, major ${t.major}, minor ${t.minor})`}
              >
                {t.minor > 0 && (
                  <div
                    className="bg-[#BFDBFE]"
                    style={{ height: `${100 - critPct - majPct}%` }}
                  />
                )}
                {t.major > 0 && (
                  <div
                    className="bg-[#FCD34D]"
                    style={{ height: `${majPct}%` }}
                  />
                )}
                {t.critical > 0 && (
                  <div
                    className="bg-[#DC2626]"
                    style={{ height: `${critPct}%` }}
                  />
                )}
              </div>
            </div>
            <p className="text-[9px] text-[var(--color-text-secondary)] mt-1">
              {t.month.slice(5)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function exportAnalyticsPdf(data: StatusAnalytics) {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Allow pop-ups to export PDF");
    return;
  }
  const r = data.range;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US");
  const monthRows = data.monthlyTrend
    .map(
      (m) =>
        `<tr><td>${m.month}</td><td>${m.total}</td><td>${m.critical}</td><td>${m.major}</td><td>${m.minor}</td></tr>`,
    )
    .join("");
  const compRows = data.topComponents
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.component)}</td><td>${c.count}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Status analytics — ${fmt(r.from)} to ${fmt(r.to)}</title>
<style>body{font-family:'DM Sans',Arial,sans-serif;color:#1a1a1a;padding:32px;line-height:1.5;}h1{margin:0 0 4px;font-size:22px;}h2{font-size:13px;margin-top:24px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;}td,th{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;}.meta div{border:1px solid #e5e7eb;border-radius:8px;padding:8px;}.label{font-size:10px;text-transform:uppercase;color:#6b7280;}.val{font-weight:700;font-size:18px;}</style></head>
<body>
<h1>Status analytics report</h1>
<p style="color:#6b7280;margin:0;">${fmt(r.from)} – ${fmt(r.to)}</p>
<div class="meta">
<div><div class="label">Page views</div><div class="val">${data.views.total}</div><div style="font-size:10px;color:#6b7280;">${data.views.uniqueSessions} unique sessions</div></div>
<div><div class="label">Affected users</div><div class="val">${data.affectedUsersTotal}</div></div>
<div><div class="label">Avg resolution</div><div class="val">${data.resolutionMinutes.avg} min</div><div style="font-size:10px;color:#6b7280;">Median: ${data.resolutionMinutes.median} min</div></div>
<div><div class="label">Total incidents</div><div class="val">${data.incidents.total}</div><div style="font-size:10px;color:#6b7280;">${data.incidents.resolved} resolved</div></div>
</div>
<h2>By severity</h2>
<table><tr><th>Critical</th><th>Major</th><th>Minor</th></tr><tr><td>${data.incidents.bySeverity.critical}</td><td>${data.incidents.bySeverity.major}</td><td>${data.incidents.bySeverity.minor}</td></tr></table>
<h2>Monthly trend</h2>
<table><thead><tr><th>Month</th><th>Total</th><th>Critical</th><th>Major</th><th>Minor</th></tr></thead><tbody>${monthRows || '<tr><td colspan="5" style="text-align:center;color:#6b7280;">No data</td></tr>'}</tbody></table>
<h2>Top affected components</h2>
<table><thead><tr><th>Component</th><th>Incidents</th></tr></thead><tbody>${compRows || '<tr><td colspan="2" style="text-align:center;color:#6b7280;">No data</td></tr>'}</tbody></table>
<script>window.onload=()=>setTimeout(()=>window.print(),200);</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
