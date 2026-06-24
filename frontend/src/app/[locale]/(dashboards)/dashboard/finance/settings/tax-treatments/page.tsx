import { setRequestLocale } from "next-intl/server";
import { VatTreatmentsContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Per-Product VAT | Finance Settings | PhysioGuidance",
  description:
    "Configure VAT treatment per course (standard, exempt, zero-rated)",
};

export default async function VatTreatmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <VatTreatmentsContent />
    </main>
  );
}
