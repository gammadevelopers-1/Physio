import { setRequestLocale } from "next-intl/server";
import NELCComplianceCenterContent from "@/components/course-manager-dashboard/NELCComplianceCenterContent";

export const metadata = {
  title: "NELC Compliance | Course Manager Dashboard | PhysioGuidance",
  description: "Monitor NELC compliance across all courses",
};

export default async function NELCCompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <NELCComplianceCenterContent />
    </main>
  );
}
