import { setRequestLocale } from "next-intl/server";
import AssessmentSubmissionsContent from "@/components/admin-dashboard/assessments/AssessmentSubmissionsContent";

export const metadata = {
  title: "Assessment Submissions | Admin Dashboard | PhysioGuidance",
  description: "Review every student's submission for an assessment",
};

export default async function AdminAssessmentSubmissionsPage({
  params,
}: {
  params: Promise<{ locale: string; courseId: string; assessmentId: string }>;
}) {
  const { locale, courseId, assessmentId } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AssessmentSubmissionsContent courseId={courseId} assessmentId={assessmentId} />
    </main>
  );
}
