import { setRequestLocale } from "next-intl/server";
import { AdminDashboardContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Admin Dashboard | PhysioGuidance",
  description: "Platform-wide oversight, governance, security, and compliance management",
};

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <AdminDashboardContent />
    </main>
  );
}
