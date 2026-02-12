import { setRequestLocale } from "next-intl/server";
import { SessionsContent } from "@/components/instructor-dashboard";

export const metadata = {
  title: "Sessions | Instructor Dashboard | PhysioGuidance",
  description: "Schedule and manage live sessions",
};

export default async function InstructorSessionsPage({
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
