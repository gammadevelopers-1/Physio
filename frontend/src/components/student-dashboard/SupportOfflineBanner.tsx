"use client";

import { Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import {
  useSupportOnlineStatus,
  type BusinessHoursConfig,
} from "@/hooks/useSupportOnlineStatus";

/**
 * Mirror of the public support page's "Currently Offline" banner, scoped
 * to the student dashboard. Renders nothing when support is online or
 * the business-hours config is still loading.
 *
 * Wording matches the public page so a student who reads both sees
 * consistent information.
 */
export default function SupportOfflineBanner() {
  const t = useTranslations("supportPublicPage");
  const locale = useLocale();
  const { isOnline, config } = useSupportOnlineStatus();

  if (isOnline === null || isOnline) return null;

  return (
    <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
        <span className="text-sm font-semibold text-gray-600">
          {t("statusOffline")}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Clock className="w-4 h-4" />
        <span>
          {config ? formatSchedule(config, locale) : t("businessHoursSchedule")}
        </span>
      </div>
      <p className="text-sm text-gray-500">{t("offlineMessage")}</p>
    </div>
  );
}

function formatSchedule(config: BusinessHoursConfig, locale: string): string {
  const isAr = locale === "ar";
  const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesAr = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  const names = isAr ? dayNamesAr : dayNamesEn;
  const sorted = [...config.businessDays].sort((a, b) => a - b);
  const dayLabel =
    sorted.length === 0
      ? ""
      : isContiguous(sorted)
        ? `${names[sorted[0]]} – ${names[sorted[sorted.length - 1]]}`
        : sorted.map((d) => names[d]).join(", ");
  const openLabel = format12h(config.startHour, isAr);
  const closeLabel = format12h(config.endHour, isAr);
  const tzLabel = isAr ? "بتوقيت الرياض" : "Saudi Riyadh time";
  return `${dayLabel}, ${openLabel} – ${closeLabel} (${tzLabel})`;
}

function isContiguous(sorted: number[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== 1) return false;
  }
  return sorted.length >= 1;
}

function format12h(hour24: number, isAr: boolean): string {
  const h = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? (isAr ? "ص" : "AM") : (isAr ? "م" : "PM");
  return `${h}:00 ${suffix}`;
}
