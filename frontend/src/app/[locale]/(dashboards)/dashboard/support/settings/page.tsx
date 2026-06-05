import { setRequestLocale } from "next-intl/server";
import { SupportSettingsContent } from "@/components/support-dashboard";
import { SupervisorOnlyGuard } from "@/components/SupervisorOnlyGuard";

export const metadata = {
  title: "Settings | Support Dashboard | PhysioGuidance",
  description: "Configure support workflows and automation",
};

export default async function SupportSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <SupervisorOnlyGuard>
      <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
        <SupportSettingsContent />
      </main>
    </SupervisorOnlyGuard>
  );
}
