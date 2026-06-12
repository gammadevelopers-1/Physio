import { setRequestLocale } from "next-intl/server";
import TrainerApplicationsListContent from "@/components/support-dashboard/TrainerApplicationsListContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Trainer Applications | Support Dashboard | PhysioGuidance",
  description:
    "Read-only view of trainer application submissions, status, and review history.",
};

export default async function SupportTrainerApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.SUPPORT_TRAINER_APPS} />
      <TrainerApplicationsListContent />
    </>
  );
}
