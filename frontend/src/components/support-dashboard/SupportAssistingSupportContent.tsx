"use client";

import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";

interface Props {
  /** Where ticket rows deep-link to. Different per support sub-role:
   *    agent      → /dashboard/support/agent/tickets
   *    supervisor → /dashboard/support/supervisor/tickets
   */
  detailBasePath: string;
}

export default function SupportAssistingSupportContent({ detailBasePath }: Props) {
  const profile = useSupportProfile();

  return (
    <>
      <SupportNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} />
            </div>
            <div className="flex-1 min-w-0">
              <LoopedInTickets detailBasePath={detailBasePath} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
