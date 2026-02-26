import { setRequestLocale } from "next-intl/server";
import { FinanceDashboardContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Finance Dashboard | PhysioGuidance",
  description:
    "Financial overview with KPIs, revenue charts, payments, and refunds management",
};

export default async function FinanceDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <FinanceDashboardContent />
    </main>
  );
}
