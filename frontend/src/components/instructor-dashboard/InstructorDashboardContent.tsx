"use client";

import { useTranslations } from "next-intl";
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
import CertificateQueue from "./CertificateQueue";
import SessionsCalendarWidget from "./SessionsCalendarWidget";
import AssessmentAnalysisWidget from "./AssessmentAnalysisWidget";
import RecentFeedbackWidget from "./RecentFeedbackWidget";
import DashboardSkeleton from "./DashboardSkeleton";
import DashboardError from "./DashboardError";
import { useInstructorDashboard } from "@/hooks/useInstructorDashboard";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import {
  transformToKPIData,
  transformToSessionCards,
  transformToCalendarSessions,
  transformToCalendarEvents,
  transformToAtRiskLearners,
  transformToCertificateQueue,
  transformToCourseOptions,
} from "@/lib/instructor-dashboard-transforms";

const InstructorDashboardContent = () => {
  const t = useTranslations("instructorDashboard");
  const { data: dashboard, loading, error, refetch } = useInstructorDashboard();
  const instructor = useInstructorProfile();

  // ─── Derived data from API ───────────────────────────────
  const attendanceData = dashboard?.attendanceTrend ?? [0, 0, 0, 0, 0, 0, 0];
  const moduleProgress = dashboard?.moduleProgress ?? [];
  const assessmentScores = dashboard?.assessmentScores ?? [];
  const questionAnalysis = dashboard?.questionAnalysis ?? [];
  const contentFiles = dashboard?.materials ?? [];
  const tabAssessments = dashboard?.tabAssessments ?? [];

  // Reports tab shows static report type definitions (functional UI, not data)
  const reports = [
    { id: "1", title: t("reports.attendanceReport"), description: t("reports.attendanceDescription"), lastGenerated: "" },
    { id: "2", title: t("reports.progressReport"), description: t("reports.progressDescription"), lastGenerated: "" },
    { id: "3", title: t("reports.nelcReport"), description: t("reports.nelcDescription"), lastGenerated: "" },
  ];

  // ─── Event handlers ──────────────────────────────────────

  const handleRefreshNotifications = () => {
    console.log("Refreshing notifications...");
  };

  const handleStartSession = (sessionId: string) => {
    console.log("Starting session:", sessionId);
  };

  const handleSessionAttendance = (sessionId: string) => {
    console.log("Opening attendance for:", sessionId);
  };

  const handleShareSessionMaterials = (sessionId: string) => {
    console.log("Sharing materials for:", sessionId);
  };

  // ─── Derived data from API ───────────────────────────────

  const kpiData = dashboard ? transformToKPIData(dashboard) : { activeCourses: 0, todaysSessions: 0, atRiskLearners: 0 };
  const sessionCards = dashboard ? transformToSessionCards(dashboard.todaySessions) : [];
  const calendarSessions = dashboard ? transformToCalendarSessions([...dashboard.todaySessions, ...dashboard.upcomingSessions]) : [];
  const calendarEvents = dashboard ? transformToCalendarEvents(dashboard.todaySessions) : [];
  const atRiskLearners = dashboard ? transformToAtRiskLearners(dashboard.atRiskLearners) : [];
  const certificates = dashboard ? transformToCertificateQueue(dashboard.pendingCertificates) : [];
  const courseOptions = dashboard ? transformToCourseOptions(dashboard.activeCourses) : [{ value: "all", label: t("performance.allCourses") }];

  return (
    <>
      {/* Dashboard Navbar */}
      <InstructorNavbar instructor={instructor} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
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
                <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                  {t("title")}
                </h1>

                {/* KPI Cards */}
                <InstructorKPICards data={kpiData} />

                {/* Today's Sessions */}
                <TodaysSessions sessions={sessionCards} />

                {/* Sessions Calendar Widget */}
                <div className="mb-6">
                  <SessionsCalendarWidget
                    sessions={calendarSessions}
                    onStartSession={handleStartSession}
                    onAttendance={handleSessionAttendance}
                    onShareMaterials={handleShareSessionMaterials}
                  />
                </div>

                {/* Course Performance */}
                <CoursePerformance
                  attendanceData={attendanceData}
                  modules={moduleProgress}
                  courses={courseOptions}
                />

                {/* Assessment & Item Analysis */}
                <AssessmentAnalysisWidget
                  assessments={assessmentScores}
                  questions={questionAnalysis}
                />

                {/* Recent Feedback — no backend endpoint yet, shows empty state */}
                <div className="mb-6">
                  <RecentFeedbackWidget
                    overallRating={0}
                    totalReviews={0}
                    feedbackItems={[]}
                  />
                </div>

                {/* Tabs Section */}
                <InstructorTabs
                  contentFiles={contentFiles}
                  assessments={tabAssessments}
                  reports={reports}
                  courseId={dashboard?.activeCourses?.[0]?.id}
                  onMaterialChange={refetch}
                />
              </div>
            )}

            {/* Right Sidebar */}
            <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
              {/* Notifications — no backend endpoint yet, shows empty state */}
              <InstructorNotificationsWidget
                notifications={[]}
                onRefresh={handleRefreshNotifications}
              />

              {/* Calendar */}
              <InstructorCalendarWidget events={calendarEvents} />

              {/* At-Risk Learners */}
              <AtRiskLearners learners={atRiskLearners} />

              {/* Pending Certificates */}
              <CertificateQueue certificates={certificates} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstructorDashboardContent;
