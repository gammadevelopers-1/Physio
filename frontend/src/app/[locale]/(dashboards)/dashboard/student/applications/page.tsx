import { setRequestLocale } from "next-intl/server";
import ApplicationsContent from "@/components/student-dashboard/ApplicationsContent";

export const metadata = {
  title: "My Applications | Student Dashboard | PhysioGuidance",
  description: "View your role application status and history",
};

export default async function StudentApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <ApplicationsContent />
    </main>
  );
}
