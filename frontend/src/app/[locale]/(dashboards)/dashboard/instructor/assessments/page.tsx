import { setRequestLocale } from "next-intl/server";
import { AssessmentsContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Assessments | Instructor Dashboard | PhysioGuidance",
  description: "Create and manage course assessments",
};

export default async function InstructorAssessmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <AssessmentsContent />
    </main>
  );
}
