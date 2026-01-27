import Navbar from "@/components/Navbar";
import FeedbackForm from "@/components/FeedbackForm";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-[#EEF3F7]">
      <Navbar />
      <FeedbackForm />
      <Footer />
      <BottomNav />
    </main>
  );
}
