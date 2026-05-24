"use client";

/**
 * Single-select dropdown with an inline search box. Used by the admin
 * Courses page to filter by Instructor and Manager when the lists may
 * grow to many dozens of entries. Headless — no portal, closes on
 * outside-click and Escape.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X, Check, Search as SearchIcon } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  /** Optional secondary line (e.g. email under name) */
  hint?: string | null;
}

interface Props {
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  /** Shown above the option list when the search yields nothing. */
  emptyLabel: string;
  /** Shown when value is set, as the clear-icon a11y label. */
  clearLabel: string;
  /** Optional fixed width — defaults to full container width. */
  className?: string;
  /** Disable interaction (used while the option list is still loading). */
  disabled?: boolean;
}

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
  className = "",
  disabled = false,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = value ? options.find((o) => o.value === value) ?? null : null;

  // Close on outside click
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

  // Close on Escape
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

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.hint ? o.hint.toLowerCase().includes(q) : false)
        );
      })
    : options;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery("");
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className="w-full h-10 px-3 pr-9 flex items-center justify-between border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] hover:border-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selectedOption ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        {selectedOption ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={clearLabel}
            onClick={handleClear}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(null);
                setQuery("");
              }
            }}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[var(--color-border-subtle)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
          </span>
        ) : (
          <ChevronDown className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none" />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border-subtle)]">
            <div className="relative">
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
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-center text-[var(--color-text-secondary)]">
                {emptyLabel}
              </li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={`w-full px-3 py-2 flex items-start justify-between gap-2 text-left text-sm hover:bg-[var(--color-border-subtle)] transition-colors ${
                        isSelected ? "bg-[var(--color-border-subtle)]" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[var(--color-text-primary)]">
                          {option.label}
                        </div>
                        {option.hint && (
                          <div className="truncate text-xs text-[var(--color-text-secondary)] mt-0.5">
                            {option.hint}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                      )}
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

export default SearchableSelect;
