import { setRequestLocale } from "next-intl/server";
import { SettingsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Settings | Course Manager Dashboard | PhysioGuidance",
  description: "Manage your account settings and preferences",
};

export default async function CourseManagerSettingsPage({
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
