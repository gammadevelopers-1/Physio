import TeamContent from "@/components/support-dashboard/TeamContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "Team | Supervisor Dashboard" };

export default async function SupervisorTeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.SUPPORT_TEAM} />
      <TeamContent />
    </>
  );
}
