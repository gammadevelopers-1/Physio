import { setRequestLocale } from "next-intl/server";
import AdminAssistingSupportContent from "@/components/admin-dashboard/AdminAssistingSupportContent";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Assisting Support | Admin Dashboard | PhysioGuidance",
  description: "Tickets where Support has asked for your input",
};

export default async function AdminLoopedInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="main-content" className="min-h-screen">
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
      <AdminAssistingSupportContent />
    </main>
  );
}
