import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { BlogDetailContent } from "@/components/blogs";
import { getBlogDetailData } from "@/lib/strapi/api";

export default async function BlogDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const {
    blogPost,
    latestBlogs,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getBlogDetailData(slug, locale);

  return (
    <main className="min-h-screen bg-white">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <BlogDetailContent blogPost={blogPost} latestBlogs={latestBlogs} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <BottomNav />
      <WhatsAppButton />
    </main>
  );
}
