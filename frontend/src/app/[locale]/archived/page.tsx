import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArchivedPageContent } from "@/components/courses";
import { getCoursesPage, getCoursesPageData, getSiteSettings, getStrapiMediaUrl } from "@/lib/strapi";
import { buildPageMetadata } from "@/lib/seo";
import Breadcrumb from "@/components/shared/Breadcrumb";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [page, settings] = await Promise.all([
    getCoursesPage(locale).catch(() => null),
    getSiteSettings(locale).catch(() => null),
  ]);
  // Archived shares the courses-page Strapi entity; only override the
  // default title/description so search-engine results are distinct.
  return buildPageMetadata({
    locale,
    path: "/archived",
    page: page as Parameters<typeof buildPageMetadata>[0]["page"],
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
    override: {
      title: locale === "ar" ? "الدورات المؤرشفة | PhysioGuidance" : "Archived Courses | PhysioGuidance",
      description:
        locale === "ar"
          ? "استعرض الدورات المؤرشفة — البرامج السابقة والدفعات المنتهية."
          : "Browse our archived courses — past programs and completed cohorts.",
    },
  });
}

export default async function ArchivedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Reuse the same Strapi page data fetcher as /courses so navbar/footer
  // share the same site-wide chrome (logos, nav links, footer columns).
  const { siteSettings, navbarLinks, footerLinks } =
    await getCoursesPageData(locale);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)] overflow-x-hidden"
    >
      <Navbar
        siteSettings={siteSettings}
        navLinks={navbarLinks}
        footerLinks={footerLinks}
      />
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pt-4">
        <Breadcrumb
          locale={locale}
          crumbs={[
            { label: locale === "ar" ? "الرئيسية" : "Home", href: `/${locale}` },
            { label: locale === "ar" ? "الدورات" : "Courses", href: `/${locale}/courses` },
            { label: locale === "ar" ? "المؤرشفة" : "Archived" },
          ]}
        />
      </div>
      <ArchivedPageContent />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
