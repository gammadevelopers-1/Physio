import { setRequestLocale } from "next-intl/server";

export const metadata = {
  title: "Favourites | Student Dashboard | PhysioGuidance",
  description: "Your saved favourite courses",
};

export default async function StudentFavouritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main>
      {/* Student Favourites - Content will be implemented from Figma designs */}
      <div className="p-8">
        <h1 className="text-2xl font-bold">Favourites</h1>
        <p className="text-gray-600 mt-2">Your saved favourite courses</p>
      </div>
    </main>
  );
}
