import TeamContent from "@/components/support-dashboard/TeamContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Team | Supervisor Dashboard" };

export default async function SupervisorTeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TeamContent />;
}
