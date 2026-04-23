import { setRequestLocale } from "next-intl/server";
import { BadgesContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Badges | Student Dashboard | PhysioGuidance",
  description: "View and earn your badges",
};

export default async function StudentBadgesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <BadgesContent />
    </main>
  );
}
