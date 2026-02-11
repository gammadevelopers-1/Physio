import { setRequestLocale } from "next-intl/server";
import { DiscountsContent } from "@/components/finance-dashboard";

export const metadata = {
  title: "Discounts | Finance Dashboard | PhysioGuidance",
  description: "Create and manage coupons, track usage analytics",
};

export default async function DiscountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <DiscountsContent />
    </main>
  );
}
