"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { materialsApi, reportsApi, type ReportType, type ReportFormat } from "@/lib/api";

interface ContentFile {
  id: string;
  type: "video" | "pdf" | "document" | "image";
  name: string;
  version: string;
  status: "live" | "processing" | "draft" | "pending_review";
  wcagCompliant: boolean | "warning";
  size?: string;
  lastModified?: string;
}

interface ReportItem {
  id: string;
  title: string;
  description: string;
  lastGenerated: string;
}

interface InstructorTabsProps {
  contentFiles: ContentFile[];
  reports: ReportItem[];
  courseId?: string;
  onMaterialChange?: () => void;
}

const InstructorTabs = ({
  contentFiles,
  reports,
  courseId,
  onMaterialChange,
}: InstructorTabsProps) => {
  const PAGE_SIZE = 10;
  const [activeTab, setActiveTab] = useState<
    "content" | "reports"
  >("content");
  const [contentPage, setContentPage] = useState(0);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [openExportDropdown, setOpenExportDropdown] = useState<string | null>(null);
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const [dateRanges, setDateRanges] = useState<Record<string, string>>({
    attendance: "last7days",
    gradebook: "last7days",
    assessment: "last7days",
  });
  const actionMenuRef = useRef<HTMLTableSectionElement>(null);
  const t = useTranslations("instructorDashboard");
  const tA = useTranslations("accessibility");

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

  // Upload files via backend API
  const processFiles = async (files: FileList) => {
    if (!courseId) {
      toast.error(t("content.noCourseError"));
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const mime = file.type;
        const type = mime.startsWith("video/") ? "video" :
          mime === "application/pdf" ? "pdf" :
          mime.startsWith("image/") ? "image" : "document";
        await materialsApi.upload(courseId, file, file.name, type);
      }
      onMaterialChange?.();
    } catch {
      toast.error(t("content.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  // All files come from backend (no local uploadedFiles state)
  const allFiles = contentFiles;
  const totalFiles = allFiles.length;
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  const paginatedFiles = allFiles.slice(contentPage * PAGE_SIZE, (contentPage + 1) * PAGE_SIZE);

  // Reset page when content files change
  useEffect(() => {
    setContentPage(0);
  }, [contentFiles]);

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

  // Convert date range selection to dateFrom/dateTo strings
  const getDateRange = (rangeKey: string): { dateFrom: string; dateTo: string } => {
    const now = new Date();
    const to = now.toISOString().split("T")[0];
    let from: Date;
    switch (rangeKey) {
      case "last7days":
        from = new Date(now); from.setDate(from.getDate() - 7); break;
      case "last30days":
        from = new Date(now); from.setDate(from.getDate() - 30); break;
      case "last90days":
        from = new Date(now); from.setDate(from.getDate() - 90); break;
      case "thisMonth":
        from = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "lastMonth":
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return { dateFrom: from.toISOString().split("T")[0], dateTo: endOfLastMonth.toISOString().split("T")[0] };
      default:
        from = new Date(now); from.setDate(from.getDate() - 7); break;
    }
    return { dateFrom: from.toISOString().split("T")[0], dateTo: to };
  };

  // Map tab report keys to backend ReportType
  const reportTypeMap: Record<string, ReportType | null> = {
    attendance: "attendance",
    gradebook: "gradebook",
    assessment: null, // Not supported on backend yet
  };

  // Download a report via the real API
  const handleReportDownload = async (reportKey: string, format: ReportFormat) => {
    const apiType = reportTypeMap[reportKey];
    if (!apiType) {
      toast.info(t("reportsTab.assessmentNotAvailable"));
      return;
    }
    setGeneratingReports((prev) => new Set(prev).add(reportKey));
    try {
      const { dateFrom, dateTo } = getDateRange(dateRanges[reportKey]);
      await reportsApi.download(apiType, {
        courseId: courseId || undefined,
        format,
        dateFrom,
        dateTo,
      });
      toast.success(t("reportsTab.downloadSuccess"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("reportsTab.downloadError");
      toast.error(message);
    } finally {
      setGeneratingReports((prev) => {
        const next = new Set(prev);
        next.delete(reportKey);
        return next;
      });
    }
  };

  const tabs = [
    { id: "content" as const, label: t("tabs.contentManagement"), icon: FolderOpen },
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
        return "bg-[var(--color-border-subtle)] text-[#6366F1]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  // Get status style
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "live":
        return { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", icon: Check };
      case "processing":
        return { bg: "bg-[#FEF9C3]", text: "text-[#EAB308]", icon: Clock };
      case "pending_review":
        return { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", icon: Clock };
      case "draft":
        return { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", icon: File };
      default:
        return { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", icon: File };
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

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingFileId, setReplacingFileId] = useState<string | null>(null);

  // File action handlers
  const handleEdit = (fileId: string) => {
    console.log("Editing file:", fileId);
    setOpenActionMenu(null);
  };

  const handleReplace = (fileId: string) => {
    setReplacingFileId(fileId);
    setOpenActionMenu(null);
    replaceInputRef.current?.click();
  };

  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replacingFileId) return;
    try {
      await materialsApi.replace(replacingFileId, file);
      onMaterialChange?.();
    } catch {
      toast.error(t("content.replaceError"));
    }
    setReplacingFileId(null);
    e.target.value = "";
  };

  const handleDelete = async (fileId: string) => {
    setOpenActionMenu(null);
    try {
      await materialsApi.delete(fileId);
      onMaterialChange?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/currently being processed/i.test(msg)) {
        toast.error(t("content.deleteErrorProcessing"));
      } else if (/material not found/i.test(msg)) {
        toast.error(t("content.deleteErrorNotFound"));
      } else if (/foreign key|violates foreign|still referenced/i.test(msg)) {
        toast.error(t("content.deleteErrorInUse"));
      } else if (msg) {
        toast.error(msg);
      } else {
        toast.error(t("content.deleteError"));
      }
    }
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFiles(files);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFiles(files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      {/* Tab Headers */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex border-b border-[var(--color-border)] min-w-max" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium relative transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <span className="flex items-center gap-1 sm:gap-1.5">
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t" />
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
                  ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)]"
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
                    isDragOver ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                  }`}>
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                      {t("content.dragDrop")}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("content.supportedFormats")}
                    </p>
                  </div>
                  <span
                    className="mt-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors inline-block"
                  >
                    {t("content.browseFiles")}
                  </span>
                </div>
              </label>
            </div>

            {/* Hidden input for file replacement */}
            <input
              ref={replaceInputRef}
              type="file"
              className="hidden"
              onChange={handleReplaceFileSelected}
              accept=".pdf,.mp4,.mov,.doc,.docx,.png,.jpg,.jpeg"
            />

            {/* Uploading indicator */}
            {uploading && (
              <div className="flex items-center gap-2 p-3 bg-[var(--color-border-subtle)] rounded-lg text-sm text-[var(--color-primary)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("content.uploading")}
              </div>
            )}

            {/* File Table */}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[35%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead>
                  <tr className="text-start">
                    <th className="pb-3 text-[13px] font-medium text-[var(--color-text-secondary)]">
                      {t("content.fileName")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[var(--color-text-secondary)]">
                      {t("content.type")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[var(--color-text-secondary)]">
                      {t("content.version")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[var(--color-text-secondary)]">
                      {t("content.status")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[var(--color-text-secondary)]">
                      {t("content.wcag")}
                    </th>
                    <th className="pb-3 text-[13px] font-medium text-[var(--color-text-secondary)]">
                      {t("content.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody ref={actionMenuRef}>
                  {paginatedFiles.map((file) => {
                    const statusStyle = getStatusStyle(file.status);
                    const wcagStyle = getWcagStyle(file.wcagCompliant);
                    const StatusIcon = statusStyle.icon;
                    const WcagIcon = wcagStyle.icon;

                    return (
                      <tr
                        key={file.id}
                        className="border-t border-[#F3F4F6] hover:bg-[var(--color-border-subtle)]"
                      >
                        {/* File Name */}
                        <td className="py-3.5 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getFileTypeStyle(file.type)}`}>
                              {getFileIcon(file.type)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{file.name}</p>
                              {file.size && (
                                <p className="text-xs text-[var(--color-text-secondary)]">{file.size}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Type */}
                        <td className="py-3.5 overflow-hidden">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium capitalize ${getFileTypeStyle(file.type)}`}>
                            {file.type}
                          </span>
                        </td>
                        {/* Version */}
                        <td className="py-3.5 text-sm text-[var(--color-text-secondary)] overflow-hidden">
                          {file.version}
                        </td>
                        {/* Status */}
                        <td className="py-3.5 overflow-hidden">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${statusStyle.bg} ${statusStyle.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {file.status === "pending_review" ? t("content.statusPendingReview") : t(`content.status${file.status.charAt(0).toUpperCase() + file.status.slice(1)}`)}
                          </span>
                        </td>
                        {/* WCAG Compliance */}
                        <td className="py-3.5 overflow-hidden">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center ${wcagStyle.bg} ${wcagStyle.text}`}
                            title={wcagStyle.label}
                          >
                            <WcagIcon className="w-4 h-4" />
                          </span>
                        </td>
                        {/* Actions Dropdown */}
                        <td className="py-3.5">
                          <div className="relative">
                            <button
                              onClick={() => setOpenActionMenu(openActionMenu === file.id ? null : file.id)}
                              className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                              aria-label={tA("openActions")}
                              aria-haspopup="true"
                              aria-expanded={openActionMenu === file.id}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Action Menu Dropdown */}
                            {openActionMenu === file.id && (
                              <div className="absolute end-0 top-full mt-1 w-36 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] shadow-lg z-10" role="menu">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleEdit(file.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                    role="menuitem"
                                  >
                                    <Edit className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                    {t("content.edit")}
                                  </button>
                                  <button
                                    onClick={() => handleReplace(file.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                    role="menuitem"
                                  >
                                    <RefreshCw className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                    {t("content.replace")}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(file.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                                    role="menuitem"
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

            {/* Pagination Controls */}
            {totalFiles > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t("content.showing")} {contentPage * PAGE_SIZE + 1}-{Math.min((contentPage + 1) * PAGE_SIZE, totalFiles)} {t("content.of")} {totalFiles}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setContentPage((p) => Math.max(0, p - 1))}
                    disabled={contentPage === 0}
                    className="px-3 py-1.5 text-sm font-medium border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("content.previous")}
                  </button>
                  <button
                    onClick={() => setContentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={contentPage >= totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("content.next")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default InstructorTabs;
