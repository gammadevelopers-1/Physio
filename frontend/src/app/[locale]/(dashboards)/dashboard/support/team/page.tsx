import { setRequestLocale } from "next-intl/server";
import { TeamContent } from "@/components/support-dashboard";
import { SupervisorOnlyGuard } from "@/components/SupervisorOnlyGuard";

export const metadata = {
  title: "Team | Support Dashboard | PhysioGuidance",
  description: "Team management and performance monitoring",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <SupervisorOnlyGuard>
      <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
        <TeamContent />
      </main>
    </SupervisorOnlyGuard>
  );
}
