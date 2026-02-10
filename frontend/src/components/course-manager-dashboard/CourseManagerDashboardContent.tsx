"use client";

import { useTranslations } from "next-intl";
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

// Static mock data
const mockManager = {
  name: "Mohammed Al-Khalid",
  email: "m.alkhalid@physio.edu.sa",
  totalCourses: 12,
  totalInstructors: 6,
  nelcCompliance: 85,
  avatar: "/images/instructor-1.png",
};

// KPI Data for 3 main cards
const mockKPIData = {
  totalCourses: 12,
  totalEnrollments: 245,
  pendingReviews: 5,
};

// Stats data for right sidebar widget
const mockCourseStats = {
  activeCourses: 8,
  draftCourses: 2,
  completedCourses: 2,
  avgCompletionRate: 78,
  completionTrend: 5,
  avgRating: 4.6,
};

const mockCourses = [
  {
    id: "1",
    name: "ACLS Training",
    category: "Emergency Care",
    thumbnail: "AC",
    instructor: "Dr. Faisal Ahmed",
    status: "active" as const,
    enrolled: 45,
    capacity: 50,
    completionRate: 85,
    rating: 4.8,
  },
  {
    id: "2",
    name: "First Aid Certification",
    category: "Safety",
    thumbnail: "FA",
    instructor: "Dr. Sara Al-Rashid",
    status: "active" as const,
    enrolled: 32,
    capacity: 40,
    completionRate: 72,
    rating: 4.5,
  },
  {
    id: "3",
    name: "CPR Certification",
    category: "Emergency Care",
    thumbnail: "CP",
    instructor: "Dr. Khalid Hassan",
    status: "preparing" as const,
    enrolled: 12,
    capacity: 30,
    completionRate: null,
    rating: null,
  },
  {
    id: "4",
    name: "Emergency Response",
    category: "Emergency Care",
    thumbnail: "ER",
    instructor: "Dr. Fatima Noor",
    status: "completed" as const,
    enrolled: 50,
    capacity: 50,
    completionRate: 91,
    rating: 4.9,
  },
];

const mockSessions = [
  {
    id: "1",
    title: "ACLS Training - Module 3",
    time: "2:00 PM",
    date: "Today",
    type: "zoom" as const,
    enrolled: 25,
    capacity: 30,
  },
  {
    id: "2",
    title: "First Aid Practical",
    time: "4:30 PM",
    date: "Today",
    type: "onsite" as const,
    location: "Room 204",
    enrolled: 18,
    capacity: 20,
  },
  {
    id: "3",
    title: "CPR & ACLS Review",
    time: "10:00 AM",
    date: "Feb 10",
    type: "zoom" as const,
    enrolled: 22,
    capacity: 30,
    hasConflict: true,
  },
];

const mockContentReviewItems = [
  {
    id: "1",
    type: "video" as const,
    title: "Module 3 Video",
    courseName: "ACLS",
    submittedBy: "Dr. Faisal",
    checklist: [
      { id: "obj", label: "Objectives", passed: true },
      { id: "assess", label: "Assessments", passed: true },
      { id: "hours", label: "Hours", passed: true },
      { id: "wcag", label: "WCAG", passed: true },
      { id: "nelc", label: "NELC", passed: false },
    ],
  },
  {
    id: "2",
    type: "quiz" as const,
    title: "Final Quiz",
    courseName: "First Aid",
    submittedBy: "Dr. Sara",
    checklist: [
      { id: "obj", label: "Objectives", passed: true },
      { id: "assess", label: "Assessments", passed: true },
      { id: "hours", label: "Hours", passed: true },
      { id: "wcag", label: "WCAG", passed: true },
      { id: "nelc", label: "NELC", passed: true },
    ],
  },
  {
    id: "3",
    type: "pdf" as const,
    title: "Study Guide v2",
    courseName: "CPR",
    submittedBy: "Dr. Khalid",
    checklist: [
      { id: "obj", label: "Objectives", passed: true },
      { id: "assess", label: "Assessments", passed: true },
      { id: "hours", label: "Hours", passed: false },
      { id: "wcag", label: "WCAG", passed: true },
      { id: "nelc", label: "NELC", passed: true },
    ],
  },
];

const mockInstructors = [
  {
    id: "1",
    name: "Dr. Faisal Ahmed",
    initials: "FA",
    assignedCourses: 3,
    hoursPerWeek: 12,
    loadPercentage: 85,
    rating: 4.8,
    status: "busy" as const,
  },
  {
    id: "2",
    name: "Dr. Sara Al-Rashid",
    initials: "SA",
    assignedCourses: 2,
    hoursPerWeek: 8,
    loadPercentage: 50,
    rating: 4.5,
    status: "available" as const,
  },
  {
    id: "3",
    name: "Dr. Khalid Hassan",
    initials: "KH",
    assignedCourses: 4,
    hoursPerWeek: 16,
    loadPercentage: 95,
    rating: 4.7,
    status: "overloaded" as const,
  },
  {
    id: "4",
    name: "Dr. Fatima Noor",
    initials: "FN",
    assignedCourses: 2,
    hoursPerWeek: 6,
    loadPercentage: 35,
    rating: 4.9,
    status: "available" as const,
  },
];

const mockComplianceData = {
  percentage: 85,
  passed: 42,
  review: 6,
  failed: 2,
};

const mockReports = [
  {
    id: "1",
    type: "enrollment" as const,
    title: "Enrollment Report",
    description: "By course & date range",
  },
  {
    id: "2",
    type: "completion" as const,
    title: "Completion Report",
    description: "Rates & trends",
  },
  {
    id: "3",
    type: "satisfaction" as const,
    title: "Satisfaction Report",
    description: "Ratings & feedback",
  },
];

const CourseManagerDashboardContent = () => {
  const t = useTranslations("courseManagerDashboard");

  const handleApprove = (id: string) => {
    console.log("Approving:", id);
  };

  const handleReject = (id: string) => {
    console.log("Rejecting:", id);
  };

  const handlePreview = (id: string) => {
    console.log("Previewing:", id);
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <CourseManagerNavbar manager={mockManager} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile, shown via MobileSidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={mockManager} />
            </div>

            {/* Mobile Sidebar */}
            <CourseManagerMobileSidebar manager={mockManager} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)] mb-4 sm:mb-6">
                {t("title")}
              </h1>

              {/* KPI Cards */}
              <CourseManagerKPICards data={mockKPIData} />

              {/* Catalog Overview - Full Width */}
              <div className="mb-6">
                <CatalogOverviewWidget courses={mockCourses} />
              </div>

              {/* Content Review Queue - Full Width */}
              <div className="mb-6">
                <ContentReviewQueue
                  items={mockContentReviewItems}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onPreview={handlePreview}
                />
              </div>

              {/* NELC Compliance & Reports - Full Width */}
              <div className="mb-6">
                <NELCComplianceWidget
                  compliance={mockComplianceData}
                  reports={mockReports}
                />
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
              {/* Course Stats Widget */}
              <CourseStatsWidget data={mockCourseStats} />

              {/* Upcoming Sessions */}
              <UpcomingSessionsWidget sessions={mockSessions} />

              {/* Instructors Management */}
              <InstructorsManagementWidget instructors={mockInstructors} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CourseManagerDashboardContent;
