"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import {
  Search,
  Filter,
  ChevronDown,
  Award,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  MoreVertical,
  Users,
  FileCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Calendar,
  BookOpen,
  ClipboardCheck,
  Percent,
} from "lucide-react";

interface Certificate {
  id: string;
  studentName: string;
  studentInitials: string;
  courseName: string;
  requestDate: string;
  eligibility: {
    attendance: { met: boolean; value: string; required: string };
    assessment: { met: boolean; value: string; required: string };
    completion: { met: boolean; value: string; required: string };
  };
  status: "pending" | "approved" | "rejected";
  approvedDate?: string;
  certificateNumber?: string;
}

const mockInstructor = {
  name: "Dr. Faisal Al-Otaibi",
  email: "faisal@healthtraining.sa",
  rating: 4.8,
  courseCompletion: 92,
  avatar: "/images/instructor-1.png",
};

const CertificatesContent = () => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Mock data
  const courses = [
    { id: "all", name: t("certificates.allCourses") },
    { id: "course1", name: "Lower Back Pain Management" },
    { id: "course2", name: "Sports Rehabilitation" },
    { id: "course3", name: "Pediatric Physiotherapy" },
  ];

  const statusOptions = [
    { id: "all", name: t("certificates.allStatuses") },
    { id: "pending", name: t("certificates.statusPending") },
    { id: "approved", name: t("certificates.statusApproved") },
    { id: "rejected", name: t("certificates.statusRejected") },
  ];

  const certificates: Certificate[] = [
    {
      id: "1",
      studentName: "Sarah Johnson",
      studentInitials: "SJ",
      courseName: "Lower Back Pain Management",
      requestDate: "Feb 5, 2024",
      eligibility: {
        attendance: { met: true, value: "95%", required: "80%" },
        assessment: { met: true, value: "88%", required: "70%" },
        completion: { met: true, value: "100%", required: "100%" },
      },
      status: "pending",
    },
    {
      id: "2",
      studentName: "Ahmed Al-Hassan",
      studentInitials: "AH",
      courseName: "Sports Rehabilitation",
      requestDate: "Feb 3, 2024",
      eligibility: {
        attendance: { met: false, value: "72%", required: "80%" },
        assessment: { met: true, value: "85%", required: "70%" },
        completion: { met: true, value: "100%", required: "100%" },
      },
      status: "pending",
    },
    {
      id: "3",
      studentName: "Maria Garcia",
      studentInitials: "MG",
      courseName: "Lower Back Pain Management",
      requestDate: "Jan 28, 2024",
      eligibility: {
        attendance: { met: true, value: "92%", required: "80%" },
        assessment: { met: true, value: "91%", required: "70%" },
        completion: { met: true, value: "100%", required: "100%" },
      },
      status: "approved",
      approvedDate: "Jan 30, 2024",
      certificateNumber: "CERT-2024-0128",
    },
    {
      id: "4",
      studentName: "James Wilson",
      studentInitials: "JW",
      courseName: "Pediatric Physiotherapy",
      requestDate: "Jan 25, 2024",
      eligibility: {
        attendance: { met: true, value: "88%", required: "80%" },
        assessment: { met: false, value: "65%", required: "70%" },
        completion: { met: true, value: "100%", required: "100%" },
      },
      status: "rejected",
    },
    {
      id: "5",
      studentName: "Fatima Al-Rashid",
      studentInitials: "FR",
      courseName: "Sports Rehabilitation",
      requestDate: "Jan 20, 2024",
      eligibility: {
        attendance: { met: true, value: "96%", required: "80%" },
        assessment: { met: true, value: "92%", required: "70%" },
        completion: { met: true, value: "100%", required: "100%" },
      },
      status: "approved",
      approvedDate: "Jan 22, 2024",
      certificateNumber: "CERT-2024-0122",
    },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "approved":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "rejected":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3 h-3" />;
      case "approved":
        return <CheckCircle className="w-3 h-3" />;
      case "rejected":
        return <XCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const isFullyEligible = (cert: Certificate) => {
    return (
      cert.eligibility.attendance.met &&
      cert.eligibility.assessment.met &&
      cert.eligibility.completion.met
    );
  };

  const openReviewModal = (cert: Certificate) => {
    setSelectedCertificate(cert);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedCertificate(null);
    setShowModal(false);
  };

  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch =
      cert.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse =
      selectedCourse === "all" ||
      cert.courseName.toLowerCase().includes(
        courses.find((c) => c.id === selectedCourse)?.name.toLowerCase() || ""
      );
    const matchesStatus =
      selectedStatus === "all" || cert.status === selectedStatus;

    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Stats
  const totalRequests = certificates.length;
  const pendingRequests = certificates.filter((c) => c.status === "pending").length;
  const approvedCerts = certificates.filter((c) => c.status === "approved").length;
  const rejectedCerts = certificates.filter((c) => c.status === "rejected").length;

  return (
    <>
      <InstructorNavbar instructor={mockInstructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={mockInstructor} />
            </div>
            <InstructorMobileSidebar instructor={mockInstructor} />

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                    {t("certificates.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("certificates.subtitle")}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                      <Award className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{totalRequests}</p>
                      <p className="text-xs text-[#6B7280]">{t("certificates.totalRequests")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEF9C3] flex items-center justify-center">
                      <Clock className="w-5 h-5 text-[#EAB308]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{pendingRequests}</p>
                      <p className="text-xs text-[#6B7280]">{t("certificates.pending")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{approvedCerts}</p>
                      <p className="text-xs text-[#6B7280]">{t("certificates.approved")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-[#EF4444]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{rejectedCerts}</p>
                      <p className="text-xs text-[#6B7280]">{t("certificates.rejected")}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <input
                      type="text"
                      placeholder={t("certificates.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                    />
                  </div>

                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] hover:bg-[#F9FAFB]"
                  >
                    <Filter className="w-4 h-4" />
                    {t("certificates.filters")}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                    />
                  </button>

                  <div className="hidden md:flex gap-3">
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {showFilters && (
                  <div className="md:hidden mt-4 pt-4 border-t border-[#E5E7EB] grid grid-cols-2 gap-3">
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Certificates Table */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("certificates.tableStudent")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("certificates.tableCourse")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("certificates.tableEligibility")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("certificates.tableRequestDate")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("certificates.tableStatus")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("certificates.tableActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredCertificates.map((cert) => (
                        <tr
                          key={cert.id}
                          className="hover:bg-[#F9FAFB] transition-colors"
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-semibold text-[#4B5563]">
                                {cert.studentInitials}
                              </div>
                              <span className="text-sm font-medium text-[#1F2937]">
                                {cert.studentName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-[#374151]">{cert.courseName}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center ${
                                  cert.eligibility.attendance.met
                                    ? "bg-[#DCFCE7] text-[#22C55E]"
                                    : "bg-[#FEE2E2] text-[#EF4444]"
                                }`}
                                title={`${t("certificates.attendance")}: ${cert.eligibility.attendance.value}`}
                              >
                                {cert.eligibility.attendance.met ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                              </span>
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center ${
                                  cert.eligibility.assessment.met
                                    ? "bg-[#DCFCE7] text-[#22C55E]"
                                    : "bg-[#FEE2E2] text-[#EF4444]"
                                }`}
                                title={`${t("certificates.assessment")}: ${cert.eligibility.assessment.value}`}
                              >
                                {cert.eligibility.assessment.met ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                              </span>
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center ${
                                  cert.eligibility.completion.met
                                    ? "bg-[#DCFCE7] text-[#22C55E]"
                                    : "bg-[#FEE2E2] text-[#EF4444]"
                                }`}
                                title={`${t("certificates.completion")}: ${cert.eligibility.completion.value}`}
                              >
                                {cert.eligibility.completion.met ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <X className="w-3 h-3" />
                                )}
                              </span>
                              {!isFullyEligible(cert) && (
                                <AlertTriangle className="w-4 h-4 text-[#EAB308] ml-1" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-[#6B7280]">{cert.requestDate}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(cert.status)}`}
                            >
                              {getStatusIcon(cert.status)}
                              {t(`certificates.status${cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}`)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              {cert.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => openReviewModal(cert)}
                                    className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                    title={t("certificates.review")}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="p-2 text-[#6B7280] hover:text-[#22C55E] hover:bg-[#DCFCE7] rounded-lg transition-colors"
                                    title={t("certificates.approve")}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button
                                    className="p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                                    title={t("certificates.reject")}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {cert.status === "approved" && (
                                <button
                                  className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                  title={t("certificates.download")}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                              <button className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
                  <p className="text-sm text-[#6B7280]">
                    {t("certificates.showing")} {filteredCertificates.length}{" "}
                    {t("certificates.of")} {certificates.length} {t("certificates.requests")}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRTL ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronLeft className="w-4 h-4" />
                      )}
                    </button>
                    <span className="px-3 py-1 text-sm text-[#374151]">{currentPage}</span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      {isRTL ? (
                        <ChevronLeft className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {filteredCertificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-semibold text-[#4B5563]">
                          {cert.studentInitials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">
                            {cert.studentName}
                          </p>
                          <p className="text-xs text-[#6B7280]">{cert.courseName}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(cert.status)}`}
                      >
                        {getStatusIcon(cert.status)}
                        {t(`certificates.status${cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}`)}
                      </span>
                    </div>

                    {/* Eligibility Checks */}
                    <div className="grid grid-cols-3 gap-2 mb-3 p-3 bg-[#F9FAFB] rounded-lg">
                      <div className="text-center">
                        <div
                          className={`w-6 h-6 mx-auto rounded flex items-center justify-center mb-1 ${
                            cert.eligibility.attendance.met
                              ? "bg-[#DCFCE7] text-[#22C55E]"
                              : "bg-[#FEE2E2] text-[#EF4444]"
                          }`}
                        >
                          {cert.eligibility.attendance.met ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <p className="text-[10px] text-[#6B7280]">
                          {t("certificates.attendance")}
                        </p>
                        <p className="text-xs font-medium text-[#374151]">
                          {cert.eligibility.attendance.value}
                        </p>
                      </div>
                      <div className="text-center">
                        <div
                          className={`w-6 h-6 mx-auto rounded flex items-center justify-center mb-1 ${
                            cert.eligibility.assessment.met
                              ? "bg-[#DCFCE7] text-[#22C55E]"
                              : "bg-[#FEE2E2] text-[#EF4444]"
                          }`}
                        >
                          {cert.eligibility.assessment.met ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <p className="text-[10px] text-[#6B7280]">
                          {t("certificates.assessment")}
                        </p>
                        <p className="text-xs font-medium text-[#374151]">
                          {cert.eligibility.assessment.value}
                        </p>
                      </div>
                      <div className="text-center">
                        <div
                          className={`w-6 h-6 mx-auto rounded flex items-center justify-center mb-1 ${
                            cert.eligibility.completion.met
                              ? "bg-[#DCFCE7] text-[#22C55E]"
                              : "bg-[#FEE2E2] text-[#EF4444]"
                          }`}
                        >
                          {cert.eligibility.completion.met ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <p className="text-[10px] text-[#6B7280]">
                          {t("certificates.completion")}
                        </p>
                        <p className="text-xs font-medium text-[#374151]">
                          {cert.eligibility.completion.value}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-[#9CA3AF] mb-3">
                      {t("certificates.requested")}: {cert.requestDate}
                    </p>

                    {cert.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openReviewModal(cert)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          {t("certificates.review")}
                        </button>
                        <button className="flex items-center justify-center px-3 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button className="flex items-center justify-center px-3 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {cert.status === "approved" && (
                      <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors text-sm font-medium">
                        <Download className="w-4 h-4" />
                        {t("certificates.downloadCertificate")}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Review Modal */}
              {showModal && selectedCertificate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                            <Award className="w-6 h-6 text-[#D4A520]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-[#1F2937]">
                              {t("certificates.reviewRequest")}
                            </h3>
                            <p className="text-sm text-[#6B7280]">
                              {selectedCertificate.courseName}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={closeModal}
                          className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Student Info */}
                      <div className="p-4 bg-[#F9FAFB] rounded-xl mb-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-semibold text-[#4B5563]">
                            {selectedCertificate.studentInitials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1F2937]">
                              {selectedCertificate.studentName}
                            </p>
                            <p className="text-xs text-[#6B7280]">
                              {t("certificates.requested")}: {selectedCertificate.requestDate}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Eligibility Checks */}
                      <h4 className="text-sm font-semibold text-[#1F2937] mb-3">
                        {t("certificates.eligibilityChecks")}
                      </h4>
                      <div className="space-y-3 mb-6">
                        <div
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            selectedCertificate.eligibility.attendance.met
                              ? "bg-[#DCFCE7]"
                              : "bg-[#FEE2E2]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Calendar
                              className={`w-5 h-5 ${
                                selectedCertificate.eligibility.attendance.met
                                  ? "text-[#22C55E]"
                                  : "text-[#EF4444]"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-[#1F2937]">
                                {t("certificates.attendanceRequirement")}
                              </p>
                              <p className="text-xs text-[#6B7280]">
                                {t("certificates.required")}: {selectedCertificate.eligibility.attendance.required}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              selectedCertificate.eligibility.attendance.met
                                ? "text-[#22C55E]"
                                : "text-[#EF4444]"
                            }`}
                          >
                            {selectedCertificate.eligibility.attendance.value}
                          </span>
                        </div>

                        <div
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            selectedCertificate.eligibility.assessment.met
                              ? "bg-[#DCFCE7]"
                              : "bg-[#FEE2E2]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <ClipboardCheck
                              className={`w-5 h-5 ${
                                selectedCertificate.eligibility.assessment.met
                                  ? "text-[#22C55E]"
                                  : "text-[#EF4444]"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-[#1F2937]">
                                {t("certificates.assessmentRequirement")}
                              </p>
                              <p className="text-xs text-[#6B7280]">
                                {t("certificates.required")}: {selectedCertificate.eligibility.assessment.required}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              selectedCertificate.eligibility.assessment.met
                                ? "text-[#22C55E]"
                                : "text-[#EF4444]"
                            }`}
                          >
                            {selectedCertificate.eligibility.assessment.value}
                          </span>
                        </div>

                        <div
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            selectedCertificate.eligibility.completion.met
                              ? "bg-[#DCFCE7]"
                              : "bg-[#FEE2E2]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <BookOpen
                              className={`w-5 h-5 ${
                                selectedCertificate.eligibility.completion.met
                                  ? "text-[#22C55E]"
                                  : "text-[#EF4444]"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-[#1F2937]">
                                {t("certificates.completionRequirement")}
                              </p>
                              <p className="text-xs text-[#6B7280]">
                                {t("certificates.required")}: {selectedCertificate.eligibility.completion.required}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              selectedCertificate.eligibility.completion.met
                                ? "text-[#22C55E]"
                                : "text-[#EF4444]"
                            }`}
                          >
                            {selectedCertificate.eligibility.completion.value}
                          </span>
                        </div>
                      </div>

                      {/* Warning if not fully eligible */}
                      {!isFullyEligible(selectedCertificate) && (
                        <div className="flex items-start gap-3 p-4 bg-[#FEF9C3] rounded-xl mb-6">
                          <AlertTriangle className="w-5 h-5 text-[#EAB308] flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-[#92400E]">
                              {t("certificates.notFullyEligible")}
                            </p>
                            <p className="text-xs text-[#A16207] mt-1">
                              {t("certificates.notFullyEligibleDesc")}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <button
                          onClick={closeModal}
                          className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                        >
                          {t("certificates.cancel")}
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626] transition-colors">
                          <XCircle className="w-4 h-4" />
                          {t("certificates.reject")}
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#22C55E] text-white rounded-lg text-sm font-medium hover:bg-[#16A34A] transition-colors">
                          <CheckCircle className="w-4 h-4" />
                          {t("certificates.approve")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CertificatesContent;
