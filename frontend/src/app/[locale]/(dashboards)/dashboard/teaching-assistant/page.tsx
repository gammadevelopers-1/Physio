import { setRequestLocale } from "next-intl/server";
import TADashboardContent from "@/components/ta-dashboard/TADashboardContent";

export const metadata = {
  title: "Teaching Assistant Dashboard | PhysioGuidance",
  description: "Your teaching assistant dashboard for viewing assigned sessions",
};

export default async function TADashboardHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <TADashboardContent />
    </main>
  );
}
