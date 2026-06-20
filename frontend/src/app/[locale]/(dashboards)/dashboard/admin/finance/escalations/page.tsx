import { setRequestLocale } from "next-intl/server";
import { EscalationsContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Reconciliation Escalations | Admin Dashboard | PhysioGuidance",
  description: "Finance-escalated reconciliation drifts that need admin action",
};

export default async function EscalationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <EscalationsContent />
    </main>
  );
}
