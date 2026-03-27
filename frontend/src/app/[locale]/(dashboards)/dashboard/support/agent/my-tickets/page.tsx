import MyTicketsContent from "@/components/support-dashboard/MyTicketsContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "My Tickets | Agent Dashboard" };

export default async function AgentMyTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyTicketsContent />;
}
