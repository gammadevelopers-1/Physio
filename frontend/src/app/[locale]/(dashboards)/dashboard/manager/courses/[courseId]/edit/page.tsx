import { setRequestLocale } from "next-intl/server";
import { EditCourseContent } from "@/components/course-manager-dashboard";

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

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <EditCourseContent courseId={courseId} />
    </main>
  );
}
