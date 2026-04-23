import { setRequestLocale } from "next-intl/server";
import { TASettingsContent } from "@/components/ta-dashboard";

export const metadata = {
  title: "Settings | TA Dashboard | PhysioGuidance",
  description: "Manage your teaching assistant account settings",
};

export default async function TASettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <TASettingsContent />
    </main>
  );
}
