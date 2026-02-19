"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerKPICards from "./CourseManagerKPICards";
import CatalogOverviewWidget from "./CatalogOverviewWidget";
import ContentReviewQueue from "./ContentReviewQueue";
import InstructorsManagementWidget from "./InstructorsManagementWidget";
import NELCComplianceWidget from "./NELCComplianceWidget";
import CourseStatsWidget from "./CourseStatsWidget";
import UpcomingSessionsWidget from "./UpcomingSessionsWidget";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useCourseManagerDashboard } from "@/hooks/useCourseManagerDashboard";
import { courseManagerApi, ApiError } from "@/lib/api";

const CourseManagerDashboardContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const { summary, courses, instructors, loading, error, refetch, silentRefetch } =
    useCourseManagerDashboard();

  // Derive KPI data from real courses
  const kpiData = {
    totalCourses: courses.length,
    totalEnrollments: courses.reduce((sum, c) => sum + c.enrolledCount, 0),
    pendingReviews: 0,
  };

  // Derive course stats from real data
  const activeCourses = courses.filter((c) => c.status === "active");
  const courseStats = {
    activeCourses: activeCourses.length,
    draftCourses: courses.filter((c) => c.status === "draft").length,
    completedCourses: courses.filter((c) => c.status === "completed").length,
    avgCompletionRate:
      activeCourses.length > 0
        ? Math.round(
            activeCourses.reduce((sum, c) => sum + c.completionRate, 0) /
              activeCourses.length
          )
        : 0,
    completionTrend: 0,
    avgRating: 0,
  };

  // Map courses to CatalogOverviewWidget format
  const catalogCourses = courses.map((c) => ({
    id: c.id,
    name: c.title,
    category: c.deliveryType,
    thumbnail: c.title
      .split(" ")
      .map((w) => w[0])
      .join("")
      .substring(0, 2)
      .toUpperCase(),
    instructor: c.instructorName || "",
    status: c.status === "draft" ? ("preparing" as const) : (c.status as "active" | "completed" | "archived"),
    enrolled: c.enrolledCount,
    capacity: c.maxEnrollment || 0,
    completionRate: c.completionRate > 0 ? c.completionRate : null,
    rating: null,
  }));

  // Handle status change from CatalogOverviewWidget
  const handleCatalogStatusChange = useCallback(
    async (courseId: string, newStatus: string) => {
      // Map widget status "preparing" back to backend "draft"
      const backendStatus = newStatus === "preparing" ? "draft" : newStatus;
      try {
        await courseManagerApi.updateCourse(courseId, { status: backendStatus });
        toast.success(t("catalog.statusChanged"));
        silentRefetch();
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : t("catalog.statusFailed")
        );
      }
    },
    [t, silentRefetch]
  );

  // Map upcoming sessions from summary
  const upcomingSessions = (summary?.upcomingSessions || []).slice(0, 3).map((s) => {
    const d = new Date(s.scheduledAt);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return {
      id: s.id,
      title: s.title,
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: isToday
        ? "Today"
        : d.toLocaleDateString([], { month: "short", day: "numeric" }),
      type: (s.type === "onsite" ? "onsite" : "zoom") as "zoom" | "onsite",
      location: s.venueAddress || undefined,
      enrolled: s.enrolledCount || 0,
      capacity: 0,
    };
  });

  // Map instructors to widget format
  const widgetInstructors = instructors.map((inst) => {
    const name =
      [inst.firstName, inst.lastName].filter(Boolean).join(" ") || inst.email;
    const initials = inst.firstName && inst.lastName
      ? `${inst.firstName[0]}${inst.lastName[0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
    return {
      id: inst.id,
      name,
      initials,
      assignedCourses: 0,
      hoursPerWeek: 0,
      loadPercentage: 0,
      rating: 0,
      status: "available" as const,
    };
  });

  if (loading) {
    return (
      <>
        <CourseManagerNavbar manager={manager} />
        <div className="bg-[#F9FAFB] min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#6B7280]">{t("dashboard.loading")}</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CourseManagerNavbar manager={manager} />
        <div className="bg-[#F9FAFB] min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280] mb-4">{error}</p>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.retry")}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)] mb-4 sm:mb-6">
                {t("title")}
              </h1>

              <CourseManagerKPICards data={kpiData} />

              <div className="mb-6">
                <CatalogOverviewWidget courses={catalogCourses} onStatusChange={handleCatalogStatusChange} />
              </div>

              <div className="mb-6">
                <ContentReviewQueue
                  items={[]}
                  onApprove={() => {}}
                  onReject={() => {}}
                  onPreview={() => {}}
                />
              </div>

              <div className="mb-6">
                <NELCComplianceWidget
                  compliance={{ percentage: 0, passed: 0, review: 0, failed: 0 }}
                  reports={[]}
                />
              </div>
            </div>

            <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
              <CourseStatsWidget data={courseStats} />
              <UpcomingSessionsWidget sessions={upcomingSessions} />
              <InstructorsManagementWidget instructors={widgetInstructors} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CourseManagerDashboardContent;
