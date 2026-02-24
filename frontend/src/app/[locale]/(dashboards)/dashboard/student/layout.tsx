import { setRequestLocale } from "next-intl/server";
import { FavouritesProvider } from "@/contexts/FavouritesContext";
import PreferencesProvider from "@/components/student-dashboard/PreferencesProvider";

export default async function StudentDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <FavouritesProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </FavouritesProvider>
  );
}
