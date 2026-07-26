"use client";

/**
 * Dumb controlled multi-select with inline search + selected-chip
 * summary. Modeled after [[SearchableSelect]] but multi-valued; the
 * consumer owns the `value` state (`string[]`).
 *
 * Headless — no portal, closes on outside-click / Escape. RTL-safe via
 * `start-` / `end-` logical Tailwind classes.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, X, Search as SearchIcon } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Secondary line (e.g. price badge, delivery type, start date). */
  hint?: string | null;
}

interface Props {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyLabel: string;
  clearAllLabel: string;
  /** Rendered above the counter when the pool is empty. */
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Optional cap on how many chips render inline; the rest collapse to "+N". */
  chipLimit?: number;
}

const MultiSelect = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  clearAllLabel,
  loadingLabel,
  loading = false,
  disabled = false,
  className = "",
  chipLimit = 3,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const optionMap = useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ? o.hint.toLowerCase().includes(q) : false),
    );
  }, [options, query]);

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const removeOne = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== val));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Render selected chips (with an overflow "+N" pill for large sets)
  const chipsToShow = value.slice(0, chipLimit);
  const overflow = value.length - chipsToShow.length;

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className="w-full min-h-10 px-3 pe-9 flex items-center flex-wrap gap-1.5 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] hover:border-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-1.5"
      >
        {value.length === 0 ? (
          <span className="text-[var(--color-text-secondary)]">
            {loading && loadingLabel ? loadingLabel : placeholder}
          </span>
        ) : (
          <>
            {chipsToShow.map((v) => {
              const opt = optionMap.get(v);
              const label = opt?.label ?? v;
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs font-medium"
                >
                  <span className="max-w-[140px] truncate">{label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => removeOne(v, e)}
                    className="hover:bg-[var(--color-primary)]/20 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </span>
                </span>
              );
            })}
            {overflow > 0 && (
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                +{overflow}
              </span>
            )}
          </>
        )}
        <ChevronDown
          className={`absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-9 ps-9 pe-2 text-sm bg-[var(--color-surface-page)] border border-[var(--color-input-border)] rounded-md focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            {value.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="px-2 h-9 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded"
              >
                {clearAllLabel}
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-[var(--color-text-secondary)]">
                {emptyLabel}
              </li>
            ) : (
              filtered.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => toggle(option.value)}
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full px-3 py-2 flex items-start justify-between gap-2 text-start text-sm hover:bg-[var(--color-border-subtle)] transition-colors ${
                        isSelected ? "bg-[var(--color-border-subtle)]" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex items-start gap-2">
                        <span
                          className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                              : "bg-white border-[var(--color-input-border)]"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[var(--color-text-primary)]">
                            {option.label}
                          </div>
                          {option.hint && (
                            <div className="truncate text-xs text-[var(--color-text-secondary)] mt-0.5">
                              {option.hint}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
