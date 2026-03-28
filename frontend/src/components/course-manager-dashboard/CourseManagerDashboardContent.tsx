"use client";

import { useCallback, useState, useEffect } from "react";
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
import { useContentReview } from "@/hooks/useContentReview";
import CertificateQueue from "@/components/instructor-dashboard/CertificateQueue";
import { transformToCertificateQueue } from "@/lib/instructor-dashboard-transforms";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

const CourseManagerDashboardContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const tA = useTranslations("accessibility");
  const locale = useLocale();
  const router = useRouter();
  const manager = useManagerProfile();
  const { summary, courses, instructors, loading, error, refetch, silentRefetch } =
    useCourseManagerDashboard();
  const { items: reviewItems, stats: reviewStats, approve: approveReview, reject: rejectReview } =
    useContentReview();
  const [ratingsMap, setRatingsMap] = useState<Record<string, { avgRating: number; totalRatings: number }>>({});

  useEffect(() => {
    courseManagerApi.getAllCourseRatings().then(setRatingsMap).catch(() => {});
  }, []);

  // ─── Certificate handlers ──────────────────────────────────
  const certificates = summary ? transformToCertificateQueue(summary.pendingCertificates) : [];

  const handleApproveCertificate = async (id: string) => {
    await courseManagerApi.approveCertificate(id);
  };

  const handleHoldCertificate = async (id: string, note: string) => {
    await courseManagerApi.holdCertificate(id, note);
  };

  const handleBatchApproveCertificates = async (ids: string[]) => {
    await courseManagerApi.batchCertificates(ids, "approve");
  };

  const handleBatchHoldCertificates = async (ids: string[], note: string) => {
    await courseManagerApi.batchCertificates(ids, "hold", note);
  };

  const handlePreviewCertificate = () => {
    router.push(`/${locale}/dashboard/manager/certificates`);
  };

  // Derive KPI data from real courses
  const activeCoursesList = courses.filter((c) => c.status === "active");
  const kpiData = {
    totalCourses: courses.length,
    totalEnrollments: courses.reduce((sum, c) => sum + c.enrolledCount, 0),
    pendingReviews: reviewStats.pending,
    avgCompletionRate:
      activeCoursesList.length > 0
        ? Math.round(activeCoursesList.reduce((sum, c) => sum + c.completionRate, 0) / activeCoursesList.length)
        : 0,
    activeInstructors: instructors.length,
    totalRevenue: Math.round(courses.reduce((sum, c) => sum + ((c.price || 0) * c.enrolledCount), 0)),
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
    rating: ratingsMap[c.id]?.avgRating ?? null,
  }));

  // Handle status change from CatalogOverviewWidget using dedicated endpoints
  const handleCatalogStatusChange = useCallback(
    async (courseId: string, newStatus: string) => {
      try {
        switch (newStatus) {
          case "active":
            await courseManagerApi.activateCourse(courseId);
            break;
          case "archived":
            await courseManagerApi.deactivateCourse(courseId);
            break;
          case "completed":
            await courseManagerApi.completeCourse(courseId);
            break;
          default:
            toast.error("Unsupported status transition");
            return;
        }
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

  // Map instructors to widget format with real data from courses
  const widgetInstructors = instructors.map((inst) => {
    const name =
      [inst.firstName, inst.lastName].filter(Boolean).join(" ") || inst.email;
    const initials = inst.firstName && inst.lastName
      ? `${inst.firstName[0]}${inst.lastName[0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();

    // Derive stats from courses assigned to this instructor
    const assignedCoursesList = courses.filter((c) => c.instructorId === inst.id);
    const assignedCourses = assignedCoursesList.length;
    const totalSessionMinutes = assignedCoursesList.reduce(
      (sum, c) => sum + (c.totalSessions * 60), 0
    );
    const hoursPerWeek = Math.round((totalSessionMinutes / 60) * 10) / 10;

    // Average rating across all courses for this instructor
    const instructorRatings = assignedCoursesList
      .map((c) => ratingsMap[c.id]?.avgRating)
      .filter((r): r is number => r !== undefined && r > 0);
    const rating = instructorRatings.length > 0
      ? Math.round((instructorRatings.reduce((s, r) => s + r, 0) / instructorRatings.length) * 10) / 10
      : 0;

    // Load: percentage of max capacity (assume 20 hrs/week as max)
    const loadPercentage = Math.min(100, Math.round((hoursPerWeek / 20) * 100));
    const status: "available" | "busy" | "overloaded" =
      loadPercentage >= 80 ? "overloaded" : loadPercentage >= 50 ? "busy" : "available";

    return {
      id: inst.id,
      name,
      initials,
      assignedCourses,
      hoursPerWeek,
      loadPercentage,
      rating,
      status,
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
              aria-label={tA("refresh")}
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
                  items={reviewItems.slice(0, 3).map((item) => ({
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    courseName: item.courseTitle,
                    submittedBy: `${item.instructorFirstName || ""} ${item.instructorLastName || ""}`.trim() || item.instructorEmail,
                    checklist: [
                      { id: "wcag", label: "WCAG", passed: item.wcagStatus === "pass" || item.wcagStatus === "compliant" || item.wcagStatus === "skipped" },
                    ],
                  }))}
                  onApprove={async (id) => {
                    try {
                      await approveReview(id);
                      toast.success("Content approved");
                    } catch { toast.error("Failed to approve"); }
                  }}
                  onReject={async (id) => {
                    try {
                      await rejectReview(id);
                      toast.success("Content rejected");
                    } catch { toast.error("Failed to reject"); }
                  }}
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
              {certificates.length > 0 && (
                <CertificateQueue
                  certificates={certificates}
                  onApprove={handleApproveCertificate}
                  onHold={handleHoldCertificate}
                  onBatchApprove={handleBatchApproveCertificates}
                  onBatchHold={handleBatchHoldCertificates}
                  onPreview={handlePreviewCertificate}
                  onRefresh={refetch}
                />
              )}
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
