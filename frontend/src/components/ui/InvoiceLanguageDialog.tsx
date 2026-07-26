"use client";

/**
 * Two-button modal that asks the user which language they want a downloaded
 * invoice / proforma / receipt PDF in. Sits in front of every "Download
 * invoice" / "Resend invoice email" / "Regenerate PDF" action across student
 * and finance surfaces. The choice is passed to the backend as `locale=en|ar`.
 *
 * Per Amna's spec: prompt on every download — never remembered across sessions.
 * If the user closes without choosing, the caller's action is cancelled.
 *
 * Renders nothing when `open` is false. Body scroll lock + Escape + backdrop
 * click all dismiss.
 */

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Languages, X } from "lucide-react";

interface Props {
  open: boolean;
  /** Called with the picked locale; caller triggers the download. */
  onPick: (locale: "en" | "ar") => void;
  onClose: () => void;
  /** Optional title override — defaults to the shared i18n key. */
  title?: string;
  /** Optional description override — defaults to the shared i18n key. */
  description?: string;
}

const InvoiceLanguageDialog = ({
  open,
  onPick,
  onClose,
  title,
  description,
}: Props) => {
  const t = useTranslations("invoiceLanguage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const resolvedTitle = title || t("title");
  const resolvedDescription = description || t("description");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-language-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label={t("close")}
      />
      <div className="relative bg-[var(--color-surface-card)] rounded-2xl shadow-2xl border border-[var(--color-border)] w-full max-w-md overflow-hidden">
        <div
          className={`px-5 pt-5 pb-3 flex items-start gap-3 ${
            isRTL ? "flex-row-reverse text-end" : ""
          }`}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#DBEAFE]">
            <Languages className="w-5 h-5 text-[#1D4ED8]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="invoice-language-title"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              {resolvedTitle}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-snug">
              {resolvedDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)] flex-shrink-0"
            aria-label={t("close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className={`px-5 py-4 bg-[var(--color-surface-page)] grid grid-cols-2 gap-3 ${
            isRTL ? "direction-rtl" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => onPick("en")}
            className="flex flex-col items-center justify-center gap-2 py-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors group"
          >
            <FileText className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("english")}
            </span>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              English
            </span>
          </button>
          <button
            type="button"
            onClick={() => onPick("ar")}
            className="flex flex-col items-center justify-center gap-2 py-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors group"
          >
            <FileText className="w-6 h-6 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("arabic")}
            </span>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              العربية
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceLanguageDialog;
