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
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AssessmentsContent />
    </main>
  );
}
