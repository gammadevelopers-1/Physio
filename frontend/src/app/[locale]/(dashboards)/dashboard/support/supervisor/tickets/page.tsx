import AllTicketsContent from "@/components/support-dashboard/AllTicketsContent";
import { setRequestLocale } from "next-intl/server";

export const metadata = { title: "All Tickets | Supervisor Dashboard" };

export default async function SupervisorTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AllTicketsContent />;
}
