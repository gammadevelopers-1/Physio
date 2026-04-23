import { setRequestLocale } from "next-intl/server";
import TACoursesList from "@/components/ta-dashboard/TACoursesList";
import TASidebar from "@/components/ta-dashboard/TASidebar";
import TANavbar from "@/components/ta-dashboard/TANavbar";

export const metadata = {
  title: "My Courses | Teaching Assistant Dashboard",
  description: "View your assigned courses",
};

export default async function TACoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <TANavbar />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <TASidebar />
          </div>
          <div className="flex-1 min-w-0">
            <TACoursesList />
          </div>
        </div>
      </div>
    </main>
  );
}
