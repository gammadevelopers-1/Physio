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

// Static mock data
const mockInstructor = {
  name: "Dr. Faisal Al-Otaibi",
  email: "faisal@healthtraining.sa",
  rating: 4.8,
  courseCompletion: 92,
  avatar: "/images/instructor-1.png",
};

const mockKPIData = {
  myCourses: 5,
  coursesChange: "+2 this month",
  todaysSessions: 3,
  nextSessionTime: "2:00 PM",
  atRiskLearners: 12,
  atRiskChange: "+3 need attention",
  pendingCertificates: 8,
  certificatesStatus: "Awaiting approval",
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

  // Mock at-risk learners
  const mockAtRiskLearners = [
    {
      id: "1",
      name: "Ahmed Al-Khalid",
      initials: "AK",
      riskType: "lowAttendance" as const,
      riskValue: "45%",
    },
    {
      id: "2",
      name: "Sara Mohammed",
      initials: "SM",
      riskType: "lowScore" as const,
      riskValue: "52%",
    },
    {
      id: "3",
      name: "Khalid Hassan",
      initials: "KH",
      riskType: "inactive" as const,
      riskValue: "7 days",
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
              <h1 className="text-2xl font-bold text-[#1F2937] mb-6">
                {t("title")}
              </h1>

              {/* KPI Cards */}
              <InstructorKPICards data={mockKPIData} />

              {/* Today's Sessions */}
              <TodaysSessions sessions={mockSessions} />

              {/* Course Performance */}
              <CoursePerformance
                attendanceData={attendanceData}
                modules={moduleProgress}
                courses={courseOptions}
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
              <AtRiskLearners
                learners={mockAtRiskLearners}
                totalCount={12}
              />

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
