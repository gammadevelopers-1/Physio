"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { toast } from "sonner";
import {
  FileText,
  Video,
  Image as ImageIcon,
  File,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import SkeletonTableRow from "@/components/shared/SkeletonTableRow";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useContentReview } from "@/hooks/useContentReview";


const TYPE_ICONS: Record<string, { icon: typeof Video; bg: string; color: string }> = {
  video: { icon: Video, bg: "bg-[var(--color-border-subtle)]", color: "text-[var(--color-primary)]" },
  pdf: { icon: FileText, bg: "bg-[#FEE2E2]", color: "text-[#EF4444]" },
  document: { icon: File, bg: "bg-[#FEF3C7]", color: "text-[#F59E0B]" },
  image: { icon: ImageIcon, bg: "bg-[#D1FAE5]", color: "text-[#10B981]" },
};

const CHECK_LABEL_KEYS: Record<string, string> = {
  learning_objectives: "learningObjectives",
  assessment_alignment: "assessmentAlignment",
  hours_compliance: "hoursCompliance",
  wcag_compliance: "wcagCompliance",
  nelc_checklist: "nelcChecklist",
};

// Maps for translating backend WCAG / compliance detail strings
const WCAG_LABEL_AR: Record<string, string> = {
  "Document Title": "عنوان المستند",
  "Document Language": "لغة المستند",
  "Tagged Structure": "البنية الموسومة",
  "Page Content": "محتوى الصفحة",
  "Author Metadata": "بيانات المؤلف",
  "Captions": "الترجمة",
  "Transcript": "النص المكتوب",
  "File Access": "الوصول للملف",
  "PDF Parsing": "تحليل PDF",
  "Heading Structure": "هيكل العناوين",
  "Image Alt Text": "النص البديل للصور",
  "Slide Structure": "هيكل الشرائح",
  "Alt Text": "النص البديل",
  "Image Validity": "صلاحية الصورة",
  "Unknown Type": "نوع غير معروف",
};

const WCAG_DETAIL_AR: [RegExp, string][] = [
  [/^No document title set in PDF metadata$/, "لم يتم تعيين عنوان المستند في بيانات PDF"],
  [/^No language attribute set in PDF metadata$/, "لم يتم تعيين سمة اللغة في بيانات PDF"],
  [/^PDF is not tagged \(no structural markup for headings, lists, tables\)$/, "PDF غير موسوم (لا توجد بنية للعناوين والقوائم والجداول)"],
  [/^PDF has (\d+) page\(s\)$/, "PDF يحتوي على $1 صفحة(صفحات)"],
  [/^No author metadata set$/, "لم يتم تعيين بيانات المؤلف"],
  [/^Title: "(.+)"$/, 'العنوان: "$1"'],
  [/^Language: (.+)$/, "اللغة: $1"],
  [/^Author: "(.+)"$/, 'المؤلف: "$1"'],
  [/^Missing captions.*$/, "الترجمة مفقودة (مطلوبة للمستخدمين الصم وضعاف السمع)"],
  [/^Captions present$/, "الترجمة موجودة"],
  [/^Missing transcript.*$/, "النص المكتوب مفقود (مطلوب كبديل للوصف الصوتي)"],
  [/^Transcript present$/, "النص المكتوب موجود"],
  [/^File not available for inspection$/, "الملف غير متاح للفحص"],
  [/^Material title is used as alt text.*$/, "يُستخدم عنوان المادة كنص بديل"],
  [/^No headings found.*$/, "لم يتم العثور على عناوين — قد يفتقر المستند إلى تسلسل هرمي"],
  [/^Found (\d+) heading\(s\) in document$/, "تم العثور على $1 عنوان(عناوين) في المستند"],
  [/^(\d+)\/(\d+) embedded images have alt text$/, "$1/$2 صورة مضمنة لها نص بديل"],
  [/^Presentation has (\d+) slide\(s\)$/, "العرض يحتوي على $1 شريحة(شرائح)"],
  [/^No slides found.*$/, "لم يتم العثور على شرائح في العرض"],
  [/^Could not parse PDF: (.+)$/, "تعذر تحليل PDF: $1"],
  [/^Could not parse document: (.+)$/, "تعذر تحليل المستند: $1"],
  [/^File size: (.+)$/, "حجم الملف: $1"],
  [/^File appears too small.*$/, "الملف صغير جداً ليكون صورة صالحة"],
  [/^Could not read image file$/, "تعذرت قراءة ملف الصورة"],
  // Compliance check details
  [/^Course has (\d+) modules \(minimum 3\)$/, "الدورة تحتوي على $1 وحدات (الحد الأدنى 3)"],
  [/^Course has only (\d+) module\(s\) — at least 3 required$/, "الدورة تحتوي على $1 وحدة(وحدات) فقط — مطلوب 3 على الأقل"],
  [/^No modules exist to assess$/, "لا توجد وحدات للتقييم"],
  [/^All (\d+) modules covered by assessments$/, "جميع الوحدات ($1) مغطاة بالتقييمات"],
  [/^(\d+) of (\d+) module\(s\) have no linked assessment$/, "$1 من $2 وحدة(وحدات) ليس لها تقييم مرتبط"],
  [/^([\d.]+) hours meets (\d+)h minimum for (\w+) course$/, "$1 ساعة تستوفي الحد الأدنى $2 ساعة لدورة $3"],
  [/^([\d.]+) hours is below (\d+)h minimum for (\w+) course$/, "$1 ساعة أقل من الحد الأدنى $2 ساعة لدورة $3"],
  [/^All (\d+) materials WCAG compliant, (\d+)\/(\d+) videos captioned$/, "جميع المواد ($1) متوافقة مع WCAG، $2/$3 فيديو مترجم"],
  [/^(\d+)\/(\d+) materials compliant, (\d+)\/(\d+) videos captioned$/, "$1/$2 مواد متوافقة، $3/$4 فيديو مترجم"],
  [/^All mandatory fields filled.*$/, "جميع الحقول الإلزامية مكتملة (العنوان، العنوان العربي، الوصف، التواريخ)"],
  [/^Missing: (.+)$/, "مفقود: $1"],
];

function translateDetail(detail: string, isArabic: boolean): string {
  if (!isArabic) return detail;
  for (const [pattern, replacement] of WCAG_DETAIL_AR) {
    if (pattern.test(detail)) return detail.replace(pattern, replacement);
  }
  return detail;
}

function translateLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  return WCAG_LABEL_AR[label] || label;
}

const ContentReviewContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const { calendarFormat } = useCalendarPreference();
  const isRTL = locale === "ar";
  const manager = useManagerProfile();
  const {
    items,
    stats,
    loading,
    error,
    refetch,
    approve,
    reject,
    requestChanges,
    bulkApprove,
    bulkReject,
    checklists,
    checklistLoading,
    fetchChecklist,
  } = useContentReview();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [courseFilter, setCourseFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [commentId, setCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentAction, setCommentAction] = useState<"reject" | "changes_requested">("changes_requested");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const courses = useMemo(() => Array.from(new Set(items.map(i => i.courseTitle))).sort(), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.courseTitle.toLowerCase().includes(q) ||
          `${item.instructorFirstName || ""} ${item.instructorLastName || ""}`.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      if (statusFilter === "rejected") {
        result = result.filter((item) => item.status === "rejected" || item.status === "failed");
      } else {
        result = result.filter((item) => item.status === statusFilter);
      }
    }
    if (typeFilter !== "all") {
      result = result.filter((item) => item.type === typeFilter);
    }
    if (courseFilter !== "all") {
      result = result.filter((item) => item.courseTitle === courseFilter);
    }
    return result;
  }, [items, search, statusFilter, typeFilter, courseFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, typeFilter, courseFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approve(id);
      toast.success(t("contentReviewPage.approved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClick = (id: string) => {
    setCommentId(id);
    setCommentAction("reject");
    setCommentText("");
  };

  const handleRequestChangesClick = (id: string) => {
    setCommentId(id);
    setCommentAction("changes_requested");
    setCommentText("");
  };

  const handleCommentSubmit = async () => {
    if (!commentId || !commentText.trim()) return;
    setActionLoading(commentId);
    try {
      if (commentAction === "reject") {
        await reject(commentId, commentText.trim());
        toast.success(t("contentReviewPage.rejected"));
      } else {
        await requestChanges(commentId, commentText.trim());
        toast.success(t("contentReviewPage.changesRequestedSuccess"));
      }
      setCommentId(null);
      setCommentText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    setBulkLoading(true);
    try {
      const result = await bulkApprove(ids);
      toast.success(t("contentReviewPage.bulkApproveSuccess", { count: result.succeeded }));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk approve failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    const ids = Array.from(selectedIds);
    setBulkLoading(true);
    try {
      const result = await bulkReject(ids, "Bulk rejected by course manager");
      toast.success(t("contentReviewPage.bulkRejectSuccess", { count: result.succeeded }));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk reject failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
      fetchChecklist(id);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateHijri(dateStr, calendarFormat, { locale });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <>
        <CourseManagerNavbar manager={manager} />
        <div className="bg-[var(--color-surface-page)] min-h-screen">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="hidden lg:block lg:flex-shrink-0">
                <CourseManagerSidebar manager={manager} />
              </div>
              <CourseManagerMobileSidebar manager={manager} />
              <div className="flex-1 min-w-0">
                <div className="mb-6">
                  <div className="h-7 bg-[var(--color-border)] rounded w-48 animate-pulse mb-2" />
                  <div className="h-4 bg-[var(--color-border)] rounded w-72 animate-pulse" />
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <SkeletonTableRow key={i} cols={5} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CourseManagerNavbar manager={manager} />
        <div className="bg-[var(--color-surface-page)] min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.retry")}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("contentReviewPage.title")}</h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("contentReviewPage.subtitle")}</p>
              </div>

              {/* Stats Cards — 4 cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#F59E0B]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.pending}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("contentReviewPage.stats.pending")}</p>
                  </div>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEF9C3] rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-[#D97706]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.changesRequested}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("contentReviewPage.stats.changesRequested")}</p>
                  </div>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.approved}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("contentReviewPage.stats.approved")}</p>
                  </div>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-[#EF4444]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.rejected}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("contentReviewPage.stats.rejected")}</p>
                  </div>
                </div>
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`} />
                  <input
                    type="text"
                    placeholder={t("contentReviewPage.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none`}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                >
                  <option value="all">{t("contentReviewPage.filters.allStatus")}</option>
                  <option value="pending_review">{t("contentReviewPage.filters.pending")}</option>
                  <option value="changes_requested">{t("contentReviewPage.filters.changesRequested")}</option>
                  <option value="live">{t("contentReviewPage.filters.approved")}</option>
                  <option value="rejected">{t("contentReviewPage.filters.rejected")}</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                >
                  <option value="all">{t("contentReviewPage.filters.allTypes")}</option>
                  <option value="video">{t("contentReviewPage.filters.video")}</option>
                  <option value="pdf">{t("contentReviewPage.filters.pdf")}</option>
                  <option value="document">{t("contentReviewPage.filters.document")}</option>
                </select>
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  className="px-4 py-2.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none"
                >
                  <option value="all">{t("contentReviewPage.filters.allCourses")}</option>
                  {courses.map((course) => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>

              {/* Comment Modal Overlay */}
              {commentId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-[var(--color-surface-card)] rounded-xl shadow-lg max-w-md w-full p-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                      {commentAction === "reject"
                        ? t("contentReviewPage.rejectTitle")
                        : t("contentReviewPage.requestChangesTitle")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      {commentAction === "reject"
                        ? t("contentReviewPage.rejectDesc")
                        : t("contentReviewPage.requestChangesDesc")}
                    </p>
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t("contentReviewPage.commentPlaceholder")}
                      rows={4}
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent outline-none resize-none"
                    />
                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        onClick={() => { setCommentId(null); setCommentText(""); }}
                        className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        {t("contentReviewPage.cancel")}
                      </button>
                      <button
                        onClick={handleCommentSubmit}
                        disabled={!commentText.trim() || actionLoading === commentId}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
                          commentAction === "reject"
                            ? "bg-[#EF4444] hover:bg-[#DC2626]"
                            : "bg-[#D97706] hover:bg-[#B45309]"
                        }`}
                      >
                        {actionLoading === commentId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : commentAction === "reject" ? (
                          t("contentReviewPage.confirmReject")
                        ) : (
                          t("contentReviewPage.confirmRequestChanges")
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--color-border-subtle)] border border-[#BFDBFE] rounded-lg">
                  <span className="text-sm font-medium text-[#1E40AF]">
                    {t("contentReviewPage.bulkSelected", { count: selectedIds.size })}
                  </span>
                  <div className="flex items-center gap-2 ms-auto">
                    <button
                      onClick={handleBulkApprove}
                      disabled={bulkLoading}
                      className="px-3 py-1.5 bg-[#22C55E] text-white text-xs font-medium rounded-md hover:bg-[#16A34A] transition-colors disabled:opacity-50"
                    >
                      {bulkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : t("contentReviewPage.bulkApprove")}
                    </button>
                    <button
                      onClick={handleBulkReject}
                      disabled={bulkLoading}
                      className="px-3 py-1.5 bg-[var(--color-surface-card)] text-[#EF4444] text-xs font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
                    >
                      {t("contentReviewPage.bulkReject")}
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 text-[var(--color-text-secondary)] text-xs font-medium hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      {t("contentReviewPage.clearSelection")}
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              {filtered.length === 0 ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <div className="w-16 h-16 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[var(--color-text-secondary)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                    {items.length === 0
                      ? t("contentReviewPage.emptyTitle")
                      : t("contentReviewPage.noContent")}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
                    {items.length === 0
                      ? t("contentReviewPage.emptyDesc")
                      : t("contentReviewPage.noContentDesc")}
                  </p>
                </div>
              ) : (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <colgroup>
                        <col className="w-10" />
                        <col className="w-8" />
                        <col />
                        <col className="w-[16%]" />
                        <col className="w-[12%] hidden sm:table-column" />
                        <col className="w-[120px]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                          <th className="px-2 py-3">
                            <input
                              type="checkbox"
                              checked={filtered.length > 0 && selectedIds.size === filtered.length}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                          </th>
                          <th className="px-1 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase"></th>
                          <th className="px-3 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("contentReviewPage.tableContent")}
                          </th>
                          <th className="px-3 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("contentReviewPage.tableCourse")}
                          </th>
                          <th className="px-3 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase hidden sm:table-cell">
                            {t("contentReviewPage.submittedOn")}
                          </th>
                          <th className="px-3 py-3 text-end text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                            {t("contentReviewPage.tableActions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {paginatedItems.map((item) => {
                          const typeConfig = TYPE_ICONS[item.type] || TYPE_ICONS.document;
                          const TypeIcon = typeConfig.icon;
                          const instructorName = `${item.instructorFirstName || ""} ${item.instructorLastName || ""}`.trim();
                          const isActionLoading = actionLoading === item.id;
                          const isExpanded = expandedRow === item.id;
                          const checklist = checklists[item.id];
                          const isChecklistLoading = checklistLoading[item.id];
                          const isChangesRequested = item.status === "changes_requested";
                          const isApproved = item.status === "live";
                          const isRejected = item.status === "rejected" || item.status === "failed";
                          const isPending = item.status === "pending_review";
                          const canAct = isPending || isChangesRequested;

                          return (
                            <Fragment key={item.id}>
                              <tr
                                className="hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
                                onClick={() => toggleExpand(item.id)}
                              >
                                <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(item.id)}
                                    onChange={() => toggleSelect(item.id)}
                                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                  />
                                </td>
                                <td className="px-1 py-3">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                  ) : (
                                    <ChevronRight className={`w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "rotate-180" : ""}`} />
                                  )}
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`w-8 h-8 ${typeConfig.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                                    >
                                      <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                          {item.title}
                                        </p>
                                        {isChangesRequested && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FEF3C7] text-[#D97706] text-[10px] font-medium rounded-full">
                                            <AlertCircle className="w-3 h-3" />
                                            {t("contentReviewPage.status.changesRequested")}
                                          </span>
                                        )}
                                        {isApproved && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DCFCE7] text-[#22C55E] text-[10px] font-medium rounded-full">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {t("contentReviewPage.stats.approved")}
                                          </span>
                                        )}
                                        {isRejected && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FEE2E2] text-[#EF4444] text-[10px] font-medium rounded-full">
                                            <XCircle className="w-3 h-3" />
                                            {t("contentReviewPage.stats.rejected")}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-xs text-[var(--color-text-secondary)]">
                                          {item.type.toUpperCase()} {formatSize(item.fileSize) && `• ${formatSize(item.fileSize)}`} {instructorName && `• ${instructorName}`}
                                        </p>
                                        {item.wcagStatus && item.wcagStatus !== "pending" && (
                                          <span
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help ${
                                              item.wcagStatus === "compliant" || item.wcagStatus === "pass"
                                                ? "bg-[#DCFCE7] text-[#22C55E]"
                                                : item.wcagStatus === "warning"
                                                  ? "bg-[#FEF9C3] text-[#EAB308]"
                                                  : "bg-[#FEE2E2] text-[#EF4444]"
                                            }`}
                                            title={(() => {
                                              if (!item.wcagDetails) return "WCAG " + item.wcagStatus;
                                              try {
                                                const d = JSON.parse(item.wcagDetails) as { label: string; passed: boolean; detail: string }[];
                                                return d.map((c) => `${c.passed ? "\u2713" : "\u2717"} ${translateLabel(c.label, isRTL)}: ${translateDetail(c.detail, isRTL)}`).join("\n");
                                              } catch { return "WCAG " + item.wcagStatus; }
                                            })()}
                                          >
                                            WCAG {item.wcagStatus === "compliant" || item.wcagStatus === "pass" ? t("contentReviewPage.wcagPass") : item.wcagStatus === "warning" ? t("contentReviewPage.wcagWarning") : t("contentReviewPage.wcagFail")}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <p className="text-sm text-[var(--color-text-secondary)] truncate">
                                    {item.courseTitle}
                                  </p>
                                </td>
                                <td className="px-3 py-3 hidden sm:table-cell">
                                  <p className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{formatDate(item.createdAt)}</p>
                                </td>
                                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                  {canAct ? (
                                    <div className="flex items-center justify-end gap-1 flex-nowrap">
                                      <button
                                        onClick={() => handleApprove(item.id)}
                                        disabled={isActionLoading}
                                        className="p-2 text-[#22C55E] hover:bg-[#DCFCE7] rounded-lg transition-colors disabled:opacity-50 group relative"
                                        title={t("contentReviewPage.approve")}
                                      >
                                        {isActionLoading ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <CheckCircle2 className="w-4 h-4" />
                                        )}
                                        <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--color-text-primary)] text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                          {t("contentReviewPage.approve")}
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => handleRequestChangesClick(item.id)}
                                        disabled={isActionLoading}
                                        className="p-2 text-[#D97706] hover:bg-[#FEF3C7] rounded-lg transition-colors disabled:opacity-50 group relative"
                                        title={t("contentReviewPage.requestChanges")}
                                      >
                                        <MessageSquare className="w-4 h-4" />
                                        <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--color-text-primary)] text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                          {t("contentReviewPage.requestChanges")}
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => handleRejectClick(item.id)}
                                        disabled={isActionLoading}
                                        className="p-2 text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors disabled:opacity-50 group relative"
                                        title={t("contentReviewPage.reject")}
                                      >
                                        <XCircle className="w-4 h-4" />
                                        <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-[var(--color-text-primary)] text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                          {t("contentReviewPage.reject")}
                                        </span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                                  )}
                                </td>
                              </tr>

                              {/* Expandable Compliance Checklist Row */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={6} className="bg-[var(--color-surface-page)] px-4 py-4">
                                    {/* Previous review note */}
                                    {item.reviewNote && (
                                      <div className="mb-4 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
                                        <p className="text-xs font-semibold text-[#D97706] mb-1">
                                          {t("contentReviewPage.previousNote")}
                                        </p>
                                        <p className="text-sm text-[#92400E]">{item.reviewNote}</p>
                                      </div>
                                    )}

                                    {/* WCAG Details */}
                                    {item.wcagDetails && (() => {
                                      try {
                                        const details = JSON.parse(item.wcagDetails) as { rule: string; label: string; passed: boolean; detail: string }[];
                                        if (details.length === 0) return null;
                                        return (
                                          <div className="mb-4">
                                            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{t("contentReviewPage.wcagChecks")}</h4>
                                            <div className="space-y-1.5">
                                              {details.map((d, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                  {d.passed ? (
                                                    <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                                                  ) : (
                                                    <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                                                  )}
                                                  <div>
                                                    <span className="font-medium text-[var(--color-text-secondary)]">{translateLabel(d.label, isRTL)}</span>
                                                    <span className="text-[var(--color-text-secondary)]"> — {translateDetail(d.detail, isRTL)}</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      } catch { return null; }
                                    })()}

                                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                                      {t("contentReviewPage.complianceChecklist")}
                                    </h4>

                                    {isChecklistLoading ? (
                                      <div className="flex items-center gap-2 py-4">
                                        <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin" />
                                        <span className="text-sm text-[var(--color-text-secondary)]">
                                          {t("contentReviewPage.loadingChecklist")}
                                        </span>
                                      </div>
                                    ) : checklist ? (
                                      <div className="space-y-2">
                                        {/* Summary */}
                                        <div className="flex items-center gap-2 mb-3">
                                          <div
                                            className={`w-2 h-2 rounded-full ${
                                              checklist.overallStatus === "passed"
                                                ? "bg-[#22C55E]"
                                                : checklist.overallStatus === "review"
                                                  ? "bg-[#F59E0B]"
                                                  : "bg-[#EF4444]"
                                            }`}
                                          />
                                          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                                            {checklist.passedCount}/{checklist.totalChecks} {t("contentReviewPage.checksPassed")}
                                          </span>
                                        </div>

                                        {/* Individual checks */}
                                        {checklist.checks.map((check) => (
                                          <div
                                            key={check.rule}
                                            className="flex items-start gap-3 p-3 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)]"
                                          >
                                            {check.status === "passed" ? (
                                              <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                                            ) : check.status === "review" ? (
                                              <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                                            ) : (
                                              <XCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                                {CHECK_LABEL_KEYS[check.rule] ? t(`contentReviewPage.checkLabels.${CHECK_LABEL_KEYS[check.rule]}`) : check.rule}
                                              </p>
                                              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                                {translateDetail(check.detail, isRTL)}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-[var(--color-text-secondary)] py-2">
                                        {t("contentReviewPage.checklistUnavailable")}
                                      </p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-4 border-t border-[var(--color-border)]">
                      <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm disabled:opacity-50">←</button>
                      <span className="text-sm text-[var(--color-text-secondary)]">{currentPage} / {totalPages}</span>
                      <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-sm disabled:opacity-50">→</button>
                    </div>
                  )}
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
