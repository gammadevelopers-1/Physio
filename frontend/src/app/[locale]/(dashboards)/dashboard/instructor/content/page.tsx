import { setRequestLocale } from "next-intl/server";
import { ContentManagementContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Content | Instructor Dashboard | PhysioGuidance",
  description: "Manage course content and media files",
};

export default async function InstructorContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <ContentManagementContent />
    </main>
  );
}
