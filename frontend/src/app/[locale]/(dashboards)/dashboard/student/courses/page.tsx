import { setRequestLocale } from "next-intl/server";
import { MyCoursesContent } from "@/components/student-dashboard";

export const metadata = {
  title: "My Courses | Student Dashboard | PhysioGuidance",
  description: "View and manage your enrolled courses",
};

export default async function StudentCoursesPage({
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
