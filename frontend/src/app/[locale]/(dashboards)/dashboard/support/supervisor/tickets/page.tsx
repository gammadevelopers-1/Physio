import AllTicketsContent from "@/components/support-dashboard/AllTicketsContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "All Tickets | Supervisor Dashboard" };

export default async function SupervisorTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.SUPPORT_ALL_TICKETS} />
      <AllTicketsContent />
    </>
  );
}
