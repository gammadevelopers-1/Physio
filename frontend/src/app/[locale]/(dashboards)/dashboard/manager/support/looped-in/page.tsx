import { setRequestLocale } from "next-intl/server";
import CourseManagerAssistingSupportContent from "@/components/course-manager-dashboard/CourseManagerAssistingSupportContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Assisting Support | Course Manager Dashboard | PhysioGuidance",
  description: "Tickets where Support has asked for your input",
};

export default async function ManagerLoopedInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
      <CourseManagerAssistingSupportContent />
    </main>
  );
}
