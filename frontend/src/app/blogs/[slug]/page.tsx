import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { BlogDetailContent } from "@/components/blogs";

export default function BlogDetailPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <BlogDetailContent />
      <Footer />
      <BottomNav />
      <WhatsAppButton />
    </main>
  );
}
