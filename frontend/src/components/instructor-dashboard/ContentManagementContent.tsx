"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import {
  Search,
  Filter,
  ChevronDown,
  Upload,
  FolderOpen,
  FileVideo,
  FileText,
  File,
  Image,
  MoreVertical,
  Check,
  AlertTriangle,
  X,
  Clock,
  Download,
  Trash2,
  Edit3,
  Eye,
  Copy,
  Grid,
  List,
  HardDrive,
  FileCheck,
  Video,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface ContentFile {
  id: string;
  name: string;
  type: "video" | "pdf" | "document" | "image" | "other";
  size: string;
  course: string;
  uploadedAt: string;
  status: "live" | "processing" | "failed";
  wcagCompliant: boolean | "warning" | "pending";
  version: string;
  downloads: number;
}

const ContentManagementContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Mock data
  const courses = [
    { id: "all", name: t("content.allCourses") },
    { id: "course1", name: "Lower Back Pain Management" },
    { id: "course2", name: "Sports Rehabilitation" },
    { id: "course3", name: "Pediatric Physiotherapy" },
  ];

  const types = [
    { id: "all", name: t("content.allTypes") },
    { id: "video", name: t("content.typeVideo") },
    { id: "pdf", name: t("content.typePDF") },
    { id: "document", name: t("content.typeDocument") },
    { id: "image", name: t("content.typeImage") },
  ];

  const statuses = [
    { id: "all", name: t("content.allStatuses") },
    { id: "live", name: t("content.statusLive") },
    { id: "processing", name: t("content.statusProcessing") },
    { id: "failed", name: t("content.statusFailed") },
  ];

  const files: ContentFile[] = [
    {
      id: "1",
      name: "Module 1 - Introduction to Lower Back Pain.mp4",
      type: "video",
      size: "245 MB",
      course: "Lower Back Pain Management",
      uploadedAt: "Feb 5, 2024",
      status: "live",
      wcagCompliant: true,
      version: "v2.1",
      downloads: 156,
    },
    {
      id: "2",
      name: "Assessment Guidelines.pdf",
      type: "pdf",
      size: "2.4 MB",
      course: "Lower Back Pain Management",
      uploadedAt: "Feb 3, 2024",
      status: "live",
      wcagCompliant: true,
      version: "v1.3",
      downloads: 89,
    },
    {
      id: "3",
      name: "Module 5 - Advanced Techniques.mp4",
      type: "video",
      size: "312 MB",
      course: "Lower Back Pain Management",
      uploadedAt: "Feb 1, 2024",
      status: "processing",
      wcagCompliant: "pending",
      version: "v1.0",
      downloads: 0,
    },
    {
      id: "4",
      name: "Case Study Examples.docx",
      type: "document",
      size: "1.8 MB",
      course: "Sports Rehabilitation",
      uploadedAt: "Jan 28, 2024",
      status: "live",
      wcagCompliant: "warning",
      version: "v2.0",
      downloads: 67,
    },
    {
      id: "5",
      name: "Anatomy Reference Chart.png",
      type: "image",
      size: "4.2 MB",
      course: "Pediatric Physiotherapy",
      uploadedAt: "Jan 25, 2024",
      status: "live",
      wcagCompliant: false,
      version: "v1.0",
      downloads: 234,
    },
    {
      id: "6",
      name: "Sports Rehab Protocol.pdf",
      type: "pdf",
      size: "5.6 MB",
      course: "Sports Rehabilitation",
      uploadedAt: "Jan 22, 2024",
      status: "failed",
      wcagCompliant: false,
      version: "v1.0",
      downloads: 0,
    },
  ];

  const getFileIcon = (type: string) => {
    switch (type) {
      case "video":
        return <FileVideo className="w-5 h-5" />;
      case "pdf":
        return <FileText className="w-5 h-5" />;
      case "document":
        return <File className="w-5 h-5" />;
      case "image":
        return <Image className="w-5 h-5" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  const getFileIconBg = (type: string) => {
    switch (type) {
      case "video":
        return "bg-[#FEE2E2] text-[#EF4444]";
      case "pdf":
        return "bg-[#FFEDD5] text-[#F97316]";
      case "document":
        return "bg-[#DBEAFE] text-[#3B82F6]";
      case "image":
        return "bg-[#D1FAE5] text-[#10B981]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "live":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "processing":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "failed":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "live":
        return <Check className="w-3 h-3" />;
      case "processing":
        return <Clock className="w-3 h-3" />;
      case "failed":
        return <X className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getWcagStyle = (wcag: boolean | "warning" | "pending") => {
    if (wcag === true) return "bg-[#DCFCE7] text-[#22C55E]";
    if (wcag === "warning") return "bg-[#FEF9C3] text-[#EAB308]";
    if (wcag === "pending") return "bg-[#F3F4F6] text-[#6B7280]";
    return "bg-[#FEE2E2] text-[#EF4444]";
  };

  const getWcagIcon = (wcag: boolean | "warning" | "pending") => {
    if (wcag === true) return <Check className="w-3 h-3" />;
    if (wcag === "warning") return <AlertTriangle className="w-3 h-3" />;
    if (wcag === "pending") return <Clock className="w-3 h-3" />;
    return <X className="w-3 h-3" />;
  };

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCourse =
      selectedCourse === "all" ||
      file.course.toLowerCase().includes(
        courses.find((c) => c.id === selectedCourse)?.name.toLowerCase() || ""
      );
    const matchesType = selectedType === "all" || file.type === selectedType;
    const matchesStatus =
      selectedStatus === "all" || file.status === selectedStatus;

    return matchesSearch && matchesCourse && matchesType && matchesStatus;
  });

  // Stats
  const totalFiles = files.length;
  const totalStorage = "1.2 GB";
  const liveFiles = files.filter((f) => f.status === "live").length;
  const wcagCompliant = files.filter((f) => f.wcagCompliant === true).length;

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                    {t("content.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">{t("content.subtitle")}</p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  {t("content.uploadNew")}
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{totalFiles}</p>
                      <p className="text-xs text-[#6B7280]">{t("content.totalFiles")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E0E7FF] flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-[#6366F1]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{totalStorage}</p>
                      <p className="text-xs text-[#6B7280]">{t("content.storageUsed")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                      <Check className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{liveFiles}</p>
                      <p className="text-xs text-[#6B7280]">{t("content.liveContent")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FCE7F3] flex items-center justify-center">
                      <FileCheck className="w-5 h-5 text-[#EC4899]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{wcagCompliant}</p>
                      <p className="text-xs text-[#6B7280]">{t("content.wcagCompliant")}</p>
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
                      placeholder={t("content.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] hover:bg-[#F9FAFB]"
                    >
                      <Filter className="w-4 h-4" />
                      {t("content.filters")}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* View Mode Toggle */}
                    <div className="flex border border-[#E5E7EB] rounded-lg overflow-hidden">
                      <button
                        onClick={() => setViewMode("list")}
                        className={`p-2.5 ${
                          viewMode === "list"
                            ? "bg-[#3B82F6] text-white"
                            : "bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2.5 ${
                          viewMode === "grid"
                            ? "bg-[#3B82F6] text-white"
                            : "bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Filters */}
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
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mobile Filters */}
                {showFilters && (
                  <div className="md:hidden mt-4 pt-4 border-t border-[#E5E7EB] grid grid-cols-3 gap-3">
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
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {statuses.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Content List View */}
              {viewMode === "list" && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                            {t("content.tableFile")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                            {t("content.tableCourse")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                            {t("content.tableSize")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                            {t("content.tableStatus")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                            {t("content.tableWCAG")}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                            {t("content.tableActions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {filteredFiles.map((file) => (
                          <tr
                            key={file.id}
                            className="hover:bg-[#F9FAFB] transition-colors"
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${getFileIconBg(file.type)}`}
                                >
                                  {getFileIcon(file.type)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#1F2937] max-w-[250px] truncate">
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-[#6B7280]">
                                    {file.version} • {file.uploadedAt}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-[#374151] max-w-[150px] truncate block">
                                {file.course}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-[#6B7280]">{file.size}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(file.status)}`}
                              >
                                {getStatusIcon(file.status)}
                                {t(`content.status${file.status.charAt(0).toUpperCase() + file.status.slice(1)}`)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getWcagStyle(file.wcagCompliant)}`}
                                title={t("content.wcagCompliance")}
                              >
                                {getWcagIcon(file.wcagCompliant)}
                                {file.wcagCompliant === true
                                  ? t("content.wcagPass")
                                  : file.wcagCompliant === "warning"
                                    ? t("content.wcagWarning")
                                    : file.wcagCompliant === "pending"
                                      ? t("content.wcagPending")
                                      : t("content.wcagFail")}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1">
                                <button
                                  className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                  title={t("content.preview")}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                  title={t("content.download")}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                  title={t("content.edit")}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
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
                      {t("content.showing")} {filteredFiles.length} {t("content.of")}{" "}
                      {files.length} {t("content.files")}
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
              )}

              {/* Content Grid View */}
              {viewMode === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* File Preview */}
                      <div
                        className={`h-32 flex items-center justify-center ${
                          file.type === "video"
                            ? "bg-[#FEE2E2]"
                            : file.type === "pdf"
                              ? "bg-[#FFEDD5]"
                              : file.type === "image"
                                ? "bg-[#D1FAE5]"
                                : "bg-[#DBEAFE]"
                        }`}
                      >
                        {file.type === "video" ? (
                          <Video className="w-12 h-12 text-[#EF4444] opacity-50" />
                        ) : file.type === "pdf" ? (
                          <FileText className="w-12 h-12 text-[#F97316] opacity-50" />
                        ) : file.type === "image" ? (
                          <Image className="w-12 h-12 text-[#10B981] opacity-50" />
                        ) : (
                          <File className="w-12 h-12 text-[#3B82F6] opacity-50" />
                        )}
                      </div>

                      <div className="p-4">
                        <p className="text-sm font-medium text-[#1F2937] truncate mb-1">
                          {file.name}
                        </p>
                        <p className="text-xs text-[#6B7280] mb-3">{file.course}</p>

                        <div className="flex items-center justify-between mb-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(file.status)}`}
                          >
                            {getStatusIcon(file.status)}
                            {t(`content.status${file.status.charAt(0).toUpperCase() + file.status.slice(1)}`)}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getWcagStyle(file.wcagCompliant)}`}
                          >
                            {getWcagIcon(file.wcagCompliant)}
                            WCAG
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-[#9CA3AF]">
                          <span>{file.size}</span>
                          <span>{file.version}</span>
                        </div>

                        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[#E5E7EB]">
                          <button className="flex-1 p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors flex items-center justify-center">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="flex-1 p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors flex items-center justify-center">
                            <Download className="w-4 h-4" />
                          </button>
                          <button className="flex-1 p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors flex items-center justify-center">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button className="flex-1 p-2 text-[#6B7280] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors flex items-center justify-center">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Modal */}
              {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-[#1F2937]">
                          {t("content.uploadTitle")}
                        </h3>
                        <button
                          onClick={() => setShowUploadModal(false)}
                          className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Upload Area */}
                      <div className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-8 text-center hover:border-[#3B82F6] transition-colors cursor-pointer">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                          <Upload className="w-6 h-6 text-[#3B82F6]" />
                        </div>
                        <p className="text-sm text-[#374151] mb-1">
                          {t("content.dragDrop")}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {t("content.orBrowse")}
                        </p>
                        <p className="text-xs text-[#9CA3AF] mt-2">
                          {t("content.supportedFormats")}
                        </p>
                      </div>

                      {/* Course Selection */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-[#374151] mb-2">
                          {t("content.selectCourse")}
                        </label>
                        <select className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]">
                          {courses
                            .filter((c) => c.id !== "all")
                            .map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* WCAG Notice */}
                      <div className="mt-4 flex items-start gap-3 p-3 bg-[#EFF6FF] rounded-lg">
                        <FileCheck className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-[#1D4ED8]">
                            {t("content.wcagNotice")}
                          </p>
                          <p className="text-xs text-[#3B82F6] mt-1">
                            {t("content.wcagNoticeDesc")}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 mt-6">
                        <button
                          onClick={() => setShowUploadModal(false)}
                          className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                        >
                          {t("content.cancel")}
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors">
                          <Upload className="w-4 h-4" />
                          {t("content.upload")}
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

export default ContentManagementContent;
