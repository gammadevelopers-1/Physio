import SupportSettingsContent from "@/components/support-dashboard/SupportSettingsContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Settings | Agent Dashboard" };

export default async function AgentSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SupportSettingsContent />;
}
