"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";

interface DateRange {
  startDate?: string;
  endDate?: string;
  label: string;
}

interface DateRangeFilterProps {
  onChange: (range: DateRange) => void;
  defaultPreset?: string;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildPresetRange(key: string): DateRange {
  const today = new Date();
  const todayStr = toIsoDate(today);

  switch (key) {
    case "today":
      return { label: "today", startDate: todayStr, endDate: todayStr };
    case "7d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { label: "7d", startDate: toIsoDate(start), endDate: todayStr };
    }
    case "30d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { label: "30d", startDate: toIsoDate(start), endDate: todayStr };
    }
    case "3m": {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { label: "3m", startDate: toIsoDate(start), endDate: todayStr };
    }
    case "1y": {
      const start = new Date(today);
      start.setDate(start.getDate() - 364);
      return { label: "1y", startDate: toIsoDate(start), endDate: todayStr };
    }
    default:
      return { label: key };
  }
}

const DateRangeFilter = ({
  onChange,
  defaultPreset = "30d",
}: DateRangeFilterProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [activePreset, setActivePreset] = useState(defaultPreset);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const presets = [
    { key: "today", label: t("dateFilter.today") },
    { key: "7d", label: t("dateFilter.7d") },
    { key: "30d", label: t("dateFilter.30d") },
    { key: "3m", label: t("dateFilter.3m") },
    { key: "1y", label: t("dateFilter.1y") },
    { key: "custom", label: t("dateFilter.custom") },
  ];

  const handlePreset = (key: string) => {
    setActivePreset(key);
    if (key !== "custom") {
      onChange(buildPresetRange(key));
    }
  };

  const handleCustomChange = (start: string, end: string) => {
    if (start && end) {
      onChange({ label: "custom", startDate: start, endDate: end });
    }
  };

  return (
    <div className={`flex flex-col items-end gap-2 ${isRTL ? "items-start" : "items-end"}`}>
      {/* Pill group row — fixed width regardless of custom-open state */}
      <div
        className={`inline-flex items-center bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-1 shadow-sm ${isRTL ? "flex-row-reverse" : ""}`}
      >
        <div className="flex items-center gap-0.5">
          {presets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handlePreset(preset.key)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap leading-none min-w-[36px] ${
                activePreset === preset.key
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date inputs — stacked BELOW the pill group on its own row
          so opening Custom never widens the header. */}
      {activePreset === "custom" && (
        <div
          className={`inline-flex items-center gap-1.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg px-2 py-1 shadow-sm ${isRTL ? "flex-row-reverse" : ""}`}
        >
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => {
              setCustomStart(e.target.value);
              handleCustomChange(e.target.value, customEnd);
            }}
            className="px-1.5 py-0.5 text-xs border-0 rounded-md focus:outline-none text-[var(--color-text-primary)] bg-transparent w-[120px]"
            dir="ltr"
            aria-label={t("dateFilter.startDate")}
          />
          <span className="text-xs text-[var(--color-text-secondary)]">–</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              handleCustomChange(customStart, e.target.value);
            }}
            className="px-1.5 py-0.5 text-xs border-0 rounded-md focus:outline-none text-[var(--color-text-primary)] bg-transparent w-[120px]"
            dir="ltr"
            aria-label={t("dateFilter.endDate")}
          />
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
