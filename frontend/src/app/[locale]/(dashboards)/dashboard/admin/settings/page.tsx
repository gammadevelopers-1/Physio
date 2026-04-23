import { setRequestLocale } from "next-intl/server";
import { AdminSettingsContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Settings | Admin Dashboard | PhysioGuidance",
  description: "Platform configuration and settings management",
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <AdminSettingsContent />
    </main>
  );
}
