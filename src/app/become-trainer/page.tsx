import Navbar from "@/components/Navbar";
import BecomeTrainerForm from "@/components/BecomeTrainerForm";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export default function BecomeTrainerPage() {
  return (
    <main className="min-h-screen bg-[#EEF3F7]">
      <Navbar />
      <BecomeTrainerForm />
      <Footer />
      <BottomNav />
    </main>
  );
}
