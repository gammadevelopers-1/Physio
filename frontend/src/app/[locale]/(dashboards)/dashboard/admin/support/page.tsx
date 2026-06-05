import { setRequestLocale } from "next-intl/server";
import AdminSupportContent from "@/components/admin-dashboard/AdminSupportContent";

export const metadata = {
  title: "Support | Admin Dashboard | PhysioGuidance",
  description: "Manage support team requests",
};

export default async function AdminSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AdminSupportContent />
    </main>
  );
}
