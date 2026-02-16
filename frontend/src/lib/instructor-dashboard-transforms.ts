import type {
  DashboardSummaryResponse,
  DashboardSession,
  DashboardAtRiskLearner,
  DashboardCertificate,
  DashboardCourse,
} from "@/types/instructor-dashboard";

// ─── KPI Cards ─────────────────────────────────────────────

export function transformToKPIData(summary: DashboardSummaryResponse) {
  return summary.kpis;
}

// ─── Today's Sessions → Session Cards ──────────────────────

export function transformToSessionCards(sessions: DashboardSession[]) {
  return sessions.map((s) => {
    const scheduledDate = new Date(s.scheduledAt);
    const endDate = new Date(
      scheduledDate.getTime() + s.durationMinutes * 60 * 1000
    );

    const formatTime = (d: Date) =>
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

    return {
      id: s.id,
      title: s.title,
      thumbnail: "/student_dashboard/courses/image 473.svg",
      type: s.type as "zoom" | "onsite",
      location: s.roomName || s.venueAddress || undefined,
      enrolled: s.enrolledCount,
      time: `${formatTime(scheduledDate)} - ${formatTime(endDate)}`,
      isFavorite: false,
    };
  });
}

// ─── Sessions → Calendar Sessions Widget ───────────────────

export function transformToCalendarSessions(sessions: DashboardSession[]) {
  return sessions.map((s) => {
    const scheduledDate = new Date(s.scheduledAt);
    const endDate = new Date(
      scheduledDate.getTime() + s.durationMinutes * 60 * 1000
    );

    const formatTime = (d: Date) =>
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

    return {
      id: s.id,
      title: s.title,
      time: `${formatTime(scheduledDate)} - ${formatTime(endDate)}`,
      duration: `${s.durationMinutes} mins`,
      type: s.type as "zoom" | "onsite",
      venue: s.roomName || s.venueAddress || undefined,
      enrolled: s.enrolledCount,
      dayIndex: scheduledDate.getDay(), // 0 = Sunday
    };
  });
}

// ─── Sessions → Right Sidebar Calendar Events ──────────────

export function transformToCalendarEvents(sessions: DashboardSession[]) {
  return sessions.map((s) => {
    const scheduledDate = new Date(s.scheduledAt);
    const endDate = new Date(
      scheduledDate.getTime() + s.durationMinutes * 60 * 1000
    );

    const formatTime = (d: Date) =>
      d
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .toLowerCase();

    const today = new Date();
    const isToday =
      scheduledDate.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      scheduledDate.toDateString() === tomorrow.toDateString();

    let dateLabel: string;
    if (isToday) {
      dateLabel = "Today";
    } else if (isTomorrow) {
      dateLabel = "Tomorrow";
    } else {
      dateLabel = scheduledDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    return {
      id: s.id,
      title: s.title,
      date: dateLabel,
      time: `${formatTime(scheduledDate)} - ${formatTime(endDate)}`,
      duration: `${s.durationMinutes} mins`,
      enrolled: s.enrolledCount,
      type: s.type as "zoom" | "onsite",
      zoomLink: s.zoomLink || undefined,
    };
  });
}

// ─── At-Risk Learners ──────────────────────────────────────

export function transformToAtRiskLearners(
  learners: DashboardAtRiskLearner[]
) {
  return learners.map((l) => {
    // Determine primary risk type and value from riskReasons
    let riskType: "lowAttendance" | "lowScore" | "inactive" = "inactive";
    let riskValue = "";

    for (const reason of l.riskReasons) {
      if (reason.toLowerCase().includes("attendance")) {
        riskType = "lowAttendance";
        riskValue = `${l.attendanceRate}%`;
        break;
      }
      if (reason.toLowerCase().includes("assessment") || reason.toLowerCase().includes("score")) {
        riskType = "lowScore";
        // Extract percentage if present
        const match = reason.match(/(\d+)%/);
        riskValue = match ? `${match[1]}%` : "Below threshold";
        break;
      }
      if (
        reason.toLowerCase().includes("activity") ||
        reason.toLowerCase().includes("inactive")
      ) {
        riskType = "inactive";
        if (l.lastAccessedAt) {
          const daysSince = Math.floor(
            (Date.now() - new Date(l.lastAccessedAt).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          riskValue = `${daysSince} days`;
        } else {
          riskValue = "No activity";
        }
      }
    }

    // Generate initials from first and last name
    const initials = `${(l.firstName || "")[0] || ""}${(l.lastName || "")[0] || ""}`.toUpperCase();

    return {
      id: l.id,
      name: `${l.firstName} ${l.lastName}`.trim(),
      initials,
      riskType,
      riskValue,
    };
  });
}

// ─── Pending Certificates → Certificate Queue ─────────────

export function transformToCertificateQueue(
  certificates: DashboardCertificate[]
) {
  return certificates.map((cert) => ({
    id: cert.id,
    studentName: `${cert.studentFirstName} ${cert.studentLastName}`.trim(),
    courseName: cert.courseName,
    completionDate: cert.createdAt
      ? new Date(cert.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : undefined,
    checks: {
      attendance: parseFloat(cert.attendancePercent) >= 70,
      assessment: cert.assessmentPassed,
      completion: cert.courseCompleted,
    },
  }));
}

// ─── Active Courses → Course Options ───────────────────────

export function transformToCourseOptions(courses: DashboardCourse[]) {
  return [
    { value: "all", label: "All Courses" },
    ...courses.map((c) => ({
      value: c.id,
      label: c.title,
    })),
  ];
}
