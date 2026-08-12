import { setRequestLocale } from "next-intl/server";
import { CreateCourseContent } from "@/components/course-manager-dashboard";
import { fetchHeadingDefaults } from "@/lib/course-heading-defaults";

export const metadata = {
  title: "Create Course | Course Manager Dashboard | PhysioGuidance",
  description: "Create a new course and assign it to an instructor",
};

export default async function CreateCoursePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const headingDefaults = await fetchHeadingDefaults();

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <CreateCourseContent headingDefaults={headingDefaults} />
    </main>
  );
}
