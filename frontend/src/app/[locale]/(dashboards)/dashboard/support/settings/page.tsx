import { setRequestLocale } from "next-intl/server";
import { SupportSettingsContent } from "@/components/support-dashboard";

export const metadata = {
  title: "Settings | Support Dashboard | PhysioGuidance",
  description: "Configure support workflows and automation",
};

export default async function SupportSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <SupportSettingsContent />
    </main>
  );
}
