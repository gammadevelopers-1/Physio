import { setRequestLocale } from "next-intl/server";
import { MyPointsContent } from "@/components/student-dashboard";

export const metadata = {
  title: "My Points | Student Dashboard | PhysioGuidance",
  description: "Track your points balance and redeem rewards",
};

export default async function StudentMyPointsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <MyPointsContent />
    </main>
  );
}
