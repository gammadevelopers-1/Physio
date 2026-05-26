"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Award, ArrowRight } from "lucide-react";

interface PointRow {
  id: string;
  userId: string;
  userName: string;
  delta: number;
  reason: string;
  awardedAt: string;
}

interface Props {
  rows: PointRow[];
}

function formatRelative(iso: string, locale: string): string {
  try {
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return locale === "ar" ? "الآن" : "just now";
    if (diffMin < 60) return locale === "ar" ? `قبل ${diffMin} د` : `${diffMin}m ago`;
    const hr = Math.floor(diffMin / 60);
    if (hr < 24) return locale === "ar" ? `قبل ${hr} س` : `${hr}h ago`;
    return locale === "ar"
      ? `قبل ${Math.floor(hr / 24)} ي`
      : `${Math.floor(hr / 24)}d ago`;
  } catch {
    return iso;
  }
}

function humanizeReason(reason: string): string {
  return reason
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RecentPointsWidget({ rows }: Props) {
  const t = useTranslations("adminDashboard.recentPoints");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/admin/points`}
          className="text-sm text-[#0066FF] hover:underline inline-flex items-center gap-1"
        >
          {t("viewAll")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map((row) => {
            const positive = row.delta > 0;
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {row.userName}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">
                    {humanizeReason(row.reason)} ·{" "}
                    {formatRelative(row.awardedAt, locale)}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold flex-shrink-0 ${
                    positive ? "text-[#16A34A]" : "text-[#DC2626]"
                  }`}
                >
                  {positive ? "+" : ""}
                  {row.delta}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
