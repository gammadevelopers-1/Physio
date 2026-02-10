import { setRequestLocale } from "next-intl/server";
import { SupportDashboardContent } from "@/components/support-dashboard";

export const metadata = {
  title: "Support Dashboard | PhysioGuidance",
  description:
    "Support overview with KPIs, tickets board, SLA metrics, and CSAT scores",
};

export default async function SupportDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <SupportDashboardContent />
    </main>
  );
}
