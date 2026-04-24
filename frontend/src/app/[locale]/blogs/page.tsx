import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { BlogsPageContent } from "@/components/blogs";
import { getBlogsPageData } from "@/lib/strapi/api";

export const metadata = {
  title: "Blogs | PhysioGuidance",
  description: "Insights, Updates, and Best Practices in Healthcare Education",
};

export default async function BlogsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const {
    blogPosts,
    featuredBlogs,
    blogCategories,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getBlogsPageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlogsPageContent
        blogPosts={blogPosts}
        featuredBlogs={featuredBlogs}
        blogCategories={blogCategories}
        blogsPage={blogsPage}
      />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <WhatsAppButton phoneNumber={siteSettings?.whatsappNumber} enabled={siteSettings?.showWhatsappButton} />
    </main>
  );
}
