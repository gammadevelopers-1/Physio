"use client";

import TANavbar from "./TANavbar";
import TASidebar from "./TASidebar";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";
import { useLocale } from "next-intl";

export default function TAAssistingSupportContent() {
  const locale = useLocale();

  return (
    <>
      <TANavbar />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <TASidebar />
            </div>
            <div className="flex-1 min-w-0">
              <LoopedInTickets
                detailBasePath={`/${locale}/dashboard/teaching-assistant/support`}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
