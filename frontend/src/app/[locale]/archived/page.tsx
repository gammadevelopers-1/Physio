import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { ArchivedPageContent } from "@/components/courses";

export const metadata = {
  title: "Archived | PhysioGuidance",
  description: "Explore archived courses and programs",
};

export default function ArchivedPage() {
  return (
    <main id="main-content" className="min-h-screen bg-white">
      <Navbar />
      <ArchivedPageContent />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
