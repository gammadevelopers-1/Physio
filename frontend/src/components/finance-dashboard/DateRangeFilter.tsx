"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar } from "lucide-react";

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
    default:
      return { label: key };
  }
}

const DateRangeFilter = ({
  onChange,
  defaultPreset = "30d",
}: DateRangeFilterProps) => {
  const t = useTranslations("financeDashboard");
  const [activePreset, setActivePreset] = useState(defaultPreset);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const presets = [
    { key: "today", label: t("dateFilter.today") },
    { key: "7d", label: t("dateFilter.7d") },
    { key: "30d", label: t("dateFilter.30d") },
    { key: "3m", label: t("dateFilter.3m") },
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
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
      <div className="flex bg-[#F3F4F6] rounded-lg p-0.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            onClick={() => handlePreset(preset.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activePreset === preset.key
                ? "bg-[#a37f49] text-white shadow-sm"
                : "text-[#6B7280] hover:text-[#374151]"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {activePreset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => {
              setCustomStart(e.target.value);
              handleCustomChange(e.target.value, customEnd);
            }}
            className="px-2 py-1 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#a37f49] text-[#374151]"
          />
          <span className="text-xs text-[#6B7280]">–</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              handleCustomChange(customStart, e.target.value);
            }}
            className="px-2 py-1 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#a37f49] text-[#374151]"
          />
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
