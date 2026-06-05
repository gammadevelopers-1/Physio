import { setRequestLocale } from "next-intl/server";
import { SupervisorOnlyGuard } from "@/components/SupervisorOnlyGuard";

// All /dashboard/support/supervisor/* routes must be supervisor-only.
// The outer DashboardAuthGuard already gates by SUPPORT role; this
// layout adds the sub-role check so agents who manually navigate to a
// supervisor URL get redirected to their own dashboard.
export default async function SupervisorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SupervisorOnlyGuard>{children}</SupervisorOnlyGuard>;
}
