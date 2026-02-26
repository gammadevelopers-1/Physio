import { setRequestLocale } from "next-intl/server";
import { AssessmentsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Assessments | Course Manager Dashboard | PhysioGuidance",
  description: "Manage course assessments and quizzes",
};

export default async function CourseManagerAssessmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <AssessmentsContent />
    </main>
  );
}
