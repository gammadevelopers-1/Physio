import { setRequestLocale } from "next-intl/server";
import { BillingContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Billing | Student Dashboard | PhysioGuidance",
  description:
    "Your payments, invoices, refund requests and tax information.",
};

export default async function StudentBillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)]"
    >
      <BillingContent />
    </main>
  );
}
