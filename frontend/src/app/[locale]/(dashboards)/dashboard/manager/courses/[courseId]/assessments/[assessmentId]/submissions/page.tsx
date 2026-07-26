import { setRequestLocale } from "next-intl/server";
import AssessmentSubmissionsContent from "@/components/admin-dashboard/assessments/AssessmentSubmissionsContent";

export const metadata = {
  title: "Assessment Submissions | Manager Dashboard | PhysioGuidance",
  description: "Review every student's submission for an assessment",
};

/**
 * Manager parallel to the admin `/assessments/[assessmentId]/submissions`
 * page. Uses the same content component — the same view is correct for
 * both roles, and manager access is enforced by the API not the URL.
 */
export default async function ManagerAssessmentSubmissionsPage({
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
