"use client";

import { useLocale } from "next-intl";
import FinanceNavbar from "./FinanceNavbar";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";

/**
 * Finance → "Assisting Support" page wrapper.
 *
 * Mounts the finance dashboard chrome (navbar + sidebar) around the
 * shared LoopedInTickets inbox so the list looks like every other
 * finance page. Uses `useFinanceProfile` — same real-user profile the
 * rest of the finance dashboard uses — instead of a mock, so the
 * navbar and sidebar keep showing the actual logged-in finance user.
 */
export default function FinanceAssistingSupportContent() {
  const profile = useFinanceProfile();
  const locale = useLocale();

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
