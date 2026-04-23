import { setRequestLocale } from "next-intl/server";
import { ReportsContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Reports | Admin Dashboard | PhysioGuidance",
  description: "Generate and manage platform reports",
};

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <ReportsContent />
    </main>
  );
}
