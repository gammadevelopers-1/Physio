//page.tsx
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Partners from "@/components/Partners";
import FeaturedCourses from "@/components/FeaturedCourses";
import BecomeTrainer from "@/components/BecomeTrainer";
import ExpertInstructors from "@/components/ExpertInstructors";
import Testimonials from "@/components/Testimonials";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar />
      <Hero />
      <Partners />
      <FeaturedCourses />
      <BecomeTrainer />
      <ExpertInstructors />
      <Testimonials />
      {/* CTASection and Footer only shown on desktop (1024px+) */}
      <div className="hidden lg:block">
        <CTASection />
        <Footer />
      </div>
      <WhatsAppButton />
    </main>
  );
}
