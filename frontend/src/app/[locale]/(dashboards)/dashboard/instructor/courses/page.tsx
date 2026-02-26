import { setRequestLocale } from "next-intl/server";
import { MyCoursesContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "My Courses | Instructor Dashboard | PhysioGuidance",
  description: "Manage your assigned courses",
};

export default async function InstructorCoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <MyCoursesContent />
    </main>
  );
}
