"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";

interface Props {
  /** "HH:mm" 24-hour string (e.g. "14:30"). Empty = unset. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Custom 12-hour time picker — replaces the browser-native `<input type="time">`
 * which renders inconsistently across Chrome / Firefox / Safari and clashes
 * visually with the rest of the design system.
 *
 * Internally stores 24-hour "HH:mm" strings (matches `<input type="time">`
 * for drop-in replacement), but the picker UI uses 12-hour + AM/PM.
 *
 * Three vertically-scrollable columns: hours (01–12), minutes (00–55 in
 * 5-min increments), AM/PM. Clicking a value commits immediately.
 */
export default function TimePicker({
  value,
  onChange,
  disabled,
  className = "",
  placeholder,
}: Props) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Popover viewport coords — position:fixed so the popover escapes any
  // parent overflow (dialogs, drawers) and flips edges when there's not
  // enough room on the natural side.
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Parse current value into hour12, minute, meridiem
  const { hour12, minute, meridiem } = useMemo(() => {
    if (!value) return { hour12: 12, minute: 0, meridiem: "PM" as "AM" | "PM" };
    const [hStr, mStr] = value.split(":");
    const h24 = Number(hStr) || 0;
    const m = Number(mStr) || 0;
    const mer: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { hour12: h12, minute: m, meridiem: mer };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Compute popover coords whenever open changes, plus on scroll/resize.
  useEffect(() => {
    if (!open) {
      setPopoverPos(null);
      return;
    }
    const POPOVER_W = 220;
    const POPOVER_H_APPROX = 240;
    const MARGIN = 8;
    const compute = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let top = rect.bottom + 4;
      if (top + POPOVER_H_APPROX > window.innerHeight - MARGIN) {
        top = Math.max(MARGIN, rect.top - POPOVER_H_APPROX - 4);
      }
      let left: number;
      if (isRTL) {
        left = rect.right - POPOVER_W;
        if (left < MARGIN) left = Math.min(rect.left, window.innerWidth - POPOVER_W - MARGIN);
      } else {
        left = rect.left;
        if (left + POPOVER_W > window.innerWidth - MARGIN) {
          left = Math.max(MARGIN, rect.right - POPOVER_W);
        }
      }
      setPopoverPos({ top, left });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, isRTL]);

  const commit = (h12: number, m: number, mer: "AM" | "PM") => {
    let h24 = h12 % 12;
    if (mer === "PM") h24 += 12;
    const v = `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onChange(v);
  };

  // Display label — 12h with AM/PM
  const displayLabel = (() => {
    if (!value) return placeholder || (isRTL ? "اختر الوقت" : "Select time");
    return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${meridiem}`;
  })();

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm bg-white hover:border-[var(--color-text-secondary)] transition-colors ${
          disabled ? "opacity-60 cursor-not-allowed bg-[var(--color-surface-page)]" : "cursor-pointer"
        } ${open ? "ring-2 ring-[#3B82F6] border-[#3B82F6]" : ""}`}
      >
        <Clock className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        <span
          className={`flex-1 text-start ${
            value ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {displayLabel}
        </span>
      </button>

      {open && popoverPos && (
        <div
          style={{ position: "fixed", top: popoverPos.top, left: popoverPos.left }}
          className="z-[100] bg-white border border-[var(--color-input-border)] rounded-xl shadow-lg w-[220px] max-w-[calc(100vw-1rem)]"
        >
          <div className="flex divide-x divide-[var(--color-border)]" dir="ltr">
            <ScrollColumn
              values={Array.from({ length: 12 }, (_, i) => i + 1)}
              selected={hour12}
              format={(n) => String(n).padStart(2, "0")}
              onPick={(n) => commit(n, minute, meridiem)}
              ariaLabel="Hour"
            />
            <ScrollColumn
              values={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
              selected={minute}
              format={(n) => String(n).padStart(2, "0")}
              onPick={(n) => commit(hour12, n, meridiem)}
              ariaLabel="Minute"
            />
            <ScrollColumn
              values={["AM", "PM"] as const}
              selected={meridiem}
              format={(v) => v}
              onPick={(v) => commit(hour12, minute, v as "AM" | "PM")}
              ariaLabel="Meridiem"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface ScrollColumnProps<T> {
  values: readonly T[];
  selected: T;
  format: (v: T) => string;
  onPick: (v: T) => void;
  ariaLabel: string;
}

function ScrollColumn<T>({ values, selected, format, onPick, ariaLabel }: ScrollColumnProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected into view on open
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLButtonElement>('button[data-selected="true"]');
    el?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  }, []);

  return (
    <div ref={listRef} className="flex-1 max-h-56 overflow-y-auto py-1" aria-label={ariaLabel}>
      {values.map((v) => {
        const isSel = v === selected;
        return (
          <button
            key={String(v)}
            type="button"
            data-selected={isSel || undefined}
            onClick={() => onPick(v)}
            className={`w-full text-center px-2 py-1.5 text-sm font-mono ${
              isSel
                ? "bg-[#EFF6FF] text-[#1D4ED8] font-bold"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
            }`}
          >
            {format(v)}
          </button>
        );
      })}
    </div>
  );
}
