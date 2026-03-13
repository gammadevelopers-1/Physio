import { setRequestLocale } from "next-intl/server";
import TADashboardContent from "@/components/ta-dashboard/TADashboardContent";

export const metadata = {
  title: "My Sessions | Teaching Assistant Dashboard",
  description: "View your assigned sessions",
};

export default async function TASessionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <TADashboardContent initialView="sessions" />
    </main>
  );
}
