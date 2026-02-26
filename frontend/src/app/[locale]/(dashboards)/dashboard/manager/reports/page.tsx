import { setRequestLocale } from "next-intl/server";
import { ReportsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Reports | Course Manager Dashboard | PhysioGuidance",
  description: "View analytics and generate reports",
};

export default async function CourseManagerReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <ReportsContent />
    </main>
  );
}
