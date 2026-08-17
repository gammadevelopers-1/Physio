"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { acceptAll, rejectAll } from "@/lib/cookie-consent";

export default function CookieConsentBanner({
  onOpenPreferences,
}: {
  onOpenPreferences: () => void;
}) {
  const t = useTranslations("cookieConsent");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const privacyHref = `/${locale}/privacy`;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-heading"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 pointer-events-none"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 shadow-xl md:p-6"
        style={{ backdropFilter: "saturate(140%)" }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <div className="flex-1">
            <h2
              id="cookie-consent-heading"
              className="mb-2 text-base font-semibold text-[var(--color-text-primary)]"
            >
              {t("bannerTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {t("bannerBody")}{" "}
              <Link
                href={privacyHref}
                className="font-medium text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary-dark)]"
              >
                {t("privacyLink")}
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:min-w-[190px]">
            <button
              type="button"
              onClick={() => acceptAll()}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-button-text)] transition-colors hover:bg-[var(--color-primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              {t("acceptAll")}
            </button>
            <button
              type="button"
              onClick={() => rejectAll()}
              className="rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-page)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              {t("rejectAll")}
            </button>
            <button
              type="button"
              onClick={onOpenPreferences}
              className="rounded-lg bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] underline underline-offset-2 transition-colors hover:text-[var(--color-text-primary)] focus:outline-none"
            >
              {t("managePreferences")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
