import { setRequestLocale } from "next-intl/server";
import { ReportsContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Reports | Instructor Dashboard | PhysioGuidance",
  description: "Generate and export course reports",
};

export default async function InstructorReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <ReportsContent />
    </main>
  );
}
