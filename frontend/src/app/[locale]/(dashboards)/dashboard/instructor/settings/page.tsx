import { setRequestLocale } from "next-intl/server";
import { SettingsContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Settings | Instructor Dashboard | PhysioGuidance",
  description: "Manage your instructor account settings",
};

export default async function InstructorSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <SettingsContent />
    </main>
  );
}
