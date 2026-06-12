import { setRequestLocale } from "next-intl/server";
import { AlertsPageContent } from "@/components/support-dashboard";

// Agent's alerts view reuses the existing AlertsPageContent — agents
// only see alerts scoped to their own assigned tickets (no cross-team
// breach visibility, no admin setting changes). The supervisor route
// has its own widened view.
export const metadata = {
  title: "Alerts | Agent Dashboard | PhysioGuidance",
  description: "Alerts on my assigned tickets",
};

export default async function AgentAlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)]"
    >
      <AlertsPageContent />
    </main>
  );
}
