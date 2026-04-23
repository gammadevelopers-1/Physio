"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, MapPin } from "lucide-react";
import { SAUDI_CITIES } from "@/lib/saudi-cities";
import { useLocale } from "next-intl";

interface CitySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CitySelect({
  value,
  onChange,
  placeholder,
  disabled,
  className = "",
}: CitySelectProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = SAUDI_CITIES.filter((city) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      city.labelEn.toLowerCase().includes(q) ||
      city.labelAr.includes(search) ||
      city.value.toLowerCase().includes(q)
    );
  });

  const selected = SAUDI_CITIES.find((c) => c.value === value);
  const displayLabel = selected
    ? (isRTL ? selected.labelAr : selected.labelEn)
    : (placeholder || (isRTL ? "اختر المدينة" : "Select city"));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-white hover:border-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] disabled:opacity-50 disabled:cursor-not-allowed ${
          !value ? "text-[#9CA3AF]" : "text-[#1F2937]"
        } ${isRTL ? "flex-row-reverse" : ""}`}
      >
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <MapPin className="w-4 h-4 text-[#6B7280]" />
          <span>{displayLabel}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-50 max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-2" : "left-2"}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isRTL ? "بحث..." : "Search..."}
                autoFocus
                className={`w-full px-8 py-1.5 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:ring-1 focus:ring-[#3B82F6] ${
                  isRTL ? "text-right" : "text-left"
                }`}
                dir={isRTL ? "rtl" : "ltr"}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-[#9CA3AF] text-center">
                {isRTL ? "لا توجد نتائج" : "No results"}
              </div>
            ) : (
              filtered.map((city) => (
                <button
                  key={city.value}
                  type="button"
                  onClick={() => {
                    onChange(city.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full px-3 py-2 text-sm hover:bg-[#F3F4F6] transition-colors ${
                    value === city.value ? "bg-[#EFF6FF] text-[#1D4ED8]" : "text-[#1F2937]"
                  } ${isRTL ? "text-right" : "text-left"}`}
                >
                  {isRTL ? city.labelAr : city.labelEn}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
