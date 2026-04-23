import { setRequestLocale } from "next-intl/server";
import { CourseReviewsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Course Reviews | Course Manager Dashboard | PhysioGuidance",
  description: "All reviews for this course",
};

export default async function CourseReviewsPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <CourseReviewsContent courseId={courseId} />
    </main>
  );
}
