"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BarChart3, PieChart as PieIcon, Layers } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { financeApi } from "@/lib/api";
import { CHART_PALETTE, FINANCE_COLORS } from "./shared/financeColors";
import { ChartSkeleton } from "./shared/Skeleton";

type Tab = "status" | "topCourses" | "delivery";

interface FinanceAnalyticsWidgetProps {
  dateRange: { startDate?: string; endDate?: string };
}

const STATUS_COLOR_MAP: Record<string, string> = {
  paid: FINANCE_COLORS.success.hex,
  pending: FINANCE_COLORS.warning.hex,
  awaiting_approval: FINANCE_COLORS.info.hex,
  failed: FINANCE_COLORS.error.hex,
  refunded: FINANCE_COLORS.violet.hex,
  partially_refunded: "#A78BFA",
  chargeback: FINANCE_COLORS.slate.hex,
  processing: "#94A3B8",
};

const FinanceAnalyticsWidget = ({ dateRange }: FinanceAnalyticsWidgetProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [activeTab, setActiveTab] = useState<Tab>("status");

  const [statusData, setStatusData] = useState<{ status: string; count: number; totalAmount: number }[]>([]);
  const [topCoursesData, setTopCoursesData] = useState<{ title: string; revenue: number }[]>([]);
  const [deliveryData, setDeliveryData] = useState<{ deliveryType: string; revenue: number; netRevenue: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, topRes, deliveryRes] = await Promise.allSettled([
        financeApi.getPaymentStatus(dateRange),
        financeApi.getTopCourses({ limit: 6, ...dateRange }),
        financeApi.getRevenueByDeliveryType(dateRange),
      ]);
      if (statusRes.status === "fulfilled") setStatusData(statusRes.value || []);
      if (topRes.status === "fulfilled") {
        setTopCoursesData(
          (topRes.value || []).map((c: { title: string; titleAr?: string | null; revenue: number }) => ({
            title: locale === "ar" && c.titleAr ? c.titleAr : c.title,
            revenue: Number(c.revenue) || 0,
          })),
        );
      }
      if (deliveryRes.status === "fulfilled") setDeliveryData(deliveryRes.value || []);
    } finally {
      setLoading(false);
    }
  }, [dateRange, locale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "status", label: t("analytics.tabs.status"), icon: PieIcon },
    { key: "topCourses", label: t("analytics.tabs.topCourses"), icon: BarChart3 },
    { key: "delivery", label: t("analytics.tabs.delivery"), icon: Layers },
  ];

  const statusChartData = useMemo(
    () =>
      statusData
        .filter((s) => s.count > 0)
        .map((s) => ({
          name: t(`status.${s.status === "partially_refunded" ? "partiallyRefunded" : s.status === "awaiting_approval" ? "awaitingApproval" : s.status}`),
          value: s.totalAmount,
          count: s.count,
          color: STATUS_COLOR_MAP[s.status] || "#94A3B8",
        })),
    [statusData, t],
  );

  const deliveryChartData = useMemo(
    () =>
      deliveryData.map((d) => {
        const key = `analytics.delivery.${d.deliveryType || "unknown"}`;
        const translated = t(key);
        return {
          name: translated === key ? (d.deliveryType || t("analytics.delivery.unknown")) : translated,
          revenue: d.revenue,
          net: d.netRevenue,
        };
      }),
    [deliveryData, t],
  );

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
      <div className={`px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-3 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("analytics.title")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("analytics.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex bg-[var(--color-surface-page)] rounded-lg p-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.key
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {loading ? (
          <ChartSkeleton height={300} />
        ) : (
          <>
            {activeTab === "status" && (
              <div className="h-[300px]">
                {statusChartData.length === 0 ? (
                  <EmptyState label={t("analytics.empty")} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {statusChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                          padding: "8px 12px",
                        }}
                        formatter={
                          ((value: number, _name: unknown, item: { payload?: { count?: number; name?: string } }) => [
                            `${Number(value).toLocaleString()} ${t("kpi.sar")} · ${item?.payload?.count ?? 0} ${t("analytics.txn")}`,
                            item?.payload?.name,
                          ]) as never
                        }
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {activeTab === "topCourses" && (
              <div className="h-[300px]">
                {topCoursesData.length === 0 ? (
                  <EmptyState label={t("analytics.empty")} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topCoursesData}
                      layout="vertical"
                      margin={{ top: 5, right: 24, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#737373" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => {
                          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                          return v.toString();
                        }}
                      />
                      <YAxis
                        type="category"
                        dataKey="title"
                        tick={{ fontSize: 11, fill: "#525252" }}
                        axisLine={false}
                        tickLine={false}
                        width={130}
                        tickFormatter={(v: string) => (v?.length > 16 ? `${v.slice(0, 16)}…` : v)}
                        orientation={isRTL ? "right" : "left"}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                          padding: "8px 12px",
                        }}
                        formatter={
                          ((value: number) => [
                            `${Number(value).toLocaleString()} ${t("kpi.sar")}`,
                            t("revenueSummary.revenue"),
                          ]) as never
                        }
                      />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                        {topCoursesData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {activeTab === "delivery" && (
              <div className="h-[300px]">
                {deliveryChartData.length === 0 ? (
                  <EmptyState label={t("analytics.empty")} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={deliveryChartData}
                      margin={{ top: 5, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#737373" }}
                        axisLine={false}
                        tickLine={false}
                        reversed={isRTL}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#737373" }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                        tickFormatter={(v) => {
                          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                          return v.toString();
                        }}
                        orientation={isRTL ? "right" : "left"}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                          padding: "8px 12px",
                        }}
                        formatter={
                          ((value: number, name: string) => [
                            `${Number(value).toLocaleString()} ${t("kpi.sar")}`,
                            name === "revenue" ? t("revenueSummary.revenue") : t("kpi.netRevenue"),
                          ]) as never
                        }
                      />
                      <Legend
                        verticalAlign="top"
                        height={28}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12 }}
                        formatter={(value) =>
                          value === "revenue" ? t("revenueSummary.revenue") : t("kpi.netRevenue")
                        }
                      />
                      <Bar dataKey="revenue" fill={FINANCE_COLORS.info.hex} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="net" fill={FINANCE_COLORS.success.hex} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)] text-sm">
    {label}
  </div>
);

export default FinanceAnalyticsWidget;
