import { setRequestLocale } from "next-intl/server";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";
import MarkTabViewed from "@/components/MarkTabViewed";
import { SIDEBAR_TAB_KEYS } from "@/lib/api";

export const metadata = {
  title: "Assisting Support | Supervisor Dashboard | PhysioGuidance",
};

export default async function SupervisorLoopedInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)] py-6"
    >
      <MarkTabViewed tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
      <div className="max-w-3xl mx-auto px-4">
        <LoopedInTickets
          detailBasePath={`/${locale}/dashboard/support/supervisor/tickets`}
        />
      </div>
    </main>
  );
}
