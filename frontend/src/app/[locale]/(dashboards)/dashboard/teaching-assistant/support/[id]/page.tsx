import { setRequestLocale } from "next-intl/server";
import CollaboratorTicketView from "@/components/support-shared/CollaboratorTicketView";

export const metadata = {
  title: "Ticket | TA Dashboard | PhysioGuidance",
  description: "View a ticket where Support has looped you in for input",
};

export default async function TATicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CollaboratorTicketView backHref={`/${locale}/dashboard/teaching-assistant/support/looped-in`} />;
}
