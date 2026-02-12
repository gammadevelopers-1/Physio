import { setRequestLocale } from "next-intl/server";
import SecuritySettingsContent from "@/components/SecuritySettingsContent";

export const metadata = {
  title: "Security Settings | PhysioGuidance",
  description: "Manage two-factor authentication and trusted devices",
};

export default async function SecuritySettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <SecuritySettingsContent />
    </main>
  );
}
