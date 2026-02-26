import { setRequestLocale } from "next-intl/server";
import { StudentsContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Students | Instructor Dashboard | PhysioGuidance",
  description: "View and manage all students enrolled in your courses",
};

export default async function InstructorStudentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <StudentsContent />
    </main>
  );
}
