import Image from "next/image";
import { Wrench } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSiteSettings } from "@/lib/strapi";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { getPlatformGeneralSettings } from "@/lib/platform-general-server";
import MaintenanceAutoRecover from "./MaintenanceAutoRecover";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

// Render server-side every request so browsers / CDNs never cache the
// maintenance redirect — the moment admin flips the toggle off, the
// next request gets the real page instead of a stale "we're down" HTML.
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchMaintenanceMessage(locale: string): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/public/maintenance-status`, {
      cache: "no-store",
    });
    if (!res.ok) return "";
    const data = (await res.json()) as {
      enabled: boolean;
      messageEn: string;
      messageAr: string;
    };
    return locale === "ar" ? data.messageAr : data.messageEn;
  } catch {
    return "";
  }
}

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("maintenancePage");
  const isRTL = locale === "ar";

  const [message, siteSettings, platformGeneral] = await Promise.all([
    fetchMaintenanceMessage(locale),
    getSiteSettings(locale).catch(() => null),
    getPlatformGeneralSettings(),
  ]);

  // Logo — same priority chain we use elsewhere: Strapi first (visual),
  // then fallback to bundled asset.
  const logoUrl = siteSettings?.logo?.url
    ? getStrapiMediaUrl(siteSettings.logo.url)
    : "/images/logo.png";
  const siteName =
    (locale === "ar" ? platformGeneral.platformNameAr : platformGeneral.platformName) ||
    siteSettings?.siteName ||
    "PhysioGuidance";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-[var(--color-surface-page)] via-[var(--color-surface-card)] to-[var(--color-border-subtle)]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <MaintenanceAutoRecover locale={locale} />

      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative h-14 w-14">
            <Image
              src={logoUrl}
              alt={siteName}
              width={56}
              height={56}
              className="object-contain"
              unoptimized={logoUrl.startsWith("http")}
              priority
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          {/* Brand stripe */}
          <div
            className="h-1.5"
            style={{
              background:
                "linear-gradient(90deg, var(--color-primary), var(--color-primary-dark))",
            }}
          />

          <div className="px-8 py-10 text-center">
            {/* Icon */}
            <div
              className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-primary)15, var(--color-primary-dark)15)",
              }}
            >
              <Wrench
                className="w-8 h-8 text-[var(--color-primary)]"
                strokeWidth={1.75}
              />
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
              {t("title")}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {t("subtitle")}
            </p>

            {/* Admin message */}
            {message && (
              <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-xl px-5 py-4 text-sm text-[var(--color-text-primary)] leading-relaxed text-start whitespace-pre-line">
                {message}
              </div>
            )}

            {/* Auto-recover hint */}
            <p className="text-xs text-[var(--color-text-secondary)] mt-6">
              {t("autoRecoverHint")}
            </p>
          </div>
        </div>

        {/* Site name footer */}
        <p className="text-center text-xs text-[var(--color-text-secondary)] mt-6">
          {siteName}
        </p>
      </div>
    </div>
  );
}
