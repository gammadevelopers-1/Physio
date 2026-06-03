import MyTicketsContent from "@/components/support-dashboard/MyTicketsContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "My Tickets | Supervisor Dashboard" };

export default async function SupervisorMyTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyTicketsContent />;
}
