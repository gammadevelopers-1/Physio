import { setRequestLocale } from "next-intl/server";
import { ManagerAllReviewsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Reviews | Course Manager Dashboard | PhysioGuidance",
  description: "Moderate student reviews across all your courses",
};

export default async function ManagerReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <ManagerAllReviewsContent />
    </main>
  );
}
