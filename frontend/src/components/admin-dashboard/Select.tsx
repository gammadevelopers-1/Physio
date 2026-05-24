"use client";

/**
 * Styled dropdown for the admin dashboard — drop-in replacement for the
 * native `<select>` element. Matches the visual language of
 * [[SearchableSelect]] but without the inline search box (used where
 * the option list is short and well-known, e.g. status / role filters).
 *
 * Headless: no portal, closes on outside-click and Escape.
 * RTL-safe via the Tailwind `start-` / `end-` logical properties.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown when value doesn't match any option. */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** ARIA label for the trigger button (for icon-only contexts). */
  ariaLabel?: string;
  /** Trigger height. "sm" matches FilterBar (h-9); "default" matches form inputs (h-10). */
  size?: "sm" | "default";
}

const Select = ({
  options,
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  ariaLabel,
  size = "default",
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

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
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full ${size === "sm" ? "h-9" : "h-10"} ps-3 pe-9 flex items-center justify-between border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] hover:border-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span
          className={`truncate ${
            selected
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)]"
          }`}
        >
          {selected?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown
          className={`absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-72 overflow-y-auto py-1"
        >
          {options.length === 0 ? (
            <li className="px-3 py-4 text-sm text-center text-[var(--color-text-secondary)]">
              —
            </li>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-start text-sm hover:bg-[var(--color-border-subtle)] transition-colors ${
                      isSelected
                        ? "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-medium"
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span className="truncate flex-1">{option.label}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
                    )}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};

export default Select;
