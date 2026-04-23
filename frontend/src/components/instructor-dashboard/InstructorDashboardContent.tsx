"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import InstructorNavbar from "./InstructorNavbar";
import InstructorKPICards from "./InstructorKPICards";
import TodaysSessions from "./TodaysSessions";
import CoursePerformance from "./CoursePerformance";
import InstructorTabs from "./InstructorTabs";
import InstructorNotificationsWidget from "./InstructorNotificationsWidget";
import InstructorCalendarWidget from "./InstructorCalendarWidget";
import AtRiskLearners from "./AtRiskLearners";
import SessionsCalendarWidget from "./SessionsCalendarWidget";
import AssessmentAnalysisWidget from "./AssessmentAnalysisWidget";
import RecentFeedbackWidget from "./RecentFeedbackWidget";
import AssessmentsNeedingAttention from "./AssessmentsNeedingAttention";
import DashboardSkeleton from "./DashboardSkeleton";
import DashboardError from "./DashboardError";
import { useInstructorDashboard } from "@/hooks/useInstructorDashboard";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useNotifications } from "@/hooks/useNotifications";
import { instructorApi, materialsApi } from "@/lib/api";
import {
  transformToKPIData,
  transformToSessionCards,
  transformToCalendarSessions,
  transformToCalendarEvents,
  transformToAtRiskLearners,
  transformToCourseOptions,
} from "@/lib/instructor-dashboard-transforms";

const InstructorDashboardContent = () => {
  const t = useTranslations("instructorDashboard");
  const { data: dashboard, loading, error, refetch } = useInstructorDashboard();
  const instructor = useInstructorProfile();
  const { markAllAsRead: markAllNotificationsRead, clearAll: clearAllNotifications } = useNotifications();
  const router = useRouter();
  const locale = useLocale();

  // ─── Derived data from API ───────────────────────────────
  const attendanceData = dashboard?.attendanceTrend ?? [0, 0, 0, 0, 0, 0, 0];
  const moduleProgress = dashboard?.moduleProgress ?? [];
  const assessmentScores = dashboard?.assessmentScores ?? [];
  const questionAnalysis = dashboard?.questionAnalysis ?? [];
  const contentFiles = dashboard?.materials ?? [];
  const pendingSubmissions = dashboard?.pendingSubmissions ?? [];

  // Reports tab shows static report type definitions (functional UI, not data)
  const reports = [
    { id: "1", title: t("reports.attendanceReport"), description: t("reports.attendanceDescription"), lastGenerated: "" },
    { id: "2", title: t("reports.progressReport"), description: t("reports.progressDescription"), lastGenerated: "" },
    { id: "3", title: t("reports.nelcReport"), description: t("reports.nelcDescription"), lastGenerated: "" },
  ];

  // ─── Event handlers ──────────────────────────────────────

  const handleRefreshNotifications = () => {
    refetch();
  };

  const handleStartSession = async (sessionId: string) => {
    try {
      const result = await instructorApi.startSession(sessionId);
      toast.success(t("sessions.sessionStartSuccess"));
      if ((result as any).zoomStartUrl) {
        window.open((result as any).zoomStartUrl, "_blank");
      }
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("sessions.sessionStartError"));
    }
  };

  const handleEndSession = async (sessionId: string) => {
    if (!window.confirm(t("sessions.endSessionConfirm"))) return;
    try {
      const result = await instructorApi.endSession(sessionId);
      toast.success(t("sessions.sessionEnded"));
      if ((result as any).zoomEndedSuccessfully === false) {
        const errorDetail = (result as any).zoomErrorMessage;
        toast.warning(
          errorDetail
            ? t("sessions.zoomEndFailedDetail", { error: errorDetail })
            : t("sessions.zoomEndFailed"),
          { duration: 8000 }
        );
      }
      refetch();
    } catch {
      toast.error(t("sessions.endSessionError"));
    }
  };

  // ─── Live session polling ─────────────────────────────────
  // When any session is live, poll every 5s to detect external changes
  // (e.g. instructor ends meeting from Zoom UI → webhook updates DB → poll detects)

  const hasLiveSessions = useMemo(
    () => dashboard?.todaySessions?.some((s) => s.status === "live") ?? false,
    [dashboard]
  );

  const prevSessionsRef = useRef(dashboard?.todaySessions);
  useEffect(() => {
    prevSessionsRef.current = dashboard?.todaySessions;
  }, [dashboard?.todaySessions]);

  useEffect(() => {
    if (!hasLiveSessions) return;

    const interval = setInterval(async () => {
      try {
        const fresh = await instructorApi.getDashboardSummary();
        const prev = prevSessionsRef.current ?? [];
        const ended = prev.filter(
          (old) =>
            old.status === "live" &&
            fresh.todaySessions.find((n) => n.id === old.id && (n.status === "ended" || n.status === "completed"))
        );
        if (ended.length > 0) {
          refetch();
          for (const s of ended) {
            toast.info(t("sessions.sessionEndedAuto", { title: s.title }));
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasLiveSessions, refetch, t]);

  const handleSessionAttendance = (sessionId: string) => {
    router.push(`/${locale}/dashboard/instructor/sessions`);
  };

  const [sharingSessionId, setSharingSessionId] = useState<string | null>(null);
  const [sharingSessionCourseId, setSharingSessionCourseId] = useState<string | null>(null);

  const handleShareSessionMaterials = useCallback((sessionId: string) => {
    // Find the session's courseId
    const allSessions = [...(dashboard?.todaySessions ?? []), ...(dashboard?.upcomingSessions ?? [])];
    const session = allSessions.find((s) => s.id === sessionId);
    if (session) {
      setSharingSessionId(sessionId);
      setSharingSessionCourseId(session.courseId);
    }
  }, [dashboard]);

  // ─── Derived data from API ───────────────────────────────

  const kpiData = dashboard ? transformToKPIData(dashboard) : { activeCourses: 0, totalStudents: 0, todaysSessions: 0, atRiskLearners: 0 };
  const sessionCards = dashboard ? transformToSessionCards(dashboard.todaySessions) : [];
  const calendarSessions = dashboard ? transformToCalendarSessions([...dashboard.todaySessions, ...dashboard.upcomingSessions]) : [];
  const calendarEvents = dashboard ? transformToCalendarEvents(dashboard.todaySessions) : [];
  const atRiskLearners = dashboard ? transformToAtRiskLearners(dashboard.atRiskLearners) : [];
  const courseOptions = dashboard ? transformToCourseOptions(dashboard.activeCourses) : [{ value: "all", label: t("performance.allCourses") }];

  return (
    <>
      {/* Dashboard Navbar */}
      <InstructorNavbar instructor={instructor} />

      {/* Main Container */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile, shown via MobileSidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>

            {/* Mobile Sidebar */}
            <InstructorMobileSidebar instructor={instructor} />

            {/* Main Content */}
            {loading ? (
              <DashboardSkeleton />
            ) : error ? (
              <DashboardError message={error} onRetry={refetch} />
            ) : (
              <div className="flex-1 min-w-0">
                {/* Page Title */}
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-4 sm:mb-6">
                  {t("title")}
                </h1>

                {/* KPI Cards */}
                <InstructorKPICards data={kpiData} />

                {/* Today's Sessions */}
                <TodaysSessions
                  sessions={sessionCards}
                  onStartSession={handleStartSession}
                  onEndSession={handleEndSession}
                  onAttendance={handleSessionAttendance}
                  onShare={handleShareSessionMaterials}
                />

                {/* Sessions Calendar Widget */}
                <div className="mb-6">
                  <SessionsCalendarWidget
                    sessions={calendarSessions}
                    onStartSession={handleStartSession}
                    onEndSession={handleEndSession}
                    onAttendance={handleSessionAttendance}
                    onShareMaterials={handleShareSessionMaterials}
                  />
                </div>

                {/* Course Performance */}
                <CoursePerformance
                  attendanceData={attendanceData}
                  modules={moduleProgress}
                  courses={courseOptions}
                  passFailStats={dashboard?.passFailStats}
                />

                {/* Assessment & Item Analysis */}
                <AssessmentAnalysisWidget
                  assessments={assessmentScores}
                  questions={questionAnalysis}
                />

                {/* Recent Feedback */}
                <div className="mb-6">
                  <RecentFeedbackWidget
                    overallRating={dashboard?.recentFeedback?.overallRating ?? 0}
                    totalReviews={dashboard?.recentFeedback?.totalReviews ?? 0}
                    feedbackItems={dashboard?.recentFeedback?.feedbackItems ?? []}
                  />
                </div>

                {/* Tabs Section */}
                <InstructorTabs
                  contentFiles={contentFiles}
                  reports={reports}
                  courseId={dashboard?.activeCourses?.[0]?.id}
                  onMaterialChange={refetch}
                />
              </div>
            )}

            {/* Right Sidebar */}
            <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
              <InstructorNotificationsWidget
                notifications={dashboard?.notifications ?? []}
                onRefresh={handleRefreshNotifications}
                onMarkAllRead={async () => { await markAllNotificationsRead(); refetch(); }}
                onClearAll={async () => { await clearAllNotifications(); refetch(); }}
              />

              {/* Calendar */}
              <InstructorCalendarWidget events={calendarEvents} />

              {/* At-Risk Learners */}
              <AtRiskLearners learners={atRiskLearners} courses={courseOptions} onRefresh={refetch} />

              {/* Assessments Needing Attention */}
              <AssessmentsNeedingAttention submissions={pendingSubmissions} />
            </div>
          </div>
        </div>
      </div>
      {/* Share Materials Modal */}
      {sharingSessionId && sharingSessionCourseId && (
        <ShareMaterialsModal
          sessionId={sharingSessionId}
          courseId={sharingSessionCourseId}
          onClose={() => { setSharingSessionId(null); setSharingSessionCourseId(null); }}
          t={t}
        />
      )}
    </>
  );
};

// ─── Share Materials Modal ───────────────────────────────

function ShareMaterialsModal({
  sessionId,
  courseId,
  onClose,
  t,
}: {
  sessionId: string;
  courseId: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [courseMaterials, setCourseMaterials] = useState<Array<{ id: string; title: string; type: string }>>([]);
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [materials, shared] = await Promise.all([
          materialsApi.list(courseId),
          instructorApi.getSharedMaterials(sessionId),
        ]);
        setCourseMaterials(materials.map((m: { id: string; title: string; type: string }) => ({ id: m.id, title: m.title, type: m.type })));
        setSharedIds(new Set(shared.map((s: { materialId: string }) => s.materialId)));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId, courseId]);

  const toggle = async (materialId: string) => {
    setToggling(materialId);
    try {
      if (sharedIds.has(materialId)) {
        await instructorApi.unshareMaterial(sessionId, materialId);
        setSharedIds((prev) => { const n = new Set(prev); n.delete(materialId); return n; });
      } else {
        await instructorApi.shareMaterial(sessionId, materialId);
        setSharedIds((prev) => new Set(prev).add(materialId));
      }
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("shareMaterials.title")}</h3>
          <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[#F3F4F6] rounded-lg">
            <span className="text-lg">&times;</span>
          </button>
        </div>
        <p className="px-4 pt-3 text-sm text-[var(--color-text-secondary)]">{t("shareMaterials.description")}</p>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">...</div>
          ) : courseMaterials.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">{t("shareMaterials.noMaterials")}</p>
          ) : (
            <div className="space-y-2">
              {courseMaterials.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-page)] rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{m.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{m.type}</p>
                  </div>
                  <button
                    onClick={() => toggle(m.id)}
                    disabled={toggling === m.id}
                    className={`relative w-10 h-5 rounded-full transition-colors ${sharedIds.has(m.id) ? "bg-[#22C55E]" : "bg-[var(--color-border)]"} ${toggling === m.id ? "opacity-50" : ""}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sharedIds.has(m.id) ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-[var(--color-border)]">
          <button onClick={onClose} className="w-full px-4 py-2 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB]">
            {t("shareMaterials.done")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstructorDashboardContent;
