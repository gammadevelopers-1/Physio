"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button gets a destructive (red) style. */
  destructive?: boolean;
  /** Called when the user confirms. Dialog auto-closes after. */
  onConfirm: () => void | Promise<void>;
}

/**
 * Lightweight shadcn-style confirm dialog with no third-party
 * dependency. Replaces native `window.confirm` for support actions
 * (remove attachment, remove collaborator, discard reply, etc.).
 *
 * Renders via portal into document.body so backdrop overlays the
 * full viewport regardless of the trigger's stacking context.
 */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: Props) {
  const t = useTranslations("supportCommon.confirm");
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // ESC to cancel + focus the confirm button on open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        tabIndex={-1}
      />
      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-[var(--color-border)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="w-9 h-9 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            {cancelLabel ?? t("cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={async () => {
              try {
                await onConfirm();
              } finally {
                onOpenChange(false);
              }
            }}
            className={`px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              destructive
                ? "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                : "bg-[var(--color-primary)] text-white hover:opacity-90"
            }`}
          >
            {confirmLabel ?? t("confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
