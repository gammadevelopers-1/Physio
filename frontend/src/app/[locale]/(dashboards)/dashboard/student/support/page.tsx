import { setRequestLocale } from "next-intl/server";
import { SupportContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Support | Student Dashboard | PhysioGuidance",
  description: "Submit and manage support tickets",
};

export default async function StudentSupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <SupportContent />
    </main>
  );
}
