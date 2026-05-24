import { setRequestLocale } from "next-intl/server";
import { EditCourseContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Edit Course | Admin Dashboard | PhysioGuidance",
  description: "Edit course details",
};

export default async function AdminEditCoursePage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <EditCourseContent courseId={courseId} role="admin" />
    </main>
  );
}
