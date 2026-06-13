import { setRequestLocale } from "next-intl/server";
import InstructorAssistingSupportContent from "@/components/instructor-dashboard/InstructorAssistingSupportContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Assisting Support | Instructor Dashboard | PhysioGuidance",
  description: "Tickets where Support has asked for your input",
};

export default async function InstructorLoopedInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
      <InstructorAssistingSupportContent />
    </main>
  );
}
