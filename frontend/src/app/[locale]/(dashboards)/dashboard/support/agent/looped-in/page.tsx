import { setRequestLocale } from "next-intl/server";
import SupportAssistingSupportContent from "@/components/support-dashboard/SupportAssistingSupportContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Assisting Support | Agent Dashboard | PhysioGuidance",
};

export default async function AgentLoopedInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
      <SupportAssistingSupportContent
        detailBasePath={`/${locale}/dashboard/support/agent/tickets`}
      />
    </main>
  );
}
