"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { materialsApi } from "@/lib/api";
import { toast } from "sonner";
import { X, Loader2, Users, TrendingDown } from "lucide-react";

interface RetentionData {
  totalViewers: number;
  bucketSize: number;
  retention: { bucket: number; viewers: number; percent: number }[];
  dropOffPoints: { bucket: number; drop: number }[];
}

interface VideoRetentionChartProps {
  materialId: string;
  materialTitle: string;
  onClose: () => void;
}

export default function VideoRetentionChart({
  materialId,
  materialTitle,
  onClose,
}: VideoRetentionChartProps) {
  const t = useTranslations("instructorDashboard");
  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await materialsApi.getWatchAnalytics(materialId);
        setData(result);
      } catch {
        toast.error(t("analytics.loadError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [materialId, t]);

  const maxPercent = Math.max(...(data?.retention.map((r) => r.percent) ?? [100]), 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("analytics.title")}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] truncate max-w-[400px]">{materialTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
            </div>
          ) : !data || data.totalViewers === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[var(--color-border)] mx-auto mb-4" />
              <p className="text-sm text-[var(--color-text-secondary)]">{t("analytics.noData")}</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="flex gap-4 mb-6">
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-border-subtle)] rounded-lg">
                  <Users className="w-4 h-4 text-[var(--color-primary)]" />
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{data.totalViewers} {t("analytics.viewers")}</span>
                </div>
                {data.dropOffPoints.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#FEF2F2] rounded-lg">
                    <TrendingDown className="w-4 h-4 text-[#EF4444]" />
                    <span className="text-sm font-medium text-[#991B1B]">
                      {data.dropOffPoints.length} {t("analytics.dropOffs")}
                    </span>
                  </div>
                )}
              </div>

              {/* Retention Chart (SVG bars) */}
              <div className="bg-[var(--color-surface-page)] rounded-lg p-4">
                <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">{t("analytics.retentionCurve")}</p>
                <div className="relative h-[200px] flex items-end gap-px">
                  {data.retention.map((r) => {
                    const height = maxPercent > 0 ? (r.percent / maxPercent) * 100 : 0;
                    const isDropOff = data.dropOffPoints.some((d) => d.bucket === r.bucket);
                    return (
                      <div
                        key={r.bucket}
                        className="flex-1 relative group"
                        style={{ height: "100%" }}
                      >
                        <div
                          className={`absolute bottom-0 left-0 right-0 rounded-t transition-colors ${isDropOff ? "bg-[#EF4444]" : "bg-[var(--color-primary)]"} hover:opacity-80`}
                          style={{ height: `${height}%`, minHeight: r.percent > 0 ? "2px" : "0" }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                          <div className="bg-[var(--color-text-primary)] text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            {r.percent}% ({r.viewers} {t("analytics.viewers")})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-[var(--color-text-secondary)]">0s</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatDuration(data.retention.length * data.bucketSize)}
                  </span>
                </div>
              </div>

              {/* Drop-off Points */}
              {data.dropOffPoints.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">{t("analytics.dropOffPoints")}</p>
                  <div className="space-y-2">
                    {data.dropOffPoints.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#FEF2F2] rounded-lg">
                        <span className="text-xs text-[#991B1B]">
                          {t("analytics.atPosition")} {formatDuration(d.bucket * data.bucketSize)}
                        </span>
                        <span className="text-xs font-medium text-[#EF4444]">-{d.drop}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)]">
          <button onClick={onClose} className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]">
            {t("analytics.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m${s > 0 ? ` ${s}s` : ""}`;
}
