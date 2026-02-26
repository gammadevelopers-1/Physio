import { setRequestLocale } from "next-intl/server";
import { TeamContent } from "@/components/support-dashboard";

export const metadata = {
  title: "Team | Support Dashboard | PhysioGuidance",
  description: "Team management and performance monitoring",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <TeamContent />
    </main>
  );
}
