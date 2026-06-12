import { setRequestLocale } from "next-intl/server";
import { SupportContent } from "@/components/student-dashboard";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Support | Student Dashboard | PhysioGuidance",
  description: "Submit and manage support tickets",
};

export default async function StudentSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_SUPPORT} />
      <SupportContent />
    </main>
  );
}
