import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { CourseDetailContent } from "@/components/courses";

export default function CourseDetailPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <CourseDetailContent />
      <Footer />
      <BottomNav />
      <WhatsAppButton />
    </main>
  );
}
