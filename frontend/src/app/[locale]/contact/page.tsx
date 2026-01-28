import Navbar from "@/components/Navbar";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar />
      <ContactForm />
      <div className="hidden lg:block">
        <Footer />
      </div>
      <WhatsAppButton />
    </main>
  );
}
