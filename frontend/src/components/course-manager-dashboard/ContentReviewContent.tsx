"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import {
  Search,
  Video,
  FileText,
  HelpCircle,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ChevronDown,
} from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
}

interface ContentItem {
  id: string;
  type: "video" | "pdf" | "quiz" | "document";
  title: string;
  courseName: string;
  submittedBy: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  checklist: ChecklistItem[];
  description?: string;
}

const mockManager = {
  name: "Mohammed Al-Khalid",
  email: "m.alkhalid@physio.edu.sa",
  totalCourses: 12,
  totalInstructors: 6,
  nelcCompliance: 85,
  avatar: "/images/instructor-1.png",
};

const ContentReviewContent = () => {
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const contentItems: ContentItem[] = [
    {
      id: "1",
      type: "video",
      title: "Module 3 Video - ECG Interpretation",
      courseName: "ACLS Training",
      submittedBy: "Dr. Faisal Ahmed",
      submittedAt: "2026-02-06",
      status: "pending",
      description: "Video covering ECG interpretation basics for ACLS certification.",
      checklist: [
        { id: "obj", label: "Learning Objectives", passed: true },
        { id: "assess", label: "Assessments Linked", passed: true },
        { id: "hours", label: "Contact Hours", passed: true },
        { id: "wcag", label: "WCAG Compliant", passed: true },
        { id: "nelc", label: "NELC Standards", passed: false },
      ],
    },
    {
      id: "2",
      type: "quiz",
      title: "Final Assessment Quiz",
      courseName: "First Aid Certification",
      submittedBy: "Dr. Sara Al-Rashid",
      submittedAt: "2026-02-05",
      status: "pending",
      description: "30-question final assessment for First Aid certification.",
      checklist: [
        { id: "obj", label: "Learning Objectives", passed: true },
        { id: "assess", label: "Assessments Linked", passed: true },
        { id: "hours", label: "Contact Hours", passed: true },
        { id: "wcag", label: "WCAG Compliant", passed: true },
        { id: "nelc", label: "NELC Standards", passed: true },
      ],
    },
    {
      id: "3",
      type: "pdf",
      title: "Study Guide v2 - Updated",
      courseName: "CPR Certification",
      submittedBy: "Dr. Khalid Hassan",
      submittedAt: "2026-02-04",
      status: "pending",
      description: "Updated study guide with latest AHA guidelines.",
      checklist: [
        { id: "obj", label: "Learning Objectives", passed: true },
        { id: "assess", label: "Assessments Linked", passed: true },
        { id: "hours", label: "Contact Hours", passed: false },
        { id: "wcag", label: "WCAG Compliant", passed: true },
        { id: "nelc", label: "NELC Standards", passed: true },
      ],
    },
    {
      id: "4",
      type: "video",
      title: "Infection Control Procedures",
      courseName: "Infection Control",
      submittedBy: "Dr. Ahmed Youssef",
      submittedAt: "2026-02-03",
      status: "approved",
      checklist: [
        { id: "obj", label: "Learning Objectives", passed: true },
        { id: "assess", label: "Assessments Linked", passed: true },
        { id: "hours", label: "Contact Hours", passed: true },
        { id: "wcag", label: "WCAG Compliant", passed: true },
        { id: "nelc", label: "NELC Standards", passed: true },
      ],
    },
    {
      id: "5",
      type: "document",
      title: "Course Syllabus Draft",
      courseName: "Patient Safety",
      submittedBy: "Dr. Fatima Noor",
      submittedAt: "2026-02-02",
      status: "rejected",
      description: "Course syllabus missing required components.",
      checklist: [
        { id: "obj", label: "Learning Objectives", passed: false },
        { id: "assess", label: "Assessments Linked", passed: false },
        { id: "hours", label: "Contact Hours", passed: true },
        { id: "wcag", label: "WCAG Compliant", passed: true },
        { id: "nelc", label: "NELC Standards", passed: false },
      ],
    },
  ];

  const filteredItems = contentItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getTypeIcon = (type: string) => {
    const icons: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
      video: { icon: <Video className="w-5 h-5" />, bg: "bg-[#DBEAFE]", color: "text-[#3B82F6]" },
      pdf: { icon: <FileText className="w-5 h-5" />, bg: "bg-[#FEE2E2]", color: "text-[#EF4444]" },
      quiz: { icon: <HelpCircle className="w-5 h-5" />, bg: "bg-[#FFEDD5]", color: "text-[#F97316]" },
      document: { icon: <FileText className="w-5 h-5" />, bg: "bg-[#E0E7FF]", color: "text-[#6366F1]" },
    };
    return icons[type] || icons.document;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: "bg-[#FEF3C7]", text: "text-[#D4A520]", icon: <Clock className="w-3.5 h-3.5" /> },
      approved: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", icon: <CheckCircle className="w-3.5 h-3.5" /> },
      rejected: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", icon: <XCircle className="w-3.5 h-3.5" /> },
    };
    return styles[status] || styles.pending;
  };

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
                    {t("contentReviewPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("contentReviewPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("contentReviewPage.stats.pending")}</p>
                  <p className="text-2xl font-bold text-[#D4A520] mt-1">
                    {contentItems.filter((i) => i.status === "pending").length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("contentReviewPage.stats.approved")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {contentItems.filter((i) => i.status === "approved").length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("contentReviewPage.stats.rejected")}</p>
                  <p className="text-2xl font-bold text-[#EF4444] mt-1">
                    {contentItems.filter((i) => i.status === "rejected").length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("contentReviewPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{contentItems.length}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("contentReviewPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("contentReviewPage.filters.allStatus")}</option>
                      <option value="pending">{t("contentReviewPage.filters.pending")}</option>
                      <option value="approved">{t("contentReviewPage.filters.approved")}</option>
                      <option value="rejected">{t("contentReviewPage.filters.rejected")}</option>
                    </select>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("contentReviewPage.filters.allTypes")}</option>
                      <option value="video">{t("contentReviewPage.filters.video")}</option>
                      <option value="pdf">{t("contentReviewPage.filters.pdf")}</option>
                      <option value="quiz">{t("contentReviewPage.filters.quiz")}</option>
                      <option value="document">{t("contentReviewPage.filters.document")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Content Items */}
              <div className="space-y-4">
                {filteredItems.map((item) => {
                  const typeStyle = getTypeIcon(item.type);
                  const statusStyle = getStatusBadge(item.status);
                  const allPassed = item.checklist.every((c) => c.passed);

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 ${typeStyle.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <span className={typeStyle.color}>{typeStyle.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="text-base font-semibold text-[#1F2937]">{item.title}</h3>
                                <p className="text-sm text-[#6B7280] mt-0.5">
                                  {item.courseName} • {item.submittedBy}
                                </p>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
                                {statusStyle.icon}
                                {t(`contentReviewPage.status.${item.status}`)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-sm text-[#6B7280] mt-2">{item.description}</p>
                            )}

                            {/* Checklist */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {item.checklist.map((check) => (
                                <div
                                  key={check.id}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                    check.passed
                                      ? "bg-[#DCFCE7] text-[#22C55E]"
                                      : "bg-[#FEE2E2] text-[#EF4444]"
                                  }`}
                                >
                                  {check.passed ? (
                                    <CheckCircle className="w-3 h-3" />
                                  ) : (
                                    <XCircle className="w-3 h-3" />
                                  )}
                                  {check.label}
                                </div>
                              ))}
                            </div>

                            <p className="text-xs text-[#9CA3AF] mt-3">
                              {t("contentReviewPage.submittedOn")} {item.submittedAt}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 lg:flex-shrink-0">
                          <button
                            onClick={() => handlePreview(item.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#E5E7EB] text-[#6B7280] text-sm font-medium rounded-lg hover:bg-[#F9FAFB] transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            {t("contentReviewPage.preview")}
                          </button>
                          {item.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(item.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#22C55E] text-white text-sm font-medium rounded-lg hover:bg-[#16A34A] transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                                {t("contentReviewPage.approve")}
                              </button>
                              <button
                                onClick={() => handleReject(item.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-[#EF4444] border border-[#FEE2E2] text-sm font-medium rounded-lg hover:bg-[#FEF2F2] transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                                {t("contentReviewPage.reject")}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredItems.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("contentReviewPage.noContent")}
                  </h3>
                  <p className="text-sm text-[#6B7280]">
                    {t("contentReviewPage.noContentDesc")}
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

export default ContentReviewContent;
