import { setRequestLocale } from "next-intl/server";
import { DashboardAuthGuard } from "@/components/DashboardAuthGuard";

export default async function DashboardsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Cross-dashboard IncidentBanner is mounted inside each role's
  // Navbar (Student/Instructor/CM/TA/Finance) so it sits below the
  // navbar bar rather than above all dashboard chrome.
  return <DashboardAuthGuard>{children}</DashboardAuthGuard>;
}
