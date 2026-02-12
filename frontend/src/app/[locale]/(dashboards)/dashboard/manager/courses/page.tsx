import { setRequestLocale } from "next-intl/server";
import { CoursesContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Courses | Course Manager Dashboard | PhysioGuidance",
  description: "Manage all courses in the training program",
};

export default async function CourseManagerCoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <CoursesContent />
    </main>
  );
}
