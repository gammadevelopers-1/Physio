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

  return <DashboardAuthGuard>{children}</DashboardAuthGuard>;
}
