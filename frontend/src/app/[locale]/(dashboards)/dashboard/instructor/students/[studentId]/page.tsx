import { setRequestLocale } from "next-intl/server";
import { StudentDetailContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Student Profile | Instructor Dashboard | PhysioGuidance",
  description: "View detailed student profile and progress",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; studentId: string }>;
}) {
  const { locale, studentId } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <StudentDetailContent studentId={studentId} />
    </main>
  );
}
