import { setRequestLocale } from "next-intl/server";
import { InstructorSupportContent } from "@/components/instructor-dashboard";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Support | Instructor Dashboard | PhysioGuidance",
  description: "Submit and track support tickets for your courses, webinars, CME, and trainer applications",
};

export default async function InstructorSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_SUPPORT} />
      <InstructorSupportContent />
    </main>
  );
}
