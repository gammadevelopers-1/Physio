import { setRequestLocale } from "next-intl/server";
import AdminMonitoringContent from "@/components/admin-dashboard/AdminMonitoringContent";

export const metadata = {
  title: "Monitoring | Admin Dashboard | PhysioGuidance",
  description: "Live infrastructure health, background jobs, and resource pressure",
};

export default async function AdminMonitoringPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AdminMonitoringContent />
    </main>
  );
}
