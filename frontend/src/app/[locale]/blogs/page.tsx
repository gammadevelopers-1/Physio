import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
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
    featuredBlog,
    blogCategories,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getBlogsPageData(locale);

  return (
    <main className="min-h-screen bg-white">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <BlogsPageContent
        blogPosts={blogPosts}
        featuredBlog={featuredBlog}
        blogCategories={blogCategories}
      />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <BottomNav />
      <WhatsAppButton />
    </main>
  );
}
