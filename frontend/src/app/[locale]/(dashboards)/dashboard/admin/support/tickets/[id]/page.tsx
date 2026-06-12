import { setRequestLocale } from "next-intl/server";
import AdminTicketDetailContent from "@/components/admin-dashboard/AdminTicketDetailContent";

export const metadata = {
  title: "Ticket | Admin Support | PhysioGuidance",
  description: "Admin-scoped ticket view",
};

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AdminTicketDetailContent />
    </main>
  );
}
