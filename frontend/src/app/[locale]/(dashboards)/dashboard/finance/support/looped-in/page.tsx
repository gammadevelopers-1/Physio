import { setRequestLocale } from "next-intl/server";
import FinanceAssistingSupportContent from "@/components/finance-dashboard/FinanceAssistingSupportContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Assisting Support | Finance Dashboard | PhysioGuidance",
  description: "Tickets where Support has asked for your input",
};

export default async function FinanceLoopedInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
      <FinanceAssistingSupportContent />
    </main>
  );
}
