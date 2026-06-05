import { setRequestLocale } from "next-intl/server";
import { AlertsPageContent } from "@/components/support-dashboard";

export const metadata = {
  title: "Alerts | Support Dashboard | PhysioGuidance",
  description: "All open alerts across the support queue",
};

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AlertsPageContent />
    </main>
  );
}
