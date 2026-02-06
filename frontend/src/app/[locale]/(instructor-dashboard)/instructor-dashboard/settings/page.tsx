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
    <main className="min-h-screen bg-[#F9FAFB]">
      <SettingsContent />
    </main>
  );
}
