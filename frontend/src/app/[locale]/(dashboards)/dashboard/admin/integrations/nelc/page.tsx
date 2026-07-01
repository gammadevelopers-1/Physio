import { setRequestLocale } from "next-intl/server";
import { NelcIntegrationContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "NELC Integration | Admin Dashboard | PhysioGuidance",
  description: "NELC LRS xAPI transmission monitoring",
};

export default async function NelcIntegrationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <NelcIntegrationContent />
    </main>
  );
}
