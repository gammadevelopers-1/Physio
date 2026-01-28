import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { ArchivedPageContent } from "@/components/courses";

export const metadata = {
  title: "Archived | PhysioGuidance",
  description: "Explore archived courses and programs",
};

export default function ArchivedPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <ArchivedPageContent />
      <Footer />
      <BottomNav />
      <WhatsAppButton />
    </main>
  );
}
