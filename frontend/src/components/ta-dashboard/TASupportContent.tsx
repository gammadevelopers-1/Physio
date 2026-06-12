"use client";

import { useEffect, useState, type ReactNode } from "react";
import TANavbar from "./TANavbar";
import TASidebar from "./TASidebar";
import { taApi, type TAAssignedCourse } from "@/lib/api";
import UserSupportInbox from "@/components/support-shared/UserSupportInbox";
import UserTicketDetail from "@/components/support-shared/UserTicketDetail";

const TASupportContent = () => {
  const [courses, setCourses] = useState<TAAssignedCourse[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    taApi
      .getMyAssignedCourses()
      .then((res) => {
        if (!cancelled) setCourses(res || []);
      })
      .catch(() => {
        /* course list is optional; form just hides the picker */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userCourses = courses
    .filter((c) => c.status === "approved")
    .map((c) => ({
      id: c.courseId,
      title: c.courseTitle,
      titleAr: c.courseTitle,
    }));

  const renderShell = (children: ReactNode) => (
    <div className="min-h-screen bg-[var(--color-surface-page)]">
      <TANavbar />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <TASidebar />
          </div>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
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
      source="ta"
      defaultCategorySlug="courses"
      userCourses={userCourses}
      onOpenTicket={setSelectedTicketId}
      renderShell={renderShell}
    />
  );
};

export default TASupportContent;
