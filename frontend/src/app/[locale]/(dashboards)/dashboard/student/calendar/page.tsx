import { setRequestLocale } from "next-intl/server";
import LecturesContent from "@/components/student-dashboard/LecturesContent";

export const metadata = {
  title: "Lectures | Student Dashboard | PhysioGuidance",
  description: "View and join your upcoming lectures",
};

export default async function StudentLecturesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <LecturesContent />
    </main>
  );
}
