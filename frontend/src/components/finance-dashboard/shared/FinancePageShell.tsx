"use client";

import { ReactNode } from "react";
import FinanceSidebar from "../FinanceSidebar";
import FinanceMobileSidebar from "../FinanceMobileSidebar";
import FinanceNavbar from "../FinanceNavbar";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

/**
 * Standard finance-dashboard page chrome (navbar + sidebar + page-bg wrapper).
 * Used by the *Content components so each one doesn't re-implement the same
 * shell. Admin embeds the inner content directly (without this shell) by
 * passing `embedded` to the *Content component.
 */
export default function FinancePageShell({ children }: { children: ReactNode }) {
  const profile = useFinanceProfile();
  return (
    <>
      <FinanceNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>
            <FinanceMobileSidebar profile={profile} />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}
