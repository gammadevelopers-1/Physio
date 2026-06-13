import { setRequestLocale } from "next-intl/server";
import TAAssistingSupportContent from "@/components/ta-dashboard/TAAssistingSupportContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Assisting Support | TA Dashboard | PhysioGuidance",
  description: "Tickets where Support has asked for your input",
};

export default async function TALoopedInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
      <TAAssistingSupportContent />
    </main>
  );
}
