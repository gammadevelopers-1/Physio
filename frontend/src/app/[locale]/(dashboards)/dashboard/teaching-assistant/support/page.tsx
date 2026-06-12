import { setRequestLocale } from "next-intl/server";
import { TASupportContent } from "@/components/ta-dashboard";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Support | Teaching Assistant Dashboard | PhysioGuidance",
  description: "Submit and track support tickets for your courses, sessions, and technical issues",
};

export default async function TASupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_SUPPORT} />
      <TASupportContent />
    </main>
  );
}
