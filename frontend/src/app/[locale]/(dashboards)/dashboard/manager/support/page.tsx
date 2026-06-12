import { setRequestLocale } from "next-intl/server";
import { CourseManagerSupportContent } from "@/components/course-manager-dashboard";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Support | Course Manager Dashboard | PhysioGuidance",
  description: "Submit and track support tickets for course approvals, content review, certificates, and system issues",
};

export default async function CourseManagerSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_SUPPORT} />
      <CourseManagerSupportContent />
    </main>
  );
}
