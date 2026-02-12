import { setRequestLocale } from "next-intl/server";
import { PaymentsContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Payments | Finance Dashboard | PhysioGuidance",
  description: "Manage all transactions and payment processing",
};

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <PaymentsContent />
    </main>
  );
}
