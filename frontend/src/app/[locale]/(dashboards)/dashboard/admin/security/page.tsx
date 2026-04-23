import { setRequestLocale } from "next-intl/server";
import { SecurityContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "Security | Admin Dashboard | PhysioGuidance",
  description: "Security monitoring, threat detection, and incident management",
};

export default async function SecurityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <SecurityContent />
    </main>
  );
}
