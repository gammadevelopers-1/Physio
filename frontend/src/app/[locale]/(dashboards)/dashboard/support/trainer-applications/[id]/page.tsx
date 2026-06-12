import { setRequestLocale } from "next-intl/server";
import TrainerApplicationDetailContent from "@/components/support-dashboard/TrainerApplicationDetailContent";

export const metadata = {
  title: "Trainer Application | Support Dashboard | PhysioGuidance",
  description:
    "Read-only detail of a trainer application — applicant info, documents, missing requirements, full review history.",
};

export default async function SupportTrainerApplicationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <TrainerApplicationDetailContent applicationId={id} />;
}
