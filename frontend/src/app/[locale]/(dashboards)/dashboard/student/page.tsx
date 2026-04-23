import { setRequestLocale } from "next-intl/server";
import { DashboardHomeContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Student Dashboard | PhysioGuidance",
  description: "Your personal learning dashboard",
};

export default async function StudentDashboardHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <DashboardHomeContent />
    </main>
  );
}
