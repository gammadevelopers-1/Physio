import { setRequestLocale } from "next-intl/server";
import AdminSupervisorDetailContent from "@/components/admin-dashboard/AdminSupervisorDetailContent";

export const metadata = {
  title: "Supervisor | Admin Support | PhysioGuidance",
  description: "Admin-scoped supervisor + team performance view",
};

export default async function AdminSupervisorDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AdminSupervisorDetailContent />
    </main>
  );
}
