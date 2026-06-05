import { setRequestLocale } from "next-intl/server";
import { SupportReportsContent } from "@/components/support-dashboard";
import { SupervisorOnlyGuard } from "@/components/SupervisorOnlyGuard";

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
    <SupervisorOnlyGuard>
      <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
        <SupportReportsContent />
      </main>
    </SupervisorOnlyGuard>
  );
}
