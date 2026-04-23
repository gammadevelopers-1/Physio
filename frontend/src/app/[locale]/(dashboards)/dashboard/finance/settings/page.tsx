import { setRequestLocale } from "next-intl/server";
import { FinanceSettingsContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Settings | Finance Dashboard | PhysioGuidance",
  description:
    "Configure payment gateways, currency, tax, and refund policies",
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <FinanceSettingsContent />
    </main>
  );
}
