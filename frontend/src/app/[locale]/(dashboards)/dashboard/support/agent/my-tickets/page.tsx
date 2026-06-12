import MyTicketsContent from "@/components/support-dashboard/MyTicketsContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "My Tickets | Agent Dashboard" };

export default async function AgentMyTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.SUPPORT_MY_TICKETS} />
      <MyTicketsContent />
    </>
  );
}
