import Navbar from "@/components/Navbar";
import FeedbackForm from "@/components/FeedbackForm";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function FeedbackPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar />
      <FeedbackForm />
      <div className="hidden lg:block">
        <Footer />
      </div>
      <WhatsAppButton />
    </main>
  );
}
