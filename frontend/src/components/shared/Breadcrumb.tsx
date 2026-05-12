import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLD } from "@/lib/structured-data";
import { SITE_URL } from "@/lib/seo";

export interface BreadcrumbCrumb {
  /** Visible label, already locale-resolved. */
  label: string;
  /** Locale-prefixed path, e.g. "/en/courses". Omit for the trailing
   *  current-page crumb (which renders as plain text). */
  href?: string;
}

interface BreadcrumbProps {
  crumbs: BreadcrumbCrumb[];
  locale: string;
  /** Optional className wrapper for layout overrides. */
  className?: string;
}

/**
 * Visual breadcrumb + matching schema.org BreadcrumbList JSON-LD.
 *
 * Server component. Emits the JSON-LD inline so it ships in the initial
 * HTML — no client JS, indexable by every crawler.
 *
 * Usage:
 *   <Breadcrumb
 *     locale={locale}
 *     crumbs={[
 *       { label: t("breadcrumbs.home"), href: `/${locale}` },
 *       { label: t("breadcrumbs.courses"), href: `/${locale}/courses` },
 *       { label: course.title },
 *     ]}
 *   />
 */
export default function Breadcrumb({ crumbs, locale, className }: BreadcrumbProps) {
  if (!crumbs || crumbs.length === 0) return null;

  const isRTL = locale === "ar";
  const Sep = isRTL ? ChevronLeft : ChevronRight;

  // BreadcrumbList JSON-LD — every crumb gets a position. The trailing
  // crumb without an href is emitted as the current page URL.
  const ld = breadcrumbLD(
    crumbs.map((c, i) => ({
      name: c.label,
      url: c.href || (i === crumbs.length - 1 ? `${SITE_URL}/${locale}` : `${SITE_URL}/${locale}`),
    })),
  );

  return (
    <>
      <JsonLd id="ld-breadcrumb" data={ld} />
      <nav
        aria-label="Breadcrumb"
        dir={isRTL ? "rtl" : "ltr"}
        className={`text-sm text-[var(--color-text-secondary)] ${className || ""}`}
      >
        <ol className={`flex items-center flex-wrap gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          {crumbs.map((c, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {c.href && !isLast ? (
                  <Link
                    href={c.href}
                    className="hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    className="text-[var(--color-text-primary)] font-medium"
                    aria-current={isLast ? "page" : undefined}
                  >
                    {c.label}
                  </span>
                )}
                {!isLast && (
                  <Sep
                    className="w-4 h-4 text-[var(--color-text-secondary)]"
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
