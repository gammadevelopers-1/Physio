import { setRequestLocale } from "next-intl/server";
import { EditCourseContent } from "@/components/course-manager-dashboard";
import { fetchHeadingDefaults } from "@/lib/course-heading-defaults";

export const metadata = {
  title: "Edit Course | Course Manager Dashboard | PhysioGuidance",
  description: "Edit course details",
};

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  setRequestLocale(locale);

  const headingDefaults = await fetchHeadingDefaults();

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <EditCourseContent courseId={courseId} headingDefaults={headingDefaults} />
    </main>
  );
}
