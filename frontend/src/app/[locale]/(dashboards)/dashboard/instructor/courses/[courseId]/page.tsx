import { setRequestLocale } from "next-intl/server";
import { CourseDetailContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Course Details | Instructor Dashboard | PhysioGuidance",
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
    <main className="min-h-screen bg-[#F9FAFB]">
      <CourseDetailContent courseId={courseId} />
    </main>
  );
}
