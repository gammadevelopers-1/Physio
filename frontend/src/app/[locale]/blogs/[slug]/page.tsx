import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { BlogDetailContent } from "@/components/blogs";
import { getBlogDetailData } from "@/lib/strapi/api";

export default async function BlogDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const {
    blogPost,
    latestBlogs,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getBlogDetailData(slug, locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlogDetailContent blogPost={blogPost} latestBlogs={latestBlogs} blogsPage={blogsPage} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <WhatsAppButton phoneNumber={siteSettings?.whatsappNumber} enabled={siteSettings?.showWhatsappButton} />
    </main>
  );
}
