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

// Static mock data
const mockInstructor = {
  name: "Dr. Faisal Al-Otaibi",
  email: "faisal@healthtraining.sa",
  rating: 4.8,
  courseCompletion: 92,
  avatar: "/images/instructor-1.png",
};

const mockKPIData = {
  activeCourses: 5,
  coursesChange: "+2 this month",
  todaysSessions: 3,
  nextSessionTime: "2:00 PM",
  atRiskLearners: 5,
  atRiskChange: 2,
  pendingCertificates: 8,
  certificatesStatus: "Awaiting approval",
  avgRating: 4.8,
  totalReviews: 156,
};

const InstructorDashboardContent = () => {
  const t = useTranslations("instructorDashboard");

  // Mock sessions data
  const mockSessions = [
    {
      id: "session-1",
      title: t("mockData.aclsTraining"),
      thumbnail: "/student_dashboard/courses/image 473.svg",
      type: "zoom" as const,
      enrolled: 25,
      time: "2:00 PM - 3:30 PM",
      isFavorite: false,
    },
    {
      id: "session-2",
      title: t("mockData.firstAidModule"),
      thumbnail: "/student_dashboard/courses/image 491.svg",
      type: "onsite" as const,
      location: "Room 204",
      enrolled: 18,
      time: "4:00 PM - 5:30 PM",
      isFavorite: true,
    },
  ];

  // Mock performance data
  const attendanceData = [45, 62, 58, 78, 85, 72, 92];
  const moduleProgress = [
    { name: t("mockData.module1"), percentage: 85 },
    { name: t("mockData.module2"), percentage: 65 },
    { name: t("mockData.module3"), percentage: 40 },
    { name: t("mockData.module4"), percentage: 20 },
    { name: t("mockData.module5"), percentage: 10 },
  ];
  const courseOptions = [
    { value: "all", label: t("performance.allCourses") },
    { value: "acls", label: t("mockData.aclsTraining") },
    { value: "firstaid", label: "First Aid" },
    { value: "cpr", label: "CPR Certification" },
  ];

  // Mock tabs data
  const contentFiles = [
    {
      id: "1",
      type: "video" as const,
      name: "Module1-Introduction.mp4",
      version: "v2.1",
      status: "live" as const,
      wcagCompliant: true as const,
    },
    {
      id: "2",
      type: "pdf" as const,
      name: "Course-Handbook.pdf",
      version: "v1.0",
      status: "live" as const,
      wcagCompliant: true as const,
    },
    {
      id: "3",
      type: "video" as const,
      name: "Module2-Skills.mp4",
      version: "v1.2",
      status: "processing" as const,
      wcagCompliant: "warning" as const,
    },
  ];

  const assessments = [
    { id: "1", title: "Module 1 Quiz", questions: 20, submissions: 45, avgScore: 78 },
    { id: "2", title: "Module 2 Quiz", questions: 15, submissions: 38, avgScore: 82 },
    { id: "3", title: "Final Assessment", questions: 50, submissions: 32, avgScore: 75 },
  ];

  const reports = [
    {
      id: "1",
      title: t("reports.attendanceReport"),
      description: t("reports.attendanceDescription"),
      lastGenerated: "Feb 5, 2026",
    },
    {
      id: "2",
      title: t("reports.progressReport"),
      description: t("reports.progressDescription"),
      lastGenerated: "Feb 4, 2026",
    },
    {
      id: "3",
      title: t("reports.nelcReport"),
      description: t("reports.nelcDescription"),
      lastGenerated: "Feb 1, 2026",
    },
  ];

  // Mock assessment analysis data - Pre/Post score comparison
  const mockAssessmentScores = [
    { id: "1", name: t("mockData.module1"), preScore: 58, postScore: 85 },
    { id: "2", name: t("mockData.module2"), preScore: 45, postScore: 72 },
    { id: "3", name: t("mockData.module3"), preScore: 52, postScore: 78 },
    { id: "4", name: t("mockData.module4"), preScore: 40, postScore: 68 },
  ];

  // Mock question difficulty data
  const mockQuestionAnalysis = [
    { id: "1", question: t("assessmentAnalysis.questionSample1"), difficulty: "easy" as const, correctRate: 92 },
    { id: "2", question: t("assessmentAnalysis.questionSample2"), difficulty: "medium" as const, correctRate: 68 },
    { id: "3", question: t("assessmentAnalysis.questionSample3"), difficulty: "hard" as const, correctRate: 45 },
    { id: "4", question: t("assessmentAnalysis.questionSample4"), difficulty: "medium" as const, correctRate: 72 },
    { id: "5", question: t("assessmentAnalysis.questionSample5"), difficulty: "hard" as const, correctRate: 38 },
  ];

  // Mock notifications
  const mockNotifications = [
    {
      id: "1",
      title: t("notifications.newEnrollment"),
      message: t("notifications.newEnrollmentMessage"),
      date: "5/2/26",
      read: false,
    },
    {
      id: "2",
      title: t("notifications.assessmentSubmitted"),
      message: t("notifications.assessmentSubmittedMessage"),
      date: "5/2/26",
      read: false,
    },
    {
      id: "3",
      title: t("notifications.reviewRequested"),
      message: t("notifications.reviewRequestedMessage"),
      date: "4/2/26",
      read: true,
    },
  ];

  // Mock calendar events
  const mockEvents = [
    {
      id: "1",
      title: t("mockData.aclsTraining"),
      date: t("calendar.today"),
      time: "2:00pm - 3:30pm",
      duration: "90 mins",
      enrolled: 25,
      type: "zoom" as const,
      zoomLink: "https://zoom.us/j/123456789",
    },
    {
      id: "2",
      title: t("mockData.firstAidModule"),
      date: t("calendar.today"),
      time: "4:00pm - 5:30pm",
      duration: "90 mins",
      enrolled: 18,
      type: "onsite" as const,
    },
  ];

  // Mock at-risk learners - 5 learners with different risk types
  const mockAtRiskLearners = [
    {
      id: "1",
      name: "Ahmed Al-Khalid",
      initials: "AK",
      riskType: "lowAttendance" as const,
      riskValue: "45%",
      course: "Advanced Cardiovascular Life Support",
    },
    {
      id: "2",
      name: "Sara Mohammed",
      initials: "SM",
      riskType: "lowScore" as const,
      riskValue: "52%",
      course: "Basic First Aid Training",
    },
    {
      id: "3",
      name: "Khalid Hassan",
      initials: "KH",
      riskType: "inactive" as const,
      riskValue: "7 days",
      course: "CPR Certification",
    },
    {
      id: "4",
      name: "Fatima Al-Zahrani",
      initials: "FZ",
      riskType: "lowAttendance" as const,
      riskValue: "38%",
      course: "Patient Safety & Quality",
    },
    {
      id: "5",
      name: "Omar Al-Rashid",
      initials: "OR",
      riskType: "lowScore" as const,
      riskValue: "48%",
      course: "Infection Control",
    },
  ];

  // Mock pending certificates
  const mockCertificates = [
    {
      id: "1",
      studentName: "Fatima Al-Rashid",
      courseName: t("mockData.aclsTraining"),
      checks: { attendance: true, assessment: true, completion: true },
    },
    {
      id: "2",
      studentName: "Omar Abdullah",
      courseName: "First Aid",
      checks: { attendance: true, assessment: true, completion: false },
    },
    {
      id: "3",
      studentName: "Layla Hassan",
      courseName: "CPR Certification",
      checks: { attendance: true, assessment: true, completion: true },
    },
  ];

  const handleRefreshNotifications = () => {
    console.log("Refreshing notifications...");
  };

  // Get today's day index (0 = Sunday)
  const today = new Date().getDay();

  // Mock calendar sessions data - 5 sessions distributed across the week
  const mockCalendarSessions = [
    {
      id: "cal-session-1",
      title: t("mockData.aclsTraining"),
      time: "9:00 AM - 10:30 AM",
      duration: "90 mins",
      type: "zoom" as const,
      enrolled: 25,
      dayIndex: today, // Today
    },
    {
      id: "cal-session-2",
      title: t("mockData.firstAidModule"),
      time: "2:00 PM - 3:30 PM",
      duration: "90 mins",
      type: "onsite" as const,
      venue: "Room 204, Building A",
      enrolled: 18,
      dayIndex: today, // Today
    },
    {
      id: "cal-session-3",
      title: "CPR Certification",
      time: "10:00 AM - 12:00 PM",
      duration: "120 mins",
      type: "zoom" as const,
      enrolled: 32,
      dayIndex: (today + 1) % 7, // Tomorrow
    },
    {
      id: "cal-session-4",
      title: "Emergency Response",
      time: "3:00 PM - 5:00 PM",
      duration: "120 mins",
      type: "onsite" as const,
      venue: "Training Center",
      enrolled: 15,
      dayIndex: (today + 2) % 7, // Day after tomorrow
    },
    {
      id: "cal-session-5",
      title: "Patient Safety Workshop",
      time: "1:00 PM - 2:30 PM",
      duration: "90 mins",
      type: "zoom" as const,
      enrolled: 28,
      dayIndex: (today + 4) % 7, // 4 days from now
    },
  ];

  const handleStartSession = (sessionId: string) => {
    console.log("Starting session:", sessionId);
  };

  const handleSessionAttendance = (sessionId: string) => {
    console.log("Opening attendance for:", sessionId);
  };

  const handleShareSessionMaterials = (sessionId: string) => {
    console.log("Sharing materials for:", sessionId);
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <InstructorNavbar instructor={mockInstructor} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile, shown via MobileSidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={mockInstructor} />
            </div>

            {/* Mobile Sidebar */}
            <InstructorMobileSidebar instructor={mockInstructor} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                {t("title")}
              </h1>

              {/* KPI Cards */}
              <InstructorKPICards data={mockKPIData} />

              {/* Today's Sessions */}
              <TodaysSessions sessions={mockSessions} />

              {/* Sessions Calendar Widget */}
              <div className="mb-6">
                <SessionsCalendarWidget
                  sessions={mockCalendarSessions}
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
                assessments={mockAssessmentScores}
                questions={mockQuestionAnalysis}
              />

              {/* Tabs Section */}
              <InstructorTabs
                contentFiles={contentFiles}
                assessments={assessments}
                reports={reports}
              />
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
              {/* Notifications */}
              <InstructorNotificationsWidget
                notifications={mockNotifications}
                onRefresh={handleRefreshNotifications}
              />

              {/* Calendar */}
              <InstructorCalendarWidget events={mockEvents} />

              {/* At-Risk Learners */}
              <AtRiskLearners learners={mockAtRiskLearners} />

              {/* Pending Certificates */}
              <CertificateQueue
                certificates={mockCertificates}
                totalCount={8}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InstructorDashboardContent;
