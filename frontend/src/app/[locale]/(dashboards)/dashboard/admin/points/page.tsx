import { setRequestLocale } from "next-intl/server";
import { PointsSystemContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Points System | Admin Dashboard | PhysioGuidance",
  description: "Configure earn rules, redemption settings, and audit user points",
};

export default async function AdminPointsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <PointsSystemContent />
    </main>
  );
}
