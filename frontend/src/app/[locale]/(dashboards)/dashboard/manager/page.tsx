import { setRequestLocale } from "next-intl/server";
import { CourseManagerDashboardContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Course Manager Dashboard | PhysioGuidance",
  description: "Manage courses, instructors, and NELC compliance",
};

export default async function CourseManagerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <CourseManagerDashboardContent />
    </main>
  );
}
