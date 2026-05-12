import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Breadcrumb from "@/components/shared/Breadcrumb";
import InstructorPublicProfileContent from "@/components/instructors/InstructorPublicProfileContent";
import { getSiteSettings, getNavbarLinks, getFooterLinks } from "@/lib/strapi";

const BACKEND_API_URL =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

interface InstructorForSeo {
  firstName?: string | null;
  lastName?: string | null;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  bio?: string | null;
  avatar?: string | null;
  profession?: string | null;
}

async function fetchInstructorForSeo(id: string): Promise<InstructorForSeo | null> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/courses/instructors/${id}/public`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as InstructorForSeo;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const instructor = await fetchInstructorForSeo(id);

  const name = (() => {
    if (!instructor) return locale === "ar" ? "المدرب" : "Instructor";
    const ar = `${instructor.firstNameAr || ""} ${instructor.lastNameAr || ""}`.trim();
    const en = `${instructor.firstName || ""} ${instructor.lastName || ""}`.trim();
    if (locale === "ar" && ar) return ar;
    return en || ar || (locale === "ar" ? "المدرب" : "Instructor");
  })();

  const title = instructor?.profession ? `${name} — ${instructor.profession}` : name;
  const description =
    instructor?.bio ||
    (locale === "ar"
      ? `تعرف على ${name} والدورات التي يقدمها.`
      : `Learn more about ${name} and the courses they teach.`);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: instructor?.avatar ? [{ url: instructor.avatar }] : undefined,
    },
  };
}

export default async function InstructorPublicPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const [siteSettings, navbarLinks, footerLinks, instructor] = await Promise.all([
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
    fetchInstructorForSeo(id),
  ]);

  const crumbName = (() => {
    if (!instructor) return locale === "ar" ? "المدرب" : "Instructor";
    const ar = `${instructor.firstNameAr || ""} ${instructor.lastNameAr || ""}`.trim();
    const en = `${instructor.firstName || ""} ${instructor.lastName || ""}`.trim();
    if (locale === "ar" && ar) return ar;
    return en || ar || (locale === "ar" ? "المدرب" : "Instructor");
  })();

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />

      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pt-4">
        <Breadcrumb
          locale={locale}
          crumbs={[
            { label: locale === "ar" ? "الرئيسية" : "Home", href: `/${locale}` },
            {
              label: locale === "ar" ? "المدربون" : "Instructors",
              href: `/${locale}/instructors`,
            },
            { label: crumbName },
          ]}
        />
      </div>

      <InstructorPublicProfileContent instructorId={id} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
