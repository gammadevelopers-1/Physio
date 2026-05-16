import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CourseDetailContent } from "@/components/courses";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import { getCourseDetailPage, getSiteSettings, getNavbarLinks, getFooterLinks, getStrapiMediaUrl } from "@/lib/strapi";
import type { SideLoadedData } from "@/lib/strapi/types";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { courseLD, type CourseInstructorLD } from "@/lib/structured-data";

const BACKEND_API_URL =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

interface PublicCourseSeo {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  ogImage?: string | null;
  noindex?: boolean | null;
}

interface PublicCourseForSeo {
  id: string;
  title?: string | null;
  titleAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  thumbnail?: string | null;
  language?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalHours?: number | null;
  price?: number | string | null;
  deliveryType?: string | null;
  cmeHours?: number | null;
  avgRating?: number | null;
  totalRatings?: number | null;
  instructor?: CourseInstructorLD | null;
  seo?: PublicCourseSeo | null;
}

async function fetchCourseForSeo(courseId: string): Promise<PublicCourseForSeo | null> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/courses/public/${courseId}`, {
      headers: { Accept: "application/json" },
      // Edge cache for 5 min — metadata is not user-specific.
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicCourseForSeo;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [course, settings] = await Promise.all([
    fetchCourseForSeo(slug),
    getSiteSettings(locale).catch(() => null),
  ]);

  const courseTitle = locale === "ar" && course?.titleAr ? course.titleAr : course?.title;
  const courseDesc =
    locale === "ar" && course?.descriptionAr ? course.descriptionAr : course?.description;

  return buildMetadata({
    seo: course?.seo
      ? {
          metaTitle: course.seo.title,
          metaDescription: course.seo.description,
          keywords: course.seo.keywords,
          ogImage: course.seo.ogImage,
          noindex: course.seo.noindex,
        }
      : null,
    fallbacks: {
      title: courseTitle,
      description: courseDesc,
      image: course?.thumbnail,
    },
    locale,
    path: `/courses/${slug}`,
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const [courseDetailPage, siteSettings, navbarLinks, footerLinks, courseForLd] = await Promise.all([
    getCourseDetailPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
    fetchCourseForSeo(slug),
  ]);

  const blocks = courseDetailPage?.blocks;
  const sideLoadedData: SideLoadedData = {
    partners: [],
    featuredCourses: [],
    instructors: [],
    testimonials: [],
  };

  // Course JSON-LD — only when we successfully fetched the course payload.
  // If the public course endpoint is unreachable, skip rather than emit a
  // broken/incomplete LD record.
  const courseLdJson = courseForLd
    ? courseLD({
        id: courseForLd.id,
        url: `${SITE_URL}/${locale}/courses/${slug}`,
        title:
          (locale === "ar" && courseForLd.titleAr ? courseForLd.titleAr : courseForLd.title) ||
          "Course",
        description:
          locale === "ar" && courseForLd.descriptionAr
            ? courseForLd.descriptionAr
            : courseForLd.description,
        thumbnail: courseForLd.thumbnail,
        language: courseForLd.language,
        startDate: courseForLd.startDate,
        endDate: courseForLd.endDate,
        totalHours: courseForLd.totalHours,
        price: typeof courseForLd.price === "string" ? Number(courseForLd.price) : courseForLd.price,
        deliveryType: courseForLd.deliveryType || undefined,
        cmeHours: courseForLd.cmeHours,
        avgRating: courseForLd.avgRating,
        totalRatings: courseForLd.totalRatings,
        instructor: courseForLd.instructor,
        providerName: siteSettings?.siteName || undefined,
      })
    : null;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      {courseLdJson && <JsonLd id="ld-course" data={courseLdJson} />}
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />

      {/* Breadcrumb is rendered inside CourseDetailContent (icon variant
          tuned to the hero), so this wrapper deliberately omits the
          duplicate page-level <Breadcrumb /> we used to render here. */}

      <CourseDetailContent
        noReviewsText={courseDetailPage?.noReviewsText || undefined}
        moreContentText={courseDetailPage?.moreContentText || undefined}
        relatedCoursesTitle={courseDetailPage?.relatedCoursesTitle || undefined}
        relatedCoursesSubtitle={courseDetailPage?.relatedCoursesSubtitle || undefined}
        overviewHeading={courseDetailPage?.overviewHeading || undefined}
        objectivesHeading={courseDetailPage?.objectivesHeading || undefined}
        featuresHeading={courseDetailPage?.featuresHeading || undefined}
        contentsHeading={courseDetailPage?.contentsHeading || undefined}
        scheduleHeading={courseDetailPage?.scheduleHeading || undefined}
        requirementsHeading={courseDetailPage?.requirementsHeading || undefined}
        noticesHeading={courseDetailPage?.noticesHeading || undefined}
        reviewsHeading={courseDetailPage?.reviewsHeading || undefined}
        targetAudienceHeading={courseDetailPage?.targetAudienceHeading || undefined}
        courseDetailsHeading={courseDetailPage?.courseDetailsHeading || undefined}
      />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
