"use client";

import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";
import { useLocale } from "next-intl";

export default function InstructorAssistingSupportContent() {
  const instructor = useInstructorProfile();
  const locale = useLocale();

  return (
    <>
      <InstructorNavbar instructor={instructor} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />
            <div className="flex-1 min-w-0">
              <LoopedInTickets
                detailBasePath={`/${locale}/dashboard/instructor/support`}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
