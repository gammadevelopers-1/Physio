"use client";

/**
 * Confirm dialog — design-system replacement for browser `window.confirm()`.
 *
 * Pass `open` + `onClose` + `onConfirm`. The dialog locks body scroll,
 * closes on Escape and outside-click. The `danger` flag swaps the confirm
 * button to red and adds a warning icon — use for destructive actions.
 *
 * Renders nothing when `open` is false (no Portal — it's a plain absolute-
 * positioned overlay so it inherits parent dir/theme without surprises).
 */

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Info, Loader2, X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  /** Override the default "Confirm" label (e.g. "Delete", "Deactivate"). */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + warning icon for destructive actions. */
  danger?: boolean;
  /** Async-safe — disables both buttons + spins the confirm button. */
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  loading,
  onConfirm,
  onClose,
}: Props) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("financeDashboard.confirmDialog");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={() => !loading && onClose()}
        aria-label={cancelLabel || t("cancel")}
      />
      <div className="relative bg-[var(--color-surface-card)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-full max-w-md overflow-hidden">
        <div className={`px-5 pt-5 pb-3 flex items-start gap-3 ${isRTL ? "flex-row-reverse text-end" : ""}`}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              danger ? "bg-[#FEE2E2]" : "bg-[#DBEAFE]"
            }`}
          >
            {danger ? (
              <AlertTriangle className="w-5 h-5 text-[#B91C1C]" />
            ) : (
              <Info className="w-5 h-5 text-[#1D4ED8]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-snug">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            disabled={loading}
            className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)] flex-shrink-0"
            aria-label={cancelLabel || t("cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className={`px-5 py-3 bg-[var(--color-surface-page)] flex items-center justify-end gap-2 ${
            isRTL ? "flex-row-reverse" : ""
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
          >
            {cancelLabel || t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
              danger
                ? "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                : "bg-[var(--color-primary)] text-white hover:opacity-95"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel || t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
