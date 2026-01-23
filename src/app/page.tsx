import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Partners from "@/components/Partners";
import FeaturedCourses from "@/components/FeaturedCourses";
import BecomeTrainer from "@/components/BecomeTrainer";
import ExpertInstructors from "@/components/ExpertInstructors";
import Testimonials from "@/components/Testimonials";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--surface)]">
      <Navbar />
      <Hero />
      <Partners />
      <FeaturedCourses />
      <BecomeTrainer />
      <ExpertInstructors />
      <Testimonials />
      <CTASection />
      <Footer />
    </main>
  );
}
