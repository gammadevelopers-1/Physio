import { setRequestLocale } from "next-intl/server";
import { InstructorsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Instructors | Course Manager Dashboard | PhysioGuidance",
  description: "Manage instructors and their assignments",
};

export default async function CourseManagerInstructorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <InstructorsContent />
    </main>
  );
}
