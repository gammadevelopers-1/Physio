import { setRequestLocale } from "next-intl/server";
import { FinanceSupportContent } from "@/components/finance-dashboard";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Support | Finance Dashboard | PhysioGuidance",
  description: "Submit and track support tickets for payments, invoices, refunds, and integrations",
};

export default async function FinanceSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_SUPPORT} />
      <FinanceSupportContent />
    </main>
  );
}
