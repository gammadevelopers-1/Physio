"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Search,
  Star,
  Trash2,
  X,
  XCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";

type Review = {
  id: string;
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  rating: number;
  reviewText: string | null;
  moderationStatus: "pending" | "approved" | "rejected";
  isPublished: boolean;
  createdAt: string;
  reviewedAt: string | null;
  studentName: string;
};

type FilterTab = "all" | "pending" | "approved" | "rejected";
type SortOption = "newest" | "oldest" | "highest" | "lowest";

const PAGE_SIZE = 20;

export default function ManagerAllReviewsContent() {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const manager = useManagerProfile();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  const [tab, setTab] = useState<FilterTab>("pending");
  const [publishedFilter, setPublishedFilter] = useState<"all" | "published" | "unpublished">("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [courseOptions, setCourseOptions] = useState<Array<{ id: string; title: string; titleAr: string | null }>>([]);

  const [actingId, setActingId] = useState<string | null>(null);
  const [modal, setModal] = useState<Review | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Review | null>(null);

  // Reset publish filter whenever we leave the "All" tab — it's hidden there anyway
  useEffect(() => {
    if (tab !== "all" && publishedFilter !== "all") {
      setPublishedFilter("all");
    }
  }, [tab, publishedFilter]);

  // Fetch the manager's own courses to populate the "by course" dropdown
  useEffect(() => {
    courseManagerApi
      .getCourses({ limit: 200 })
      .then((res) => {
        setCourseOptions(
          (res.data || []).map((c) => ({ id: c.id, title: c.title, titleAr: c.titleAr })),
        );
      })
      .catch(() => setCourseOptions([]));
  }, []);

  const fetchReviews = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const res = await courseManagerApi.getManagerReviews({
          page: nextPage,
          limit: PAGE_SIZE,
          moderationStatus: tab === "all" ? undefined : tab,
          publishedOnly: publishedFilter === "published",
          unpublishedOnly: publishedFilter === "unpublished",
          courseId: courseFilter || undefined,
          search: search || undefined,
          sort,
        });
        setReviews(res.data);
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotal(res.total);
        setCounts(res.counts);
      } catch {
        toast.error(isRTL ? "فشل تحميل المراجعات" : "Failed to load reviews");
        setReviews([]);
      } finally {
        setLoading(false);
      }
    },
    [tab, publishedFilter, courseFilter, sort, search, isRTL],
  );

  useEffect(() => {
    fetchReviews(1);
  }, [fetchReviews]);

  const refresh = () => fetchReviews(page);

  const handleApprove = async (r: Review) => {
    setActingId(r.id);
    try {
      await courseManagerApi.approveReview(r.courseId, r.id);
      toast.success(isRTL ? "تمت الموافقة على المراجعة ونشرها" : "Review approved and published");
      refresh();
    } catch {
      toast.error(isRTL ? "فشل تحديث المراجعة" : "Failed to update review");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (r: Review) => {
    setActingId(r.id);
    try {
      await courseManagerApi.rejectReview(r.courseId, r.id);
      toast.success(isRTL ? "تم رفض المراجعة" : "Review rejected");
      refresh();
    } catch {
      toast.error(isRTL ? "فشل تحديث المراجعة" : "Failed to update review");
    } finally {
      setActingId(null);
    }
  };

  const handleTogglePublish = async (r: Review) => {
    setActingId(r.id);
    try {
      await courseManagerApi.setReviewPublished(r.courseId, r.id, !r.isPublished);
      toast.success(
        isRTL
          ? r.isPublished
            ? "تم إلغاء نشر المراجعة"
            : "تم نشر المراجعة"
          : r.isPublished
            ? "Review unpublished"
            : "Review published",
      );
      refresh();
    } catch {
      toast.error(isRTL ? "فشل تحديث المراجعة" : "Failed to update review");
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActingId(deleteConfirm.id);
    try {
      await courseManagerApi.deleteReview(deleteConfirm.courseId, deleteConfirm.id);
      toast.success(isRTL ? "تم حذف المراجعة" : "Review deleted");
      setDeleteConfirm(null);
      refresh();
    } catch {
      toast.error(isRTL ? "فشل حذف المراجعة" : "Failed to delete review");
    } finally {
      setActingId(null);
    }
  };

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  const statusBadge = (s: Review["moderationStatus"]) => {
    const map: Record<Review["moderationStatus"], { label: string; cls: string; Icon: typeof Clock }> = {
      pending: {
        label: isRTL ? "قيد المراجعة" : "Pending",
        cls: "bg-amber-100 text-amber-800",
        Icon: Clock,
      },
      approved: {
        label: isRTL ? "موافق عليها" : "Approved",
        cls: "bg-green-100 text-green-700",
        Icon: CheckCircle2,
      },
      rejected: {
        label: isRTL ? "مرفوضة" : "Rejected",
        cls: "bg-red-100 text-red-700",
        Icon: XCircle,
      },
    };
    const { label, cls, Icon } = map[s];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
        <Icon className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const pageNumbers = () => {
    const pages: (number | "...")[] = [];
    const window = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return pages;
  };

  const tabItems: { key: FilterTab; label: string; count?: number }[] = [
    {
      key: "pending",
      label: isRTL ? "قيد المراجعة" : "Pending",
      count: counts.pending,
    },
    {
      key: "approved",
      label: isRTL ? "موافق عليها" : "Approved",
      count: counts.approved,
    },
    {
      key: "rejected",
      label: isRTL ? "مرفوضة" : "Rejected",
      count: counts.rejected,
    },
    {
      key: "all",
      label: isRTL ? "الكل" : "All",
    },
  ];

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
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {isRTL ? "مراجعات الطلاب" : "Student Reviews"}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {isRTL
                    ? "راجع ووافق على المراجعات قبل نشرها على صفحات الدورة العامة"
                    : "Review and approve feedback before it appears on public course pages"}
                </p>
              </div>

              {/* Tabs */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-2 mb-4">
                <div className="flex flex-wrap gap-1">
                  {tabItems.map((ti) => (
                    <button
                      key={ti.key}
                      onClick={() => setTab(ti.key)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        tab === ti.key
                          ? "bg-[var(--color-text-primary)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      {ti.label}
                      {ti.count !== undefined && ti.count > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            tab === ti.key ? "bg-[var(--color-surface-card)]/20" : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {ti.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className={`w-4 h-4 text-[var(--color-text-secondary)] absolute top-2.5 ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") setSearch(searchInput); }}
                      onBlur={() => setSearch(searchInput)}
                      placeholder={isRTL ? "بحث باسم الطالب أو الدورة أو نص المراجعة..." : "Search by student, course, or review text..."}
                      className={`w-full ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">{isRTL ? "الدورة:" : "Course:"}</span>
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      className="text-sm border border-[var(--color-input-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-surface-card)] max-w-[240px]"
                    >
                      <option value="">{isRTL ? "كل الدورات" : "All courses"}</option>
                      {courseOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {isRTL && c.titleAr ? c.titleAr : c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Publish filter only makes sense on "All" — on Pending it's always unpublished; on Approved/Rejected the per-row badge already shows state */}
                  {tab === "all" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{isRTL ? "النشر:" : "Published:"}</span>
                      <select
                        value={publishedFilter}
                        onChange={(e) => setPublishedFilter(e.target.value as typeof publishedFilter)}
                        className="text-sm border border-[var(--color-input-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-surface-card)]"
                      >
                        <option value="all">{isRTL ? "الكل" : "All"}</option>
                        <option value="published">{isRTL ? "منشورة" : "Published"}</option>
                        <option value="unpublished">{isRTL ? "غير منشورة" : "Unpublished"}</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">{isRTL ? "الترتيب:" : "Sort:"}</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortOption)}
                      className="text-sm border border-[var(--color-input-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-[var(--color-surface-card)]"
                    >
                      <option value="newest">{isRTL ? "الأحدث" : "Newest"}</option>
                      <option value="oldest">{isRTL ? "الأقدم" : "Oldest"}</option>
                      <option value="highest">{isRTL ? "الأعلى تقييماً" : "Highest rated"}</option>
                      <option value="lowest">{isRTL ? "الأقل تقييماً" : "Lowest rated"}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-xl bg-[var(--color-border-subtle)] flex items-center justify-center mb-3">
                      <Star className="w-7 h-7 text-[var(--color-star-border)]" />
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {isRTL ? "لا توجد مراجعات مطابقة" : "No reviews match your filters"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((r) => {
                      const courseTitle = isRTL && r.courseTitleAr ? r.courseTitleAr : r.courseTitle;
                      const isBusy = actingId === r.id;
                      return (
                        <div key={r.id} className="border border-[var(--color-border)] rounded-lg p-4 bg-[#FAFAFA]">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{r.studentName}</p>
                                {statusBadge(r.moderationStatus)}
                                {r.isPublished ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
                                    <Eye className="w-3 h-3" />
                                    {isRTL ? "منشورة" : "Published"}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                                    <EyeOff className="w-3 h-3" />
                                    {isRTL ? "غير منشورة" : "Unpublished"}
                                  </span>
                                )}
                              </div>
                              <Link
                                href={`/${locale}/dashboard/manager/courses/${r.courseId}`}
                                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline truncate inline-block max-w-full"
                              >
                                {courseTitle}
                              </Link>
                              <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(r.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-4 h-4 ${s <= r.rating ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)]"}`}
                                />
                              ))}
                            </div>
                          </div>
                          {r.reviewText && (
                            <p dir="auto" className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line line-clamp-3 mb-3">
                              {r.reviewText}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setModal(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {isRTL ? "عرض" : "View"}
                            </button>
                            {r.moderationStatus === "pending" && (
                              <>
                                <button
                                  onClick={() => handleApprove(r)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                                >
                                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  {isRTL ? "موافقة" : "Approve"}
                                </button>
                                <button
                                  onClick={() => handleReject(r)}
                                  disabled={isBusy}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  {isRTL ? "رفض" : "Reject"}
                                </button>
                              </>
                            )}
                            {r.moderationStatus !== "pending" && (
                              <button
                                onClick={() => handleTogglePublish(r)}
                                disabled={isBusy}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-60"
                              >
                                {r.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                {r.isPublished
                                  ? isRTL
                                    ? "إلغاء النشر"
                                    : "Unpublish"
                                  : isRTL
                                    ? "نشر"
                                    : "Publish"}
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteConfirm(r)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isRTL ? "حذف" : "Delete"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {!loading && reviews.length > 0 && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {isRTL ? `صفحة ${page} من ${totalPages} · ${total} نتيجة` : `Page ${page} of ${totalPages} · ${total} result${total === 1 ? "" : "s"}`}
                    </p>
                    <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <button
                        onClick={() => fetchReviews(page - 1)}
                        disabled={page <= 1}
                        className="p-1.5 rounded hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                      {pageNumbers().map((p, i) =>
                        p === "..." ? (
                          <span key={`d-${i}`} className="px-2 text-xs text-[var(--color-text-secondary)]">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => fetchReviews(p)}
                            className={`min-w-[28px] h-7 px-2 text-xs font-medium rounded ${
                              p === page ? "bg-[var(--color-text-primary)] text-white" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                      <button
                        onClick={() => fetchReviews(page + 1)}
                        disabled={page >= totalPages}
                        className="p-1.5 rounded hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModal(null)}>
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? "rtl" : "ltr"}
          >
            <div className="p-5 border-b border-[var(--color-border)] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{modal.studentName}</h3>
                  {statusBadge(modal.moderationStatus)}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] truncate">
                  {isRTL && modal.courseTitleAr ? modal.courseTitleAr : modal.courseTitle}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="p-1 rounded hover:bg-[var(--color-border-subtle)]">
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`w-5 h-5 ${s <= modal.rating ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)]"}`} />
                ))}
              </div>
              {modal.reviewText ? (
                <p dir="auto" className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{modal.reviewText}</p>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)] italic">{isRTL ? "لا يوجد نص" : "No text"}</p>
              )}
              <div className="text-xs text-[var(--color-text-secondary)] space-y-0.5 pt-3 border-t border-[var(--color-border)]">
                <p>{isRTL ? `تاريخ الإرسال: ${formatDate(modal.createdAt)}` : `Submitted: ${formatDate(modal.createdAt)}`}</p>
                {modal.reviewedAt && (
                  <p>{isRTL ? `تاريخ المراجعة: ${formatDate(modal.reviewedAt)}` : `Reviewed: ${formatDate(modal.reviewedAt)}`}</p>
                )}
                <p>
                  {isRTL ? "الحالة: " : "Status: "}
                  {modal.isPublished
                    ? isRTL
                      ? "منشورة على الصفحة العامة"
                      : "Visible on public page"
                    : isRTL
                      ? "غير منشورة"
                      : "Not published"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-md w-full p-5" dir={isRTL ? "rtl" : "ltr"}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {isRTL ? "حذف المراجعة" : "Delete Review"}
              </h3>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              {isRTL
                ? "هل أنت متأكد من حذف هذه المراجعة؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this review? This action cannot be undone."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
              >
                {isRTL ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleDelete}
                disabled={actingId === deleteConfirm.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {actingId === deleteConfirm.id && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRTL ? "حذف" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
