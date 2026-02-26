import { setRequestLocale } from "next-intl/server";
import { SupportReportsContent } from "@/components/support-dashboard";

export const metadata = {
  title: "Reports | Support Dashboard | PhysioGuidance",
  description: "Support analytics and performance reports",
};

export default async function SupportReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <SupportReportsContent />
    </main>
  );
}
