import AgentDashboardContent from "@/components/support-dashboard/AgentDashboardContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Agent Dashboard | PhysioGuidance" };

export default async function AgentDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AgentDashboardContent />;
}
