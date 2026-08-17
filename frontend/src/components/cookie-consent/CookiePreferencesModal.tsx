"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CookieConsentState, writeConsent } from "@/lib/cookie-consent";
import { X } from "lucide-react";

export default function CookiePreferencesModal({
  state,
  onClose,
}: {
  state: CookieConsentState | null;
  onClose: () => void;
}) {
  const t = useTranslations("cookieConsent");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const privacyHref = `/${locale}/privacy`;

  const [analytics, setAnalytics] = useState<boolean>(state?.analytics ?? false);
  const [marketing, setMarketing] = useState<boolean>(state?.marketing ?? false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const savePreferences = () => {
    writeConsent({ analytics, marketing });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-preferences-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--color-surface-card)] p-6 shadow-2xl md:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("closeAriaLabel")}
          className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} rounded-full p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <h2
          id="cookie-preferences-heading"
          className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]"
        >
          {t("modalTitle")}
        </h2>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          {t("modalIntro")}{" "}
          <Link
            href={privacyHref}
            className="font-medium text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary-dark)]"
          >
            {t("privacyLink")}
          </Link>
          .
        </p>

        <div className="space-y-4">
          <CategoryRow
            title={t("categoryEssentialTitle")}
            description={t("categoryEssentialBody")}
            checked
            disabled
            onToggle={() => {}}
            badgeLabel={t("categoryAlwaysOn")}
          />
          <CategoryRow
            title={t("categoryAnalyticsTitle")}
            description={t("categoryAnalyticsBody")}
            checked={analytics}
            onToggle={() => setAnalytics((v) => !v)}
          />
          <CategoryRow
            title={t("categoryMarketingTitle")}
            description={t("categoryMarketingBody")}
            checked={marketing}
            onToggle={() => setMarketing((v) => !v)}
          />
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={savePreferences}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-button-text)] transition-colors hover:bg-[var(--color-primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            {t("savePreferences")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  disabled,
  onToggle,
  badgeLabel,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  badgeLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-page)] p-4">
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
          </h3>
          {badgeLabel && (
            <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary-dark)]">
              {badgeLabel}
            </span>
          )}
        </div>
        <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-input-border)]"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0.5 rtl:-translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
