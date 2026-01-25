import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { BlogsPageContent } from "@/components/blogs";

export const metadata = {
  title: "Blogs | PhysioGuidance",
  description: "Insights, Updates, and Best Practices in Healthcare Education",
};

export default function BlogsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <BlogsPageContent />
      <Footer />
      <BottomNav />
      <WhatsAppButton />
    </main>
  );
}
