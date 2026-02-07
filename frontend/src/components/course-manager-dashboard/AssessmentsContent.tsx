"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import {
  Search,
  Plus,
  FileText,
  Users,
  Clock,
  MoreVertical,
  CheckCircle,
  BarChart3,
  Edit,
  Copy,
  Eye,
  Trash2,
} from "lucide-react";

interface Assessment {
  id: string;
  title: string;
  courseName: string;
  type: "quiz" | "exam" | "assignment" | "practical";
  questions: number;
  duration: number;
  passingScore: number;
  attempts: number;
  avgScore: number;
  completionRate: number;
  status: "active" | "draft" | "archived";
  lastUpdated: string;
}

const mockManager = {
  name: "Mohammed Al-Khalid",
  email: "m.alkhalid@physio.edu.sa",
  totalCourses: 12,
  totalInstructors: 6,
  nelcCompliance: 85,
  avatar: "/images/instructor-1.png",
};

const AssessmentsContent = () => {
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const assessments: Assessment[] = [
    {
      id: "1",
      title: "ACLS Final Certification Exam",
      courseName: "ACLS Training",
      type: "exam",
      questions: 50,
      duration: 60,
      passingScore: 80,
      attempts: 145,
      avgScore: 82,
      completionRate: 91,
      status: "active",
      lastUpdated: "2026-02-05",
    },
    {
      id: "2",
      title: "First Aid Knowledge Quiz",
      courseName: "First Aid Certification",
      type: "quiz",
      questions: 25,
      duration: 30,
      passingScore: 70,
      attempts: 98,
      avgScore: 78,
      completionRate: 85,
      status: "active",
      lastUpdated: "2026-02-04",
    },
    {
      id: "3",
      title: "CPR Practical Assessment",
      courseName: "CPR Certification",
      type: "practical",
      questions: 10,
      duration: 45,
      passingScore: 85,
      attempts: 62,
      avgScore: 88,
      completionRate: 95,
      status: "active",
      lastUpdated: "2026-02-03",
    },
    {
      id: "4",
      title: "Module 2 Assignment",
      courseName: "Infection Control",
      type: "assignment",
      questions: 5,
      duration: 0,
      passingScore: 60,
      attempts: 45,
      avgScore: 72,
      completionRate: 78,
      status: "active",
      lastUpdated: "2026-02-02",
    },
    {
      id: "5",
      title: "Emergency Response Quiz Draft",
      courseName: "Emergency Response",
      type: "quiz",
      questions: 30,
      duration: 35,
      passingScore: 75,
      attempts: 0,
      avgScore: 0,
      completionRate: 0,
      status: "draft",
      lastUpdated: "2026-02-01",
    },
  ];

  const filteredAssessments = assessments.filter((assessment) => {
    const matchesSearch =
      assessment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      assessment.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || assessment.type === typeFilter;
    const matchesStatus = statusFilter === "all" || assessment.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      quiz: "bg-[#EFF6FF] text-[#3B82F6]",
      exam: "bg-[#FEE2E2] text-[#EF4444]",
      assignment: "bg-[#DCFCE7] text-[#22C55E]",
      practical: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || styles.quiz;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[#F3F4F6] text-[#6B7280]",
      archived: "bg-[#FEF3C7] text-[#D4A520]",
    };
    return styles[status] || styles.draft;
  };

  return (
    <>
      <CourseManagerNavbar manager={mockManager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={mockManager} />
            </div>
            <CourseManagerMobileSidebar manager={mockManager} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("assessmentsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("assessmentsPage.subtitle")}
                  </p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  {t("assessmentsPage.createAssessment")}
                </button>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{assessments.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.totalAttempts")}</p>
                  <p className="text-2xl font-bold text-[#3B82F6] mt-1">
                    {assessments.reduce((acc, a) => acc + a.attempts, 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.avgScore")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {Math.round(
                      assessments.filter((a) => a.avgScore > 0).reduce((acc, a) => acc + a.avgScore, 0) /
                        assessments.filter((a) => a.avgScore > 0).length
                    )}%
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.avgCompletion")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">
                    {Math.round(
                      assessments.filter((a) => a.completionRate > 0).reduce((acc, a) => acc + a.completionRate, 0) /
                        assessments.filter((a) => a.completionRate > 0).length
                    )}%
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("assessmentsPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("assessmentsPage.filters.allTypes")}</option>
                      <option value="quiz">{t("assessmentsPage.filters.quiz")}</option>
                      <option value="exam">{t("assessmentsPage.filters.exam")}</option>
                      <option value="assignment">{t("assessmentsPage.filters.assignment")}</option>
                      <option value="practical">{t("assessmentsPage.filters.practical")}</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("assessmentsPage.filters.allStatus")}</option>
                      <option value="active">{t("assessmentsPage.filters.active")}</option>
                      <option value="draft">{t("assessmentsPage.filters.draft")}</option>
                      <option value="archived">{t("assessmentsPage.filters.archived")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Assessments Table */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.assessment")}</th>
                        <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.type")}</th>
                        <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.questions")}</th>
                        <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.attempts")}</th>
                        <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.avgScore")}</th>
                        <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.status")}</th>
                        <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredAssessments.map((assessment) => (
                        <tr key={assessment.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm font-medium text-[#1F2937]">{assessment.title}</p>
                              <p className="text-xs text-[#6B7280] mt-0.5">{assessment.courseName}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getTypeBadge(assessment.type)}`}>
                              {t(`assessmentsPage.type.${assessment.type}`)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
                              <FileText className="w-4 h-4" />
                              {assessment.questions}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
                              <Users className="w-4 h-4" />
                              {assessment.attempts}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    assessment.avgScore >= 80 ? "bg-[#22C55E]" : assessment.avgScore >= 60 ? "bg-[#F59E0B]" : "bg-[#EF4444]"
                                  }`}
                                  style={{ width: `${assessment.avgScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-[#1F2937]">{assessment.avgScore}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(assessment.status)}`}>
                              {t(`assessmentsPage.status.${assessment.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors" title={t("assessmentsPage.actions.view")}>
                                <Eye className="w-4 h-4 text-[#6B7280]" />
                              </button>
                              <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors" title={t("assessmentsPage.actions.edit")}>
                                <Edit className="w-4 h-4 text-[#6B7280]" />
                              </button>
                              <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors" title={t("assessmentsPage.actions.analytics")}>
                                <BarChart3 className="w-4 h-4 text-[#6B7280]" />
                              </button>
                              <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors" title={t("assessmentsPage.actions.duplicate")}>
                                <Copy className="w-4 h-4 text-[#6B7280]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-[#E5E7EB]">
                  {filteredAssessments.map((assessment) => (
                    <div key={assessment.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-medium text-[#1F2937]">{assessment.title}</h3>
                          <p className="text-xs text-[#6B7280] mt-0.5">{assessment.courseName}</p>
                        </div>
                        <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4 text-[#6B7280]" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getTypeBadge(assessment.type)}`}>
                          {t(`assessmentsPage.type.${assessment.type}`)}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(assessment.status)}`}>
                          {t(`assessmentsPage.status.${assessment.status}`)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {assessment.questions} Q
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {assessment.attempts}
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {assessment.avgScore}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {filteredAssessments.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center mt-4">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("assessmentsPage.noAssessments")}
                  </h3>
                  <p className="text-sm text-[#6B7280]">
                    {t("assessmentsPage.noAssessmentsDesc")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssessmentsContent;
