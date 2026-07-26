import { setRequestLocale } from "next-intl/server";
import { MyRewardsContent } from "@/components/student-dashboard";

export const metadata = {
  title: "My Rewards | Student Dashboard | PhysioGuidance",
  description: "Track every reward you've unlocked with your points",
};

export default async function StudentMyRewardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MyRewardsContent />
    </main>
  );
}
