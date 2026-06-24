"use client";

import { ReactNode, useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Phone } from "lucide-react";

/**
 * KSA-only mobile-number input.
 *
 * Public API operates on the 9-digit local part (e.g. "512345678"). The
 * locked `+966` prefix is rendered as a non-editable adornment so users
 * can't paste country codes or free-text. Callsites are responsible for
 * normalizing to E.164 (`+966XXXXXXXXX`) before submit and decoding from
 * E.164 on load — use `normalizeSaudiMobile` / `localPartFromStored` from
 * `@/lib/saudi-phone`.
 *
 * Validation is intentionally lenient at keystroke time (allows partial
 * entry) and strict on blur / submit (`isValidSaudiMobile`).
 */

interface Props {
  /** 9-digit local part — value should start with `5` when valid. */
  value: string;
  /** Receives the cleaned 9-digit value (digits only, capped at 9 chars). */
  onChange: (next: string) => void;
  /** Label rendered above the input. */
  label?: ReactNode;
  /** id for the underlying <input>; auto-generated if omitted. */
  id?: string;
  /** Disable input. */
  disabled?: boolean;
  /** Required-field marker on the label. */
  required?: boolean;
  /** Render compact (no label) for tight layouts. */
  hideLabel?: boolean;
  /** Optional className to override the wrapper. */
  className?: string;
  /** Show validation error below the input (defaults to true on blur). */
  showError?: boolean;
  /** Pre-built error text — defaults to the i18n invalid-phone message. */
  errorText?: string | null;
  /** Optional callback fired with true/false validity on every change. */
  onValidityChange?: (valid: boolean, normalized: string | null) => void;
  /** Surface the input name to forms. */
  name?: string;
}

const isPartiallyValid = (digits: string): boolean => {
  if (digits === "") return true;
  // While typing: 1-9 digits, first digit must be 5 (or empty).
  return /^5\d{0,8}$/.test(digits) || /^[0-4|6-9]/.test(digits) === false;
};

const isComplete = (digits: string): boolean => /^5\d{8}$/.test(digits);

export default function SaudiPhoneInput({
  value,
  onChange,
  label,
  id,
  disabled,
  required,
  hideLabel,
  className,
  showError = true,
  errorText,
  onValidityChange,
  name,
}: Props) {
  const t = useTranslations("commonSettings.phoneField");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const autoId = useId();
  const inputId = id ?? autoId;

  const handleChange = (raw: string) => {
    // Strip non-digits, cap at 9. Drop a leading "0" if the user types
    // "05..." (matches KSA local-with-zero convention).
    let digits = raw.replace(/\D+/g, "");
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length > 9) digits = digits.slice(0, 9);
    onChange(digits);
    if (onValidityChange) {
      const valid = isComplete(digits);
      onValidityChange(valid, valid ? `+966${digits}` : null);
    }
  };

  const showInvalid =
    showError && value.length > 0 && !isComplete(value) && !isPartiallyValid(value)
      ? true
      : showError && value.length === 9 && !isComplete(value);

  // The prefix is rendered LTR even in Arabic — phone-number conventions
  // are global LTR. Per project convention, Latin digits in Arabic too.
  return (
    <div className={className}>
      {!hideLabel && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
        >
          {label ?? t("label")}
          {required && <span className="text-red-500 ms-0.5">*</span>}
        </label>
      )}
      <div
        className={`flex items-stretch border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[var(--color-input-focus)] ${
          disabled
            ? "border-[var(--color-input-border)] bg-[var(--color-surface-page)]"
            : showInvalid
              ? "border-red-500"
              : "border-[var(--color-input-border)]"
        }`}
        dir="ltr"
      >
        <span className="flex items-center gap-1.5 px-3 bg-[var(--color-surface-page)] text-sm font-medium text-[var(--color-text-secondary)] border-e border-[var(--color-input-border)] select-none">
          <Phone className="w-3.5 h-3.5" />
          +966
        </span>
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={value}
          dir="ltr"
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t("placeholder")}
          maxLength={9}
          aria-invalid={showInvalid || undefined}
          aria-describedby={showInvalid ? `${inputId}-err` : undefined}
          className={`flex-1 px-3 py-2.5 text-sm bg-transparent outline-none ${
            disabled ? "text-[var(--color-text-secondary)] cursor-not-allowed" : ""
          }`}
        />
      </div>
      {showInvalid ? (
        <p
          id={`${inputId}-err`}
          className={`mt-1 text-xs text-red-500 ${isRTL ? "text-right" : "text-left"}`}
        >
          {errorText ?? t("invalid")}
        </p>
      ) : (
        <p
          className={`mt-1 text-xs text-[var(--color-text-secondary)] ${isRTL ? "text-right" : "text-left"}`}
        >
          {t("helper")}
        </p>
      )}
    </div>
  );
}
