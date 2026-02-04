import { setRequestLocale } from "next-intl/server";

export const metadata = {
  title: "My Courses | Student Dashboard | PhysioGuidance",
  description: "View and manage your enrolled courses",
};

export default async function StudentCoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      {/* Student Courses - Content will be implemented from Figma designs */}
      <div className="p-8">
        <h1 className="text-2xl font-bold">My Courses</h1>
        <p className="text-gray-600 mt-2">View and manage your enrolled courses</p>
      </div>
    </main>
  );
}
