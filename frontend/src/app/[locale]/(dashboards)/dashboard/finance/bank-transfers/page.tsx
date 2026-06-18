import { setRequestLocale } from "next-intl/server";
import { BankTransferQueueContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Bank Transfers | Finance Dashboard | PhysioGuidance",
  description: "Review uploaded bank transfer receipts and approve or reject payments",
};

export default async function BankTransfersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <BankTransferQueueContent />
    </main>
  );
}
