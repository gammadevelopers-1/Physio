import SupportSettingsContent from "@/components/support-dashboard/SupportSettingsContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Settings | Supervisor Dashboard" };

export default async function SupervisorSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SupportSettingsContent />;
}
