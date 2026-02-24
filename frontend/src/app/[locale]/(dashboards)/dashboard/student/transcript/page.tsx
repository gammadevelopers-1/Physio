import { setRequestLocale } from "next-intl/server";
import { TranscriptContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Transcript | Student Dashboard | PhysioGuidance",
  description: "View your academic transcript and course history",
};

export default async function StudentTranscriptPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <TranscriptContent />;
}
