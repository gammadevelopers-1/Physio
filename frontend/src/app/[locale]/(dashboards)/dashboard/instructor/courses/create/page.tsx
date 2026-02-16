import { setRequestLocale } from "next-intl/server";
import { CreateCourseContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Create Course | Instructor Dashboard | PhysioGuidance",
  description: "Create a new course",
};

export default async function CreateCoursePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <CreateCourseContent />
    </main>
  );
}
