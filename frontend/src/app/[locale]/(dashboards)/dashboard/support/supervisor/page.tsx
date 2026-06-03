import SupervisorDashboardContent from "@/components/support-dashboard/SupervisorDashboardContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Supervisor Dashboard | PhysioGuidance" };

export default async function SupervisorDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SupervisorDashboardContent />;
}
