import { setRequestLocale } from "next-intl/server";
import { FinanceContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Finance | Admin Dashboard | PhysioGuidance",
  description: "Financial management, revenue, and payments",
};

export default async function FinancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <FinanceContent />
    </main>
  );
}
