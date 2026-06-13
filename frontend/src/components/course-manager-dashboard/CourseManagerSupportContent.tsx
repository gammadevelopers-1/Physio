"use client";

import { useState, type ReactNode } from "react";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useCourseManagerCourses } from "@/hooks/useCourseManagerCourses";
import UserSupportInbox from "@/components/support-shared/UserSupportInbox";
import UserTicketDetail from "@/components/support-shared/UserTicketDetail";

const CourseManagerSupportContent = () => {
  const manager = useManagerProfile();
  const { courses } = useCourseManagerCourses({ page: 1, limit: 100 });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const userCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    titleAr: c.titleAr,
  }));

  const renderShell = (children: ReactNode) => (
    <>
      <CourseManagerNavbar manager={manager} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </>
  );

  if (selectedTicketId) {
    // Phase 2 — fullscreen ticket detail (no role chrome).
    return (
      <UserTicketDetail
        ticketId={selectedTicketId}
        onBack={() => setSelectedTicketId(null)}
        renderShell={(c) => <>{c}</>}
      />
    );
  }

  return (
    <UserSupportInbox
      source="course_manager"
      defaultCategorySlug="course_approvals"
      userCourses={userCourses}
      onOpenTicket={setSelectedTicketId}
      renderShell={renderShell}
    />
  );
};

export default CourseManagerSupportContent;
