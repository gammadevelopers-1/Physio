"use client";

import { useState, type ReactNode } from "react";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useInstructorCourses } from "@/hooks/useInstructorCourses";
import UserSupportInbox from "@/components/support-shared/UserSupportInbox";
import UserTicketDetail from "@/components/support-shared/UserTicketDetail";

const InstructorSupportContent = () => {
  const instructor = useInstructorProfile();
  const { courses } = useInstructorCourses({ page: 1, limit: 100 });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const userCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    titleAr: c.titleAr,
  }));

  const renderShell = (children: ReactNode) => (
    <>
      <InstructorNavbar instructor={instructor} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </>
  );

  if (selectedTicketId) {
    return (
      <UserTicketDetail
        ticketId={selectedTicketId}
        onBack={() => setSelectedTicketId(null)}
        renderShell={renderShell}
      />
    );
  }

  return (
    <UserSupportInbox
      source="instructor"
      defaultCategorySlug="courses"
      userCourses={userCourses}
      onOpenTicket={setSelectedTicketId}
      renderShell={renderShell}
    />
  );
};

export default InstructorSupportContent;
