import { setRequestLocale } from "next-intl/server";
import CalendarContent from "@/components/student-dashboard/CalendarContent";

export const metadata = {
  title: "Calendar | Student Dashboard | PhysioGuidance",
  description: "View your upcoming sessions and events calendar",
};

export default async function StudentCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <CalendarContent />
    </main>
  );
}
