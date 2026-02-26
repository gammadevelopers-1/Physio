import { setRequestLocale } from "next-intl/server";
import { SettingsContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Settings | Student Dashboard | PhysioGuidance",
  description: "Manage your account settings",
};

export default async function StudentSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <SettingsContent />
    </main>
  );
}
