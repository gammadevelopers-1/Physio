import { setRequestLocale } from "next-intl/server";
import { CourseManagerCourseDetailContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Course Details | Course Manager Dashboard | PhysioGuidance",
  description: "View and manage course details",
};

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <CourseManagerCourseDetailContent courseId={courseId} />
    </main>
  );
}
