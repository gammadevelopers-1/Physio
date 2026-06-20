import { setRequestLocale } from "next-intl/server";
import { AdminFinanceShell } from "@/components/admin-dashboard";

export const metadata = {
  title: "Finance | Admin Dashboard | PhysioGuidance",
  description: "Admin super-view of payments, refunds, reconciliation, and escalations",
};

export default async function FinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AdminFinanceShell />
    </main>
  );
}
