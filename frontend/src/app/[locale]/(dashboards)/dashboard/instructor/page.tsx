import { setRequestLocale } from "next-intl/server";
import { InstructorDashboardContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Instructor Dashboard | PhysioGuidance",
  description: "Your instructor dashboard for managing courses and students",
};

export default async function InstructorDashboardHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <InstructorDashboardContent />
    </main>
  );
}
