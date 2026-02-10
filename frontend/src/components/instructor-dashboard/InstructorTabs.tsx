"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  MoreVertical,
  FileVideo,
  FileText,
  FileImage,
  File,
  Check,
  FolderOpen,
  BarChart3,
  ClipboardList,
  Clock,
  Upload,
  Edit,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  Download,
  ChevronDown,
  Users,
  BookOpen,
  FileBarChart,
  Loader2,
} from "lucide-react";

interface ContentFile {
  id: string;
  type: "video" | "pdf" | "document" | "image";
  name: string;
  version: string;
  status: "live" | "processing" | "draft";
  wcagCompliant: boolean | "warning";
  size?: string;
  lastModified?: string;
}

interface AssessmentItem {
  id: string;
  title: string;
  questions: number;
  submissions: number;
  avgScore: number;
}

interface ReportItem {
  id: string;
  title: string;
  description: string;
  lastGenerated: string;
}

interface InstructorTabsProps {
  contentFiles: ContentFile[];
  assessments: AssessmentItem[];
  reports: ReportItem[];
}

const InstructorTabs = ({
  contentFiles,
  assessments,
  reports,
}: InstructorTabsProps) => {
  const [activeTab, setActiveTab] = useState<
    "content" | "reports" | "assessments"
  >("content");
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<ContentFile[]>([]);
  const [openExportDropdown, setOpenExportDropdown] = useState<string | null>(null);
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [dateRanges, setDateRanges] = useState<Record<string, string>>({
    attendance: "last7days",
    gradebook: "last7days",
    assessment: "last7days",
  });
  const actionMenuRef = useRef<HTMLTableSectionElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("instructorDashboard");

  // Helper to determine file type from extension
  const getFileTypeFromName = (fileName: string): ContentFile["type"] => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
    if (["pdf"].includes(ext)) return "pdf";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
    return "document";
  };

  // Helper to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Process uploaded files
  const processFiles = (files: FileList) => {
    const newFiles: ContentFile[] = Array.from(files).map((file, index) => ({
      id: `uploaded-${Date.now()}-${index}`,
      type: getFileTypeFromName(file.name),
      name: file.name,
      version: "v1.0",
      status: "processing" as const,
      wcagCompliant: "warning" as const,
      size: formatFileSize(file.size),
    }));

    setUploadedFiles((prev) => [...newFiles, ...prev]);

    // Simulate processing completion after 2 seconds
    setTimeout(() => {
      setUploadedFiles((prev) =>
        prev.map((f) =>
          newFiles.some((nf) => nf.id === f.id)
            ? { ...f, status: "live" as const, wcagCompliant: true as const }
            : f
        )
      );
    }, 2000);
  };

  // Combined files list (uploaded first, then mock data)
  const allFiles = [...uploadedFiles, ...contentFiles];

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setOpenExportDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tabs = [
    { id: "content" as const, label: t("tabs.contentManagement"), icon: FolderOpen },
    { id: "reports" as const, label: t("tabs.reports"), icon: BarChart3 },
    { id: "assessments" as const, label: t("tabs.assessments"), icon: ClipboardList },
  ];

  // Get file type icon
  const getFileIcon = (type: string) => {
    switch (type) {
      case "video":
        return <FileVideo className="w-4 h-4" />;
      case "pdf":
        return <FileText className="w-4 h-4" />;
      case "image":
        return <FileImage className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  // Get file type style
  const getFileTypeStyle = (type: string) => {
    switch (type) {
      case "video":
        return "bg-[#FEE2E2] text-[#EF4444]";
      case "pdf":
        return "bg-[#FFEDD5] text-[#F97316]";
      case "image":
        return "bg-[#E0E7FF] text-[#6366F1]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  // Get status style
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "live":
        return { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", icon: Check };
      case "processing":
        return { bg: "bg-[#FEF9C3]", text: "text-[#EAB308]", icon: Clock };
      case "draft":
        return { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", icon: File };
      default:
        return { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", icon: File };
    }
  };

  // Get WCAG compliance style
  const getWcagStyle = (wcagCompliant: boolean | "warning") => {
    if (wcagCompliant === true) {
      return { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", icon: CheckCircle, label: t("content.wcagCompliant") };
    } else if (wcagCompliant === "warning") {
      return { bg: "bg-[#FEF9C3]", text: "text-[#EAB308]", icon: AlertTriangle, label: t("content.wcagWarning") };
    } else {
      return { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", icon: XCircle, label: t("content.wcagFailed") };
    }
  };

  // File action handlers
  const handleEdit = (fileId: string) => {
    console.log("Editing file:", fileId);
    setOpenActionMenu(null);
  };

  const handleReplace = (fileId: string) => {
    console.log("Replacing file:", fileId);
    setOpenActionMenu(null);
  };

  const handleDelete = (fileId: string) => {
    // Remove from uploaded files if it exists there
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    setOpenActionMenu(null);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      {/* Tab Headers */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex border-b border-[#E5E7EB] min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium relative transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-[#3B82F6]"
                  : "text-[#6B7280] hover:text-[#374151]"
              }`}
            >
              <span className="flex items-center gap-1 sm:gap-1.5">
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 sm:p-5">
        {/* Content Management Tab */}
        {activeTab === "content" && (
          <div className="space-y-4">
            {/* Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                isDragOver
                  ? "border-[#3B82F6] bg-[#EFF6FF]"
                  : "border-[#E5E7EB] hover:border-[#3B82F6] hover:bg-[#F9FAFB]"
              }`}
            >
              <input
                type="file"
                id="file-upload"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.mp4,.mov,.doc,.docx,.png,.jpg,.jpeg"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isDragOver ? "bg-[#3B82F6] text-white" : "bg-[#EFF6FF] text-[#3B82F6]"
                  }`}>
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1F2937]">
                      {t("content.dragDrop")}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      {t("content.supportedFormats")}
                    </p>
                  </div>
                  <span
                    className="mt-2 px-4 py-2 text-sm font-medium text-[#3B82F6] border border-[#3B82F6] rounded-lg hover:bg-[#EFF6FF] transition-colors inline-block"
                  >
                    {t("content.browseFiles")}
                  </span>
                </div>
              </label>
            </div>

            {/* File Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                      {t("content.fileName")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                      {t("content.type")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                      {t("content.version")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                      {t("content.status")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                      {t("content.wcag")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[#6B7280]">
                      {t("content.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody ref={actionMenuRef}>
                  {allFiles.map((file) => {
                    const statusStyle = getStatusStyle(file.status);
                    const wcagStyle = getWcagStyle(file.wcagCompliant);
                    const StatusIcon = statusStyle.icon;
                    const WcagIcon = wcagStyle.icon;

                    return (
                      <tr
                        key={file.id}
                        className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]"
                      >
                        {/* File Name */}
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${getFileTypeStyle(file.type)}`}>
                              {getFileIcon(file.type)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#1F2937]">{file.name}</p>
                              {file.size && (
                                <p className="text-xs text-[#9CA3AF]">{file.size}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Type */}
                        <td className="py-3.5">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium capitalize ${getFileTypeStyle(file.type)}`}>
                            {file.type}
                          </span>
                        </td>
                        {/* Version */}
                        <td className="py-3.5 text-sm text-[#374151]">
                          {file.version}
                        </td>
                        {/* Status */}
                        <td className="py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {t(`content.status${file.status.charAt(0).toUpperCase() + file.status.slice(1)}`)}
                          </span>
                        </td>
                        {/* WCAG Compliance */}
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${wcagStyle.bg} ${wcagStyle.text}`}
                              title={wcagStyle.label}
                            >
                              <WcagIcon className="w-4 h-4" />
                            </span>
                          </div>
                        </td>
                        {/* Actions Dropdown */}
                        <td className="py-3.5">
                          <div className="relative">
                            <button
                              onClick={() => setOpenActionMenu(openActionMenu === file.id ? null : file.id)}
                              className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Action Menu Dropdown */}
                            {openActionMenu === file.id && (
                              <div className="absolute end-0 top-full mt-1 w-36 bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-10">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleEdit(file.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                                  >
                                    <Edit className="w-4 h-4 text-[#6B7280]" />
                                    {t("content.edit")}
                                  </button>
                                  <button
                                    onClick={() => handleReplace(file.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                                  >
                                    <RefreshCw className="w-4 h-4 text-[#6B7280]" />
                                    {t("content.replace")}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(file.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {t("content.delete")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div className="space-y-4">
            {/* Report Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" ref={exportDropdownRef}>
              {/* Attendance Report Card */}
              <div className="p-5 border border-[#E5E7EB] rounded-xl bg-white hover:shadow-md transition-shadow flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4 min-h-[60px]">
                  <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1F2937]">
                      {t("reportsTab.attendanceReport")}
                    </h4>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {t("reportsTab.attendanceDesc")}
                    </p>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mb-4 flex-1">
                  <label className="text-xs font-medium text-[#4B5563] mb-1.5 block">
                    {t("reportsTab.dateRange")}
                  </label>
                  <div className="relative">
                    <select
                      value={dateRanges.attendance}
                      onChange={(e) => setDateRanges((prev) => ({ ...prev, attendance: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#374151] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    >
                      <option value="last7days">{t("reportsTab.last7Days")}</option>
                      <option value="last30days">{t("reportsTab.last30Days")}</option>
                      <option value="last90days">{t("reportsTab.last90Days")}</option>
                      <option value="thisMonth">{t("reportsTab.thisMonth")}</option>
                      <option value="lastMonth">{t("reportsTab.lastMonth")}</option>
                    </select>
                    <Calendar className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-2">
                  {/* Generate Button */}
                  <button
                    onClick={() => {
                      setGeneratingReports((prev) => new Set(prev).add("attendance"));
                      setTimeout(() => {
                        setGeneratingReports((prev) => {
                          const next = new Set(prev);
                          next.delete("attendance");
                          return next;
                        });
                      }, 2000);
                    }}
                    disabled={generatingReports.has("attendance")}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#3B82F6] rounded-lg hover:bg-[#2563EB] disabled:bg-[#93C5FD] disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingReports.has("attendance") ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("reportsTab.generating")}
                      </>
                    ) : (
                      t("reportsTab.generate")
                    )}
                  </button>

                  {/* Export Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenExportDropdown(openExportDropdown === "attendance" ? null : "attendance")}
                      className="inline-flex items-center gap-1 px-3 py-2.5 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {openExportDropdown === "attendance" && (
                      <div className="absolute end-0 top-full mt-1 w-32 bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              console.log("Export attendance as CSV");
                              setOpenExportDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                          >
                            <FileBarChart className="w-4 h-4 text-[#22C55E]" />
                            {t("reportsTab.exportCSV")}
                          </button>
                          <button
                            onClick={() => {
                              console.log("Export attendance as PDF");
                              setOpenExportDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                          >
                            <FileText className="w-4 h-4 text-[#EF4444]" />
                            {t("reportsTab.exportPDF")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Gradebook Report Card */}
              <div className="p-5 border border-[#E5E7EB] rounded-xl bg-white hover:shadow-md transition-shadow flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4 min-h-[60px]">
                  <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-[#D97706]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1F2937]">
                      {t("reportsTab.gradebook")}
                    </h4>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {t("reportsTab.gradebookDesc")}
                    </p>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mb-4 flex-1">
                  <label className="text-xs font-medium text-[#4B5563] mb-1.5 block">
                    {t("reportsTab.dateRange")}
                  </label>
                  <div className="relative">
                    <select
                      value={dateRanges.gradebook}
                      onChange={(e) => setDateRanges((prev) => ({ ...prev, gradebook: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#374151] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    >
                      <option value="last7days">{t("reportsTab.last7Days")}</option>
                      <option value="last30days">{t("reportsTab.last30Days")}</option>
                      <option value="last90days">{t("reportsTab.last90Days")}</option>
                      <option value="thisMonth">{t("reportsTab.thisMonth")}</option>
                      <option value="lastMonth">{t("reportsTab.lastMonth")}</option>
                    </select>
                    <Calendar className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-2">
                  {/* Generate Button */}
                  <button
                    onClick={() => {
                      setGeneratingReports((prev) => new Set(prev).add("gradebook"));
                      setTimeout(() => {
                        setGeneratingReports((prev) => {
                          const next = new Set(prev);
                          next.delete("gradebook");
                          return next;
                        });
                      }, 2000);
                    }}
                    disabled={generatingReports.has("gradebook")}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#3B82F6] rounded-lg hover:bg-[#2563EB] disabled:bg-[#93C5FD] disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingReports.has("gradebook") ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("reportsTab.generating")}
                      </>
                    ) : (
                      t("reportsTab.generate")
                    )}
                  </button>

                  {/* Export Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenExportDropdown(openExportDropdown === "gradebook" ? null : "gradebook")}
                      className="inline-flex items-center gap-1 px-3 py-2.5 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {openExportDropdown === "gradebook" && (
                      <div className="absolute end-0 top-full mt-1 w-32 bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              console.log("Export gradebook as CSV");
                              setOpenExportDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                          >
                            <FileBarChart className="w-4 h-4 text-[#22C55E]" />
                            {t("reportsTab.exportCSV")}
                          </button>
                          <button
                            onClick={() => {
                              console.log("Export gradebook as PDF");
                              setOpenExportDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                          >
                            <FileText className="w-4 h-4 text-[#EF4444]" />
                            {t("reportsTab.exportPDF")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Assessment Results Report Card */}
              <div className="p-5 border border-[#E5E7EB] rounded-xl bg-white hover:shadow-md transition-shadow flex flex-col h-full">
                {/* Header */}
                <div className="flex items-start gap-3 mb-4 min-h-[60px]">
                  <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-[#22C55E]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1F2937]">
                      {t("reportsTab.assessmentResults")}
                    </h4>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {t("reportsTab.assessmentDesc")}
                    </p>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="mb-4 flex-1">
                  <label className="text-xs font-medium text-[#4B5563] mb-1.5 block">
                    {t("reportsTab.dateRange")}
                  </label>
                  <div className="relative">
                    <select
                      value={dateRanges.assessment}
                      onChange={(e) => setDateRanges((prev) => ({ ...prev, assessment: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#374151] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    >
                      <option value="last7days">{t("reportsTab.last7Days")}</option>
                      <option value="last30days">{t("reportsTab.last30Days")}</option>
                      <option value="last90days">{t("reportsTab.last90Days")}</option>
                      <option value="thisMonth">{t("reportsTab.thisMonth")}</option>
                      <option value="lastMonth">{t("reportsTab.lastMonth")}</option>
                    </select>
                    <Calendar className="absolute end-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex items-center gap-2">
                  {/* Generate Button */}
                  <button
                    onClick={() => {
                      setGeneratingReports((prev) => new Set(prev).add("assessment"));
                      setTimeout(() => {
                        setGeneratingReports((prev) => {
                          const next = new Set(prev);
                          next.delete("assessment");
                          return next;
                        });
                      }, 2000);
                    }}
                    disabled={generatingReports.has("assessment")}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#3B82F6] rounded-lg hover:bg-[#2563EB] disabled:bg-[#93C5FD] disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingReports.has("assessment") ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("reportsTab.generating")}
                      </>
                    ) : (
                      t("reportsTab.generate")
                    )}
                  </button>

                  {/* Export Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenExportDropdown(openExportDropdown === "assessment" ? null : "assessment")}
                      className="inline-flex items-center gap-1 px-3 py-2.5 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {openExportDropdown === "assessment" && (
                      <div className="absolute end-0 top-full mt-1 w-32 bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={() => {
                              console.log("Export assessment as CSV");
                              setOpenExportDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                          >
                            <FileBarChart className="w-4 h-4 text-[#22C55E]" />
                            {t("reportsTab.exportCSV")}
                          </button>
                          <button
                            onClick={() => {
                              console.log("Export assessment as PDF");
                              setOpenExportDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                          >
                            <FileText className="w-4 h-4 text-[#EF4444]" />
                            {t("reportsTab.exportPDF")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assessments Tab */}
        {activeTab === "assessments" && (
          <div className="space-y-3">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
              >
                <div>
                  <h4 className="text-sm font-semibold text-[#1F2937]">
                    {assessment.title}
                  </h4>
                  <p className="text-xs text-[#6B7280]">
                    {assessment.questions} {t("assessments.questions")} •{" "}
                    {assessment.submissions} {t("assessments.submissions")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[#1F2937]">
                    {assessment.avgScore}%
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {t("assessments.avgScore")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorTabs;
