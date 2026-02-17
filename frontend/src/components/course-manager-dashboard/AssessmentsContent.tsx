"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";
import type { AssessmentResponse } from "@/types/instructor-dashboard";
import {
  Search,
  FileText,
  MoreVertical,
  Eye,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const AssessmentsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assessments, setAssessments] = useState<AssessmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessments = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (typeFilter !== "all") params.type = typeFilter;
    if (statusFilter !== "all") params.status = statusFilter;
    courseManagerApi
      .getAssessments(params)
      .then((res) => setAssessments(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load assessments")
      )
      .finally(() => setLoading(false));
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const filteredAssessments = assessments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      quiz: "bg-[#EFF6FF] text-[#3B82F6]",
      exam: "bg-[#FEE2E2] text-[#EF4444]",
      assignment: "bg-[#DCFCE7] text-[#22C55E]",
      practical: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || "bg-[#F3F4F6] text-[#6B7280]";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[#F3F4F6] text-[#6B7280]",
      archived: "bg-[#FEF3C7] text-[#D4A520]",
    };
    return styles[status] || "bg-[#F3F4F6] text-[#6B7280]";
  };

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("assessmentsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("assessmentsPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{assessments.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("assessmentsPage.stats.active")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {assessments.filter((a) => a.status === "active").length}
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

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                </div>
              )}

              {error && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-sm text-[#6B7280] mb-4">{error}</p>
                  <button
                    onClick={fetchAssessments}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("dashboard.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && filteredAssessments.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.assessment")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.type")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.totalMarks")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.passingMarks")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.status")}</th>
                          <th className="text-left text-xs font-medium text-[#6B7280] px-4 py-3">{t("assessmentsPage.table.actions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {filteredAssessments.map((assessment) => (
                          <tr key={assessment.id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="px-4 py-4">
                              <p className="text-sm font-medium text-[#1F2937]">{assessment.title}</p>
                              {assessment.durationMinutes && (
                                <p className="text-xs text-[#6B7280] mt-0.5">
                                  {assessment.durationMinutes} min
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getTypeBadge(assessment.type)}`}>
                                {t(`assessmentsPage.type.${assessment.type}`)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-[#1F2937]">{assessment.totalMarks}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-[#1F2937]">{assessment.passingMarks}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(assessment.status)}`}>
                                {t(`assessmentsPage.status.${assessment.status}`)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors" title={t("assessmentsPage.actions.view")}>
                                <Eye className="w-4 h-4 text-[#6B7280]" />
                              </button>
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
                            {assessment.durationMinutes && (
                              <p className="text-xs text-[#6B7280] mt-0.5">{assessment.durationMinutes} min</p>
                            )}
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
                          <span>{t("assessmentsPage.table.totalMarks")}: {assessment.totalMarks}</span>
                          <span>{t("assessmentsPage.table.passingMarks")}: {assessment.passingMarks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loading && !error && filteredAssessments.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
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
