import { setRequestLocale } from "next-intl/server";
import { AllTicketsContent } from "@/components/support-dashboard";
import { SupervisorOnlyGuard } from "@/components/SupervisorOnlyGuard";

export const metadata = {
  title: "All Tickets | Support Dashboard | PhysioGuidance",
  description: "Manage and track all support tickets",
};

export default async function AllTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <SupervisorOnlyGuard>
      <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
        <AllTicketsContent />
      </main>
    </SupervisorOnlyGuard>
  );
}
