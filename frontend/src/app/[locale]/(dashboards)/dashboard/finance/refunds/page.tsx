import { setRequestLocale } from "next-intl/server";
import { RefundsContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Refunds | Finance Dashboard | PhysioGuidance",
  description: "Process, track, and analyze refund requests",
};

export default async function RefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <RefundsContent />
    </main>
  );
}
