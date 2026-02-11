import { setRequestLocale } from "next-intl/server";
import { FavouritesContent } from "@/components/student-dashboard";

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

  return <FavouritesContent />;
}
