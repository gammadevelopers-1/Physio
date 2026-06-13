"use client";

import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import LoopedInTickets from "@/components/support-shared/LoopedInTickets";
import { useLocale } from "next-intl";

/**
 * Course Manager → "Assisting Support" page wrapper.
 *
 * Mounts the dashboard chrome (navbar + sidebar) around the shared
 * LoopedInTickets inbox so the list page looks like every other
 * page in this dashboard. The ticket detail route is intentionally
 * left fullscreen (no chrome) so the chat surface has all the space.
 */
export default function CourseManagerAssistingSupportContent() {
  const manager = useManagerProfile();
  const locale = useLocale();

  return (
    <>
      <CourseManagerNavbar manager={manager} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />
            <div className="flex-1 min-w-0">
              <LoopedInTickets
                detailBasePath={`/${locale}/dashboard/manager/support`}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
