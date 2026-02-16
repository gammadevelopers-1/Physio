"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import {
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  Video,
  MapPin,
  BookOpen,
  Settings,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Play,
  FileText,
  CheckCircle,
  Circle,
  Edit,
  Trash2,
  Plus,
} from "lucide-react";

interface CourseDetailContentProps {
  courseId: string;
}

const CourseDetailContent = ({ courseId }: CourseDetailContentProps) => {
  const instructor = useInstructorProfile();
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");
  const [activeTab, setActiveTab] = useState<"overview" | "modules" | "students" | "sessions" | "analytics" | "settings">("overview");
  const [expandedModules, setExpandedModules] = useState<string[]>(["module-1"]);

  // Mock course data
  const course = {
    id: courseId,
    title: t("mockData.aclsTraining"),
    description: "A comprehensive course covering advanced cardiovascular life support techniques, protocols, and hands-on practice for healthcare professionals.",
    thumbnail: "/student_dashboard/courses/image 473.svg",
    status: "active" as const,
    delivery: "zoom" as const,
    enrolledStudents: 25,
    completionRate: 68,
    totalSessions: 12,
    completedSessions: 8,
    duration: "8 weeks",
    startDate: "Jan 15, 2026",
    endDate: "Mar 10, 2026",
  };

  const modules = [
    {
      id: "module-1",
      title: t("mockData.module1"),
      lessons: [
        { id: "l1", title: "Introduction to ACLS", duration: "45 min", type: "video", completed: true },
        { id: "l2", title: "Basic Life Support Review", duration: "30 min", type: "video", completed: true },
        { id: "l3", title: "Module 1 Assessment", duration: "20 min", type: "quiz", completed: true },
      ],
    },
    {
      id: "module-2",
      title: t("mockData.module2"),
      lessons: [
        { id: "l4", title: "ECG Recognition", duration: "60 min", type: "video", completed: true },
        { id: "l5", title: "Rhythm Analysis", duration: "45 min", type: "video", completed: false },
        { id: "l6", title: "Practical Exercise 1", duration: "30 min", type: "document", completed: false },
      ],
    },
    {
      id: "module-3",
      title: t("mockData.module3"),
      lessons: [
        { id: "l7", title: "Advanced Techniques", duration: "60 min", type: "video", completed: false },
        { id: "l8", title: "Case Studies", duration: "45 min", type: "document", completed: false },
      ],
    },
  ];

  const enrolledStudents = [
    { id: "s1", name: "Ahmed Al-Khalid", email: "ahmed@example.com", progress: 85, status: "good" },
    { id: "s2", name: "Sara Mohammed", email: "sara@example.com", progress: 52, status: "at-risk" },
    { id: "s3", name: "Khalid Hassan", email: "khalid@example.com", progress: 45, status: "at-risk" },
    { id: "s4", name: "Fatima Al-Rashid", email: "fatima@example.com", progress: 92, status: "good" },
    { id: "s5", name: "Omar Abdullah", email: "omar@example.com", progress: 78, status: "good" },
  ];

  const upcomingSessions = [
    { id: "ses1", title: "Module 2: ECG Recognition", date: "Today", time: "2:00 PM - 3:30 PM", type: "zoom" },
    { id: "ses2", title: "Module 2: Rhythm Analysis", date: "Feb 8, 2026", time: "2:00 PM - 3:30 PM", type: "zoom" },
    { id: "ses3", title: "Practical Session", date: "Feb 10, 2026", time: "4:00 PM - 6:00 PM", type: "onsite" },
  ];

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const tabs = [
    { id: "overview" as const, label: t("courseDetail.tabs.overview") },
    { id: "modules" as const, label: t("courseDetail.tabs.modules") },
    { id: "students" as const, label: t("courseDetail.tabs.students") },
    { id: "sessions" as const, label: t("courseDetail.tabs.sessions") },
    { id: "analytics" as const, label: t("courseDetail.tabs.analytics") },
    { id: "settings" as const, label: t("courseDetail.tabs.settings") },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0">
              {/* Back Button */}
              <Link
                href={`/${locale}/dashboard/instructor/courses`}
                className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>

              {/* Course Header */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
                <div className="relative h-48 sm:h-56">
                  <Image
                    src={course.thumbnail}
                    alt={course.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 bg-[#DCFCE7] text-[#22C55E] rounded-md text-xs font-medium">
                        {t(`courses.status.${course.status}`)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 rounded-md text-xs font-medium text-[#374151]">
                        <Video className="w-3.5 h-3.5" />
                        {t(`courses.delivery.${course.delivery}`)}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">
                      {course.title}
                    </h1>
                  </div>
                </div>

                {/* Course Stats */}
                <div className="p-4 border-t border-[#E5E7EB]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">{course.enrolledStudents}</p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.students")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#D4A520]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">{course.completedSessions}/{course.totalSessions}</p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.sessions")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-[#22C55E]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">{course.completionRate}%</p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.completion")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F3E8FF] rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#9333EA]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">{course.duration}</p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.duration")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap relative transition-colors ${
                        activeTab === tab.id
                          ? "text-[#3B82F6]"
                          : "text-[#6B7280] hover:text-[#374151]"
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {/* Overview Tab */}
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-[#1F2937] mb-2">
                          {t("courseDetail.description")}
                        </h3>
                        <p className="text-sm text-[#6B7280] leading-relaxed">
                          {course.description}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-[#F9FAFB] rounded-lg">
                          <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.startDate")}</p>
                          <p className="text-sm font-medium text-[#1F2937]">{course.startDate}</p>
                        </div>
                        <div className="p-4 bg-[#F9FAFB] rounded-lg">
                          <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.endDate")}</p>
                          <p className="text-sm font-medium text-[#1F2937]">{course.endDate}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modules Tab */}
                  {activeTab === "modules" && (
                    <div className="space-y-3">
                      {modules.map((module) => (
                        <div key={module.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleModule(module.id)}
                            className="w-full flex items-center justify-between p-4 bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors"
                          >
                            <span className="text-sm font-semibold text-[#1F2937]">{module.title}</span>
                            <ChevronDown
                              className={`w-5 h-5 text-[#6B7280] transition-transform ${
                                expandedModules.includes(module.id) ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {expandedModules.includes(module.id) && (
                            <div className="divide-y divide-[#E5E7EB]">
                              {module.lessons.map((lesson) => (
                                <div key={lesson.id} className="flex items-center justify-between p-4">
                                  <div className="flex items-center gap-3">
                                    {lesson.completed ? (
                                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-[#E5E7EB]" />
                                    )}
                                    <div>
                                      <p className="text-sm font-medium text-[#1F2937]">{lesson.title}</p>
                                      <p className="text-xs text-[#6B7280]">{lesson.duration}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {lesson.type === "video" && <Play className="w-4 h-4 text-[#6B7280]" />}
                                    {lesson.type === "document" && <FileText className="w-4 h-4 text-[#6B7280]" />}
                                    {lesson.type === "quiz" && <BookOpen className="w-4 h-4 text-[#6B7280]" />}
                                    <button className="p-1.5 hover:bg-[#F3F4F6] rounded">
                                      <Edit className="w-4 h-4 text-[#6B7280]" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button className="w-full flex items-center justify-center gap-2 p-3 text-sm text-[#3B82F6] hover:bg-[#F9FAFB] transition-colors">
                                <Plus className="w-4 h-4" />
                                {t("courseDetail.addLesson")}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      <button className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
                        <Plus className="w-4 h-4" />
                        {t("courseDetail.addModule")}
                      </button>
                    </div>
                  )}

                  {/* Students Tab */}
                  {activeTab === "students" && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left border-b border-[#E5E7EB]">
                            <th className="pb-3 text-xs font-medium text-[#6B7280]">{t("courseDetail.studentName")}</th>
                            <th className="pb-3 text-xs font-medium text-[#6B7280]">{t("courseDetail.email")}</th>
                            <th className="pb-3 text-xs font-medium text-[#6B7280]">{t("courseDetail.progress")}</th>
                            <th className="pb-3 text-xs font-medium text-[#6B7280]">{t("courseDetail.status")}</th>
                            <th className="pb-3 text-xs font-medium text-[#6B7280]">{t("courseDetail.actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrolledStudents.map((student) => (
                            <tr key={student.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                              <td className="py-3 text-sm font-medium text-[#1F2937]">{student.name}</td>
                              <td className="py-3 text-sm text-[#6B7280]">{student.email}</td>
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${student.status === "good" ? "bg-[#22C55E]" : "bg-[#F97316]"}`}
                                      style={{ width: `${student.progress}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-[#6B7280]">{student.progress}%</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  student.status === "good" ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FFEDD5] text-[#F97316]"
                                }`}>
                                  {student.status === "good" ? t("courseDetail.statusGood") : t("courseDetail.statusAtRisk")}
                                </span>
                              </td>
                              <td className="py-3">
                                <Link
                                  href={`/${locale}/dashboard/instructor/students/${student.id}`}
                                  className="text-xs text-[#3B82F6] hover:underline"
                                >
                                  {t("courseDetail.viewProfile")}
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Sessions Tab */}
                  {activeTab === "sessions" && (
                    <div className="space-y-3">
                      {upcomingSessions.map((session) => (
                        <div key={session.id} className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              session.type === "zoom" ? "bg-[#EFF6FF]" : "bg-[#DCFCE7]"
                            }`}>
                              {session.type === "zoom" ? (
                                <Video className="w-5 h-5 text-[#3B82F6]" />
                              ) : (
                                <MapPin className="w-5 h-5 text-[#22C55E]" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#1F2937]">{session.title}</p>
                              <p className="text-xs text-[#6B7280]">{session.date} • {session.time}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors">
                              {t("courseDetail.startSession")}
                            </button>
                            <button className="p-1.5 hover:bg-[#F3F4F6] rounded">
                              <Edit className="w-4 h-4 text-[#6B7280]" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
                        <Plus className="w-4 h-4" />
                        {t("courseDetail.scheduleSession")}
                      </button>
                    </div>
                  )}

                  {/* Analytics Tab */}
                  {activeTab === "analytics" && (
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                        {t("courseDetail.analyticsTitle")}
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        {t("courseDetail.analyticsDescription")}
                      </p>
                    </div>
                  )}

                  {/* Settings Tab */}
                  {activeTab === "settings" && (
                    <div className="text-center py-12">
                      <Settings className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                        {t("courseDetail.settingsTitle")}
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        {t("courseDetail.settingsDescription")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CourseDetailContent;
