"use client";

import { Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import {
  useSupportOnlineStatus,
  type BusinessHoursConfig,
} from "@/hooks/useSupportOnlineStatus";

export type { BusinessHoursConfig } from "@/hooks/useSupportOnlineStatus";
export { DEFAULT_BUSINESS_HOURS } from "@/hooks/useSupportOnlineStatus";

export default function BusinessHoursIndicator({
  config: overrideConfig,
}: {
  /** Override the fetched config — used by tests / Storybook. */
  config?: BusinessHoursConfig;
} = {}) {
  const t = useTranslations("supportPublicPage");
  const locale = useLocale();
  const { isOnline, config } = useSupportOnlineStatus(overrideConfig);

  if (isOnline === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Clock className="w-4 h-4" />
        <span>{t("businessHoursSchedule")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            isOnline ? "bg-green-500 animate-pulse" : "bg-gray-400"
          }`}
        />
        <span
          className={`text-sm font-semibold ${
            isOnline ? "text-green-600" : "text-gray-500"
          }`}
        >
          {isOnline ? t("statusOnline") : t("statusOffline")}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="w-4 h-4" />
        <span>{config ? formatSchedule(config, locale) : t("businessHoursSchedule")}</span>
      </div>
      {!isOnline && (
        <p className="text-sm text-gray-500 mt-1">{t("offlineMessage")}</p>
      )}
    </div>
  );
}

function formatSchedule(config: BusinessHoursConfig, locale: string): string {
  const isAr = locale === "ar";
  const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const names = isAr ? dayNamesAr : dayNamesEn;
  const sorted = [...config.businessDays].sort((a, b) => a - b);
  const dayLabel = sorted.length === 0
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
