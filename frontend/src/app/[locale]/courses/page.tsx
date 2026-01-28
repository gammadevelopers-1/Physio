import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { CoursesPageContent } from "@/components/courses";

export const metadata = {
  title: "Courses | PhysioGuidance",
  description: "Explore courses and events - Accredited healthcare training programs",
};

export default function CoursesPage() {
  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      <Navbar />
      <CoursesPageContent />
      <Footer />
      <BottomNav />
      <WhatsAppButton />
    </main>
  );
}
