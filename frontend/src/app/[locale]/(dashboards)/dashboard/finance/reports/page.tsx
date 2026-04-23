import { setRequestLocale } from "next-intl/server";
import { FinanceReportsContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Reports | Finance Dashboard | PhysioGuidance",
  description:
    "Generate and export financial reports for analysis and audits",
};

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <FinanceReportsContent />
    </main>
  );
}
