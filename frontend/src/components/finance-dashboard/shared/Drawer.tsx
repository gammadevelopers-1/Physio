"use client";

import { useEffect, ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Width in px on lg+, full-width below. Default 560. */
  width?: number;
  /** Header right-side action node (e.g. status pill, close button is added by Drawer). */
  headerExtra?: ReactNode;
  children: ReactNode;
  /** Footer area sticks to the bottom (e.g. action buttons). */
  footer?: ReactNode;
}

/**
 * Right-side slide-over drawer used across the finance dashboard. Mirrors the
 * pattern from AssessmentPreviewDrawer / WebinarRegistrantsDrawer so it
 * blends visually. In RTL the drawer slides from the LEFT (mirroring the
 * close button + border placement).
 */
const Drawer = ({
  open,
  onClose,
  title,
  subtitle,
  width = 560,
  headerExtra,
  children,
  footer,
}: DrawerProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("financeDashboard.a11y");

  // Lock body scroll while open + close on Escape
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      // `justify-end` unconditional: with `<html dir="rtl">` cascading to
      // this fixed portal, `justify-end` places the drawer at the physical
      // LEFT edge in RTL (main-axis end = left in RTL) and at the physical
      // RIGHT edge in LTR — mirroring correctly. Wave-2 used `justify-start`
      // in RTL which resolved to the RIGHT edge and left the drawer glued
      // to the wrong side of the viewport.
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label={t("closeOverlay")}
      />
      <div
        // Explicit `dir` so text alignment cascades correctly even if the
        // fixed portal is ever detached from the document flow. The visible
        // edge in RTL is the RIGHT edge (drawer sits on the LEFT), so
        // `border-r` in RTL / `border-l` in LTR is correct.
        dir={isRTL ? "rtl" : "ltr"}
        className={`relative w-full h-full bg-[var(--color-surface-page)] shadow-2xl flex flex-col ${isRTL ? "border-r" : "border-l"} border-[var(--color-border)]`}
        style={{ maxWidth: width }}
      >
        {/* Header — no manual flex-row-reverse; the `dir` above makes the
            natural flex order lay title on the start edge (RIGHT in RTL,
            LEFT in LTR) and the close-button cluster on the end edge. */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label={t("closeDrawer")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Drawer;
