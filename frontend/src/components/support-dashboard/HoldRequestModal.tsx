"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2, X } from "lucide-react";

const HOLD_REASONS = [
  "waiting for student response",
  "waiting for third party",
  "waiting for internal team",
  "pending investigation",
  "other",
] as const;

export type HoldReason = (typeof HOLD_REASONS)[number];

// Modal that an agent uses to submit a hold-approval request.
// Replaces the inline picker + native <select> that previously lived
// in TicketDetailContent's sidebar.
//
// Behaviour:
//   - Custom (non-native) dropdown so the look matches the rest of
//     the admin/agent design system.
//   - When the reason is "other", a textarea appears and is REQUIRED
//     before the submit button enables.
//   - Esc closes; click-outside closes only when the reason hasn't
//     been edited (prevents losing typed reasoning by accident).
const HoldRequestModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: HoldReason; description?: string }) => Promise<void>;
  isSubmitting: boolean;
}) => {
  const t = useTranslations("supportDashboard.ticketDetail");
  const [reason, setReason] = useState<HoldReason>(HOLD_REASONS[0]);
  const [description, setDescription] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset form when the modal re-opens so a previous "other" draft
  // doesn't bleed into the next submission.
  useEffect(() => {
    if (isOpen) {
      setReason(HOLD_REASONS[0]);
      setDescription("");
      setIsDropdownOpen(false);
    }
  }, [isOpen]);

  // Esc to close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Close the dropdown on outside click (inside the dialog only).
  useEffect(() => {
    if (!isDropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isDropdownOpen]);

  if (!isOpen) return null;

  const requiresDescription = reason === "other";
  const canSubmit =
    !isSubmitting && (!requiresDescription || description.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        // Click outside closes — except when there's typed description.
        if (e.target === e.currentTarget && description.trim().length === 0) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-[var(--color-surface-card)] rounded-2xl shadow-xl border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("holdModal.title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label={t("holdModal.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("holdModal.intro")}
          </p>

          {/* Custom dropdown — keeps look in line with the design system. */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("holdModal.reasonLabel")}
            </label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen((v) => !v)}
                disabled={isSubmitting}
                className="w-full h-10 px-3 flex items-center justify-between bg-white border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
              >
                <span>{t(`onHold.reasons.${reason}` as any)}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10 py-1 overflow-hidden">
                  {HOLD_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setReason(r);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-start hover:bg-[var(--color-border-subtle)] ${
                        r === reason
                          ? "text-[var(--color-primary)] font-medium"
                          : "text-[var(--color-text-primary)]"
                      }`}
                    >
                      {t(`onHold.reasons.${r}` as any)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description — required when reason='other'. */}
          {requiresDescription && (
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
                {t("holdModal.descriptionLabel")}{" "}
                <span className="text-[#DC2626]">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("holdModal.descriptionPlaceholder")}
                maxLength={2000}
                rows={4}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 resize-none"
              />
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                {t("holdModal.descriptionHelp")}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            {t("holdModal.cancel")}
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                reason,
                description: requiresDescription ? description.trim() : undefined,
              })
            }
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("holdModal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HoldRequestModal;
