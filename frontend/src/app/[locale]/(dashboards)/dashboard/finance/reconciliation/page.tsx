import { setRequestLocale } from "next-intl/server";
import { ReconciliationContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Reconciliation | Finance Dashboard | PhysioGuidance",
  description:
    "Detect and resolve drift between local payment records and gateway records",
};

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <ReconciliationContent />
    </main>
  );
}
