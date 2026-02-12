import { setRequestLocale } from "next-intl/server";
import { FavouritesProvider } from "@/contexts/FavouritesContext";

export default async function StudentDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FavouritesProvider>{children}</FavouritesProvider>;
}
