import SupportReportsContent from "@/components/support-dashboard/SupportReportsContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Reports | Supervisor Dashboard" };

export default async function SupervisorReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SupportReportsContent />;
}
