import { setRequestLocale } from "next-intl/server";
import { SupervisorAlertsPageContent } from "@/components/support-dashboard";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Alerts | Supervisor Dashboard | PhysioGuidance",
  description:
    "Cross-team support alerts — SLA breaches, escalations, admin setting changes, and team actions",
};

export default async function SupervisorAlertsPage({
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
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.SUPPORT_ALERTS} />
      <SupervisorAlertsPageContent />
    </main>
  );
}
