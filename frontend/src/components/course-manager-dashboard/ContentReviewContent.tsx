"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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
} from "lucide-react";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useContentReview } from "@/hooks/useContentReview";

const TYPE_ICONS: Record<string, { icon: typeof Video; bg: string; color: string }> = {
  video: { icon: Video, bg: "bg-[#DBEAFE]", color: "text-[#3B82F6]" },
  pdf: { icon: FileText, bg: "bg-[#FEE2E2]", color: "text-[#EF4444]" },
  document: { icon: File, bg: "bg-[#FEF3C7]", color: "text-[#F59E0B]" },
  image: { icon: ImageIcon, bg: "bg-[#D1FAE5]", color: "text-[#10B981]" },
};

const ContentReviewContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const { items, stats, loading, error, refetch, approve, reject } = useContentReview();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    if (typeFilter !== "all") {
      result = result.filter((item) => item.type === typeFilter);
    }
    return result;
  }, [items, search, typeFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approve(id);
      toast.success(t("contentReviewPage.approve") + " — " + t("contentReview.approve"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await reject(id);
      toast.success(t("contentReviewPage.reject") + " — " + t("contentReview.reject"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
        <div className="bg-[#F9FAFB] min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#6B7280]">{t("dashboard.loading")}</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CourseManagerNavbar manager={manager} />
        <div className="bg-[#F9FAFB] min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280] mb-4">{error}</p>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg"
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

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-[#1F2937]">{t("contentReviewPage.title")}</h1>
                <p className="text-sm text-[#6B7280] mt-1">{t("contentReviewPage.subtitle")}</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#F59E0B]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1F2937]">{stats.pending}</p>
                    <p className="text-xs text-[#6B7280]">{t("contentReviewPage.stats.pending")}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1F2937]">{stats.approved}</p>
                    <p className="text-xs text-[#6B7280]">{t("contentReviewPage.stats.approved")}</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-[#EF4444]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#1F2937]">{stats.rejected}</p>
                    <p className="text-xs text-[#6B7280]">{t("contentReviewPage.stats.rejected")}</p>
                  </div>
                </div>
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder={t("contentReviewPage.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                >
                  <option value="all">{t("contentReviewPage.filters.allTypes")}</option>
                  <option value="video">{t("contentReviewPage.filters.video")}</option>
                  <option value="pdf">{t("contentReviewPage.filters.pdf")}</option>
                  <option value="document">{t("contentReviewPage.filters.document")}</option>
                </select>
              </div>

              {/* Table */}
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {items.length === 0
                      ? t("contentReviewPage.emptyTitle")
                      : t("contentReviewPage.noContent")}
                  </h3>
                  <p className="text-sm text-[#6B7280] max-w-md mx-auto">
                    {items.length === 0
                      ? t("contentReviewPage.emptyDesc")
                      : t("contentReviewPage.noContentDesc")}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                            Content
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase">
                            Course
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase hidden md:table-cell">
                            Instructor
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase hidden sm:table-cell">
                            {t("contentReviewPage.submittedOn")}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {filtered.map((item) => {
                          const typeConfig = TYPE_ICONS[item.type] || TYPE_ICONS.document;
                          const TypeIcon = typeConfig.icon;
                          const instructorName = `${item.instructorFirstName || ""} ${item.instructorLastName || ""}`.trim();
                          const isActionLoading = actionLoading === item.id;

                          return (
                            <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-9 h-9 ${typeConfig.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                                  >
                                    <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#1F2937] truncate">
                                      {item.title}
                                    </p>
                                    <p className="text-xs text-[#9CA3AF]">
                                      {item.type.toUpperCase()} {formatSize(item.fileSize) && `• ${formatSize(item.fileSize)}`}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm text-[#4B5563] truncate max-w-[200px]">
                                  {item.courseTitle}
                                </p>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <p className="text-sm text-[#4B5563]">{instructorName || item.instructorEmail}</p>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <p className="text-sm text-[#6B7280]">{formatDate(item.createdAt)}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleApprove(item.id)}
                                    disabled={isActionLoading}
                                    className="px-3 py-1.5 bg-[#22C55E] text-white text-xs font-medium rounded-md hover:bg-[#16A34A] transition-colors disabled:opacity-50"
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      t("contentReviewPage.approve")
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleReject(item.id)}
                                    disabled={isActionLoading}
                                    className="px-3 py-1.5 bg-white text-[#EF4444] text-xs font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEF2F2] transition-colors disabled:opacity-50"
                                  >
                                    {t("contentReviewPage.reject")}
                                  </button>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContentReviewContent;
