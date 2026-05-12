import { setRequestLocale } from "next-intl/server";
import { InstructorCourseReviewsContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Course Reviews | Instructor Dashboard | PhysioGuidance",
  description: "All reviews for this course",
};

export default async function InstructorCourseReviewsPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <InstructorCourseReviewsContent courseId={courseId} />
    </main>
  );
}
