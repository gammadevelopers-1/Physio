import { setRequestLocale } from "next-intl/server";
import { ContentReviewContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Content Review | Course Manager Dashboard | PhysioGuidance",
  description: "Review and approve course content submissions",
};

export default async function CourseManagerContentReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <ContentReviewContent />
    </main>
  );
}
