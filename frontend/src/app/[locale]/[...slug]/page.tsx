import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getDynamicPage } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { SideLoadedData } from "@/lib/strapi/types";

export const dynamic = "force-dynamic";

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const pageSlug = slug.join("/");
  const { page, siteSettings, navbarLinks, footerLinks } =
    await getDynamicPage(pageSlug, locale);

  if (!page) {
    notFound();
  }

  const sideLoadedData: SideLoadedData = {
    partners: [],
    featuredCourses: [],
    instructors: [],
    testimonials: [],
  };

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0"
    >
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />

      {page.blocks && page.blocks.length > 0 ? (
        <BlockRenderer blocks={page.blocks} sideLoadedData={sideLoadedData} />
      ) : (
        <div className="max-w-4xl mx-auto px-4 lg:px-16 py-12 lg:py-20 text-center">
          <h1 className="text-[36px] lg:text-[48px] font-semibold text-[var(--on-surface-default)] mb-4">
            {page.title}
          </h1>
        </div>
      )}

      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
