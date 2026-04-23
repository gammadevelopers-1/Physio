import { setRequestLocale } from "next-intl/server";
import { InviteFriendsContent } from "@/components/student-dashboard";

export const metadata = {
  title: "Invite Friends | Student Dashboard | PhysioGuidance",
  description: "Invite friends and earn rewards",
};

export default async function StudentInviteFriendsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <InviteFriendsContent />
    </main>
  );
}
