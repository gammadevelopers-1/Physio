import { setRequestLocale } from "next-intl/server";
import { EscalationDetailContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Escalation Detail | Admin Dashboard | PhysioGuidance",
};

export default async function EscalationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <EscalationDetailContent escalationId={id} />
    </main>
  );
}
