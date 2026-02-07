import { setRequestLocale } from "next-intl/server";
import { SessionsContent } from "@/components/course-manager-dashboard";

export const metadata = {
  title: "Sessions | Course Manager Dashboard | PhysioGuidance",
  description: "Manage all training sessions",
};

export default async function CourseManagerSessionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <SessionsContent />
    </main>
  );
}
