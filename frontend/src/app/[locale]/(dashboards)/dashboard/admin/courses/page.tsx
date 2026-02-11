import { setRequestLocale } from "next-intl/server";
import { AdminCoursesContent } from "@/components/admin-dashboard";

export const metadata = {
  title: "All Courses | Admin Dashboard | PhysioGuidance",
  description: "Manage all platform courses",
};

export default async function CoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-[#F9FAFB]">
      <AdminCoursesContent />
    </main>
  );
}
