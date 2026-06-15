import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { AlertCircle, ArrowLeft } from "lucide-react";
import StatusHistoryClient from "./StatusHistoryClient";

// Server-rendered shell + RTL handling. The actual filter/table UI
// lives in StatusHistoryClient because it needs client-side state for
// the date-range picker, pagination, and filter chips. Public access
// (no auth) — same model as /status.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StatusHistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isRTL = locale === "ar";

  return (
    <div
      className="min-h-screen bg-[var(--color-surface-page)] py-10 px-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <Link
              href={`/${locale}/status`}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-2"
            >
              <ArrowLeft className={`w-3 h-3 ${isRTL ? "rotate-180" : ""}`} />
              {isRTL ? "العودة إلى الحالة" : "Back to status"}
            </Link>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {isRTL ? "أرشيف الحوادث" : "Incident History"}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {isRTL
                ? "كل الحوادث التي تم حلها — قابلة للتصفية والتصفح."
                : "Every resolved incident — filterable + searchable."}
            </p>
          </div>
        </div>

        <StatusHistoryClient locale={locale} />

        <div className="mt-12 text-center">
          <AlertCircle className="w-4 h-4 text-[var(--color-text-secondary)] inline-block me-1" />
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {isRTL
              ? "للحوادث النشطة، راجع صفحة الحالة الرئيسية."
              : "For active incidents, see the main status page."}
          </span>
        </div>
      </div>
    </div>
  );
}
