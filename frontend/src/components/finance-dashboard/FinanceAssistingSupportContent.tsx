"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import FinanceNavbar from "./FinanceNavbar";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";

// Mirror of the mockProfile shape used by FinanceDashboardContent —
// the chrome's FinanceProfile type expects these exact fields. We
// only really need name/email for the navbar avatar; the rest are
// inherited so TypeScript stays happy.
const FINANCE_MOCK = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

export default function FinanceAssistingSupportContent() {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const profile = { ...FINANCE_MOCK, name: t("names.noraAlFahad") };

  return (
    <>
      <FinanceNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>
            <FinanceMobileSidebar profile={profile} />
            <div className="flex-1 min-w-0">
              <LoopedInTickets
                detailBasePath={`/${locale}/dashboard/finance/support`}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
