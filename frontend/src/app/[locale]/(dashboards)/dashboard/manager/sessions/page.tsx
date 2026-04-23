import { setRequestLocale } from "next-intl/server";
import { SessionsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Lectures | Course Manager Dashboard | PhysioGuidance",
  description: "Manage all training lectures",
};

export default async function CourseManagerSessionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <SessionsContent />
    </main>
  );
}
