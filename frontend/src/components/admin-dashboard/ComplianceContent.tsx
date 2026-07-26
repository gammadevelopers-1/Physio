"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Check,
  X,
  AlertTriangle,
  Download,
  Search,
  Loader2,
  FileText,
  Video,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import Select from "@/components/ui/Select";
import ComplianceScorecardDrawer from "./ComplianceScorecardDrawer";
import { TableRowSkeleton } from "./AdminSkeletons";
import { nelcComplianceApi } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

type Status = "passed" | "review" | "failed";

interface CourseRow {
  courseId: string;
  courseTitle: string;
  instructorName: string;
  deliveryType: string | null;
  createdAt: string;
  overallStatus: Status;
  overallScore: number;
  summary: { passed: number; review: number; failed: number; total: number };
}

interface VirtualSessionRow {
  sessionId: string;
  sessionTitle: string;
  courseTitle: string;
  instructorName: string;
  type: string;
  scheduledAt: string | null;
  durationMinutes: number;
  status: string;
  hasZoomLink: boolean;
  hasRecording: boolean;
  overallStatus: Status;
  checks: Array<{ rule: string; status: Status; detail: string }>;
}

type SortKey = "latest" | "score" | "title" | "instructor";
type StatusFilter = "all" | Status;
type DeliveryFilter = "all" | "zoom" | "webinar" | "blended" | "onsite" | "self-paced";

const PAGE_SIZE = 10;

function StatusPill({ status }: { status: Status }) {
  const t = useTranslations("adminDashboard.compliance");
  const style =
    status === "passed"
      ? "bg-[#DCFCE7] text-[#16A34A]"
      : status === "review"
        ? "bg-[#FEF3C7] text-[#D97706]"
        : "bg-[#FEE2E2] text-[#DC2626]";
  const label = status === "passed" ? t("pass") : status === "review" ? t("review") : t("fail");
  return <span className={`px-2 py-0.5 text-xs font-medium rounded ${style}`}>{label}</span>;
}

const ComplianceContent = () => {
  const t = useTranslations("adminDashboard.compliancePage");
  const tShared = useTranslations("adminDashboard.compliance");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [virtual, setVirtual] = useState<VirtualSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"courses" | "virtual">("courses");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("latest");
  const [coursePage, setCoursePage] = useState(1);
  const [virtualPage, setVirtualPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [openCourse, setOpenCourse] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [coursesRes, virtualRes] = await Promise.allSettled([
        nelcComplianceApi.getAllCoursesCompliance(),
        nelcComplianceApi.getVirtualClassCompliance(),
      ]);
      if (cancelled) return;
      if (coursesRes.status === "fulfilled") setCourses(coursesRes.value as CourseRow[]);
      if (virtualRes.status === "fulfilled") setVirtual(virtualRes.value as VirtualSessionRow[]);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── KPI numbers ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = courses.length;
    const compliant = courses.filter((c) => c.overallStatus === "passed").length;
    const review = courses.filter((c) => c.overallStatus === "review").length;
    const failed = courses.filter((c) => c.overallStatus === "failed").length;
    const virtualAtRisk = virtual.filter((v) => v.overallStatus !== "passed").length;
    return { total, compliant, review, failed, virtualAtRisk };
  }, [courses, virtual]);

  const overallPct = kpis.total > 0 ? Math.round((kpis.compliant / kpis.total) * 100) : 0;

  // ── Filtered + sorted courses ──────────────────────────────────────
  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = courses.filter((c) => {
      if (statusFilter !== "all" && c.overallStatus !== statusFilter) return false;
      if (deliveryFilter !== "all" && c.deliveryType !== deliveryFilter) return false;
      if (q && !c.courseTitle.toLowerCase().includes(q) && !c.instructorName.toLowerCase().includes(q))
        return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (sortBy === "latest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "score") return a.overallScore - b.overallScore; // worst first
      if (sortBy === "title") return a.courseTitle.localeCompare(b.courseTitle);
      return a.instructorName.localeCompare(b.instructorName);
    });
  }, [courses, search, statusFilter, deliveryFilter, sortBy]);

  // Reset to page 1 whenever filters/search/sort change so users don't
  // land on an empty page when the result set shrinks.
  useEffect(() => {
    setCoursePage(1);
  }, [search, statusFilter, deliveryFilter, sortBy]);

  useEffect(() => {
    setVirtualPage(1);
  }, [virtual.length]);

  // Paginate the filtered courses on the client. The list is already
  // capped at the server's all-courses output (≤ a few hundred), so
  // client-side slicing is fine until that grows.
  const courseTotalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));
  const visibleCourses = useMemo(
    () => filteredCourses.slice((coursePage - 1) * PAGE_SIZE, coursePage * PAGE_SIZE),
    [filteredCourses, coursePage],
  );
  const virtualTotalPages = Math.max(1, Math.ceil(virtual.length / PAGE_SIZE));
  const visibleVirtual = useMemo(
    () => virtual.slice((virtualPage - 1) * PAGE_SIZE, virtualPage * PAGE_SIZE),
    [virtual, virtualPage],
  );


  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await nelcComplianceApi.downloadCsvReport();
    } finally {
      setExporting(false);
    }
  };

  // ── Formatting helpers ─────────────────────────────────────────────
  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("subtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting || loading || courses.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg transition-colors disabled:opacity-60"
                >
                  {exporting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">{t("exportReport")}</span>
                </button>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <KpiCard
                  icon={ShieldCheck}
                  iconBg="bg-[#DCFCE7]"
                  iconColor="text-[#16A34A]"
                  label={t("kpi.compliant")}
                  value={`${kpis.compliant} / ${kpis.total}`}
                  sub={`${overallPct}% ${t("kpi.overall")}`}
                />
                <KpiCard
                  icon={AlertTriangle}
                  iconBg="bg-[#FEF3C7]"
                  iconColor="text-[#D97706]"
                  label={t("kpi.review")}
                  value={String(kpis.review)}
                  sub={t("kpi.reviewSub")}
                />
                <KpiCard
                  icon={X}
                  iconBg="bg-[#FEE2E2]"
                  iconColor="text-[#DC2626]"
                  label={t("kpi.failing")}
                  value={String(kpis.failed)}
                  sub={t("kpi.failingSub")}
                />
                <KpiCard
                  icon={Video}
                  iconBg="bg-[var(--color-border-subtle)]"
                  iconColor="text-[var(--color-primary)]"
                  label={t("kpi.virtualAtRisk")}
                  value={String(kpis.virtualAtRisk)}
                  sub={t("kpi.virtualSub")}
                />
              </div>

              <div>
                {/* Main panel — tabs + table */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  {/* Tabs */}
                  <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                    <TabButton
                      active={tab === "courses"}
                      onClick={() => setTab("courses")}
                      icon={ListChecks}
                      label={`${t("tabs.courses")} (${courses.length})`}
                    />
                    <TabButton
                      active={tab === "virtual"}
                      onClick={() => setTab("virtual")}
                      icon={Video}
                      label={`${t("tabs.virtual")} (${virtual.length})`}
                    />
                  </div>

                  {/* Filters */}
                  {tab === "courses" && (
                    <div className="px-5 py-4 flex flex-col sm:flex-row gap-3 border-b border-[var(--color-border)]">
                      <div className="relative flex-1">
                        <Search
                          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] start-3`}
                        />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={t("searchPlaceholder")}
                          className={`w-full ps-9 pe-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-page)] focus:outline-none focus:border-[var(--color-primary)]`}
                        />
                      </div>
                      <Select
                        value={statusFilter}
                        onChange={(v) => setStatusFilter(v as StatusFilter)}
                        size="sm"
                        className="min-w-[160px]"
                        options={[
                          { value: "all", label: t("filters.allStatuses") },
                          { value: "passed", label: tShared("pass") },
                          { value: "review", label: tShared("review") },
                          { value: "failed", label: tShared("fail") },
                        ]}
                      />
                      <Select
                        value={deliveryFilter}
                        onChange={(v) => setDeliveryFilter(v as DeliveryFilter)}
                        size="sm"
                        className="min-w-[180px]"
                        options={[
                          { value: "all", label: t("filters.allDeliveries") },
                          { value: "zoom", label: t("filters.deliveryZoom") },
                          { value: "webinar", label: t("filters.deliveryWebinar") },
                          { value: "blended", label: t("filters.deliveryBlended") },
                          { value: "onsite", label: t("filters.deliveryOnsite") },
                          { value: "self-paced", label: t("filters.deliverySelfPaced") },
                        ]}
                      />
                      <Select
                        value={sortBy}
                        onChange={(v) => setSortBy(v as SortKey)}
                        size="sm"
                        className="min-w-[160px]"
                        options={[
                          { value: "latest", label: t("filters.sortLatest") },
                          { value: "score", label: t("filters.sortScore") },
                          { value: "title", label: t("filters.sortTitle") },
                          { value: "instructor", label: t("filters.sortInstructor") },
                        ]}
                      />
                    </div>
                  )}

                  {/* Courses table */}
                  {tab === "courses" && (
                    <div className="overflow-x-auto">
                      {loading && (
                        <div>
                          {Array.from({ length: 8 }).map((_, i) => (
                            <TableRowSkeleton key={i} cols={6} />
                          ))}
                        </div>
                      )}
                      {!loading && visibleCourses.length === 0 && filteredCourses.length === 0 && (
                        <p className="text-sm text-[var(--color-text-secondary)] py-12 text-center">
                          {t("noCourses")}
                        </p>
                      )}
                      {!loading && filteredCourses.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--color-surface-page)] text-xs uppercase text-[var(--color-text-secondary)]">
                            <tr>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.course")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.instructor")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.delivery")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.score")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.status")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {visibleCourses.map((c) => (
                              <tr
                                key={c.courseId}
                                onClick={() =>
                                  setOpenCourse({ id: c.courseId, title: c.courseTitle })
                                }
                                className="cursor-pointer hover:bg-[var(--color-border-subtle)] transition-colors"
                              >
                                <td className="px-5 py-3">
                                  <p className="font-medium text-[var(--color-text-primary)] line-clamp-1">
                                    {c.courseTitle}
                                  </p>
                                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                    {c.summary.passed}/{c.summary.total} {t("categoriesPassing")}
                                  </p>
                                </td>
                                <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                                  {c.instructorName}
                                </td>
                                <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                                  {c.deliveryType || "—"}
                                </td>
                                <td className="px-5 py-3">
                                  <span
                                    className={`font-semibold ${
                                      c.overallScore >= 80
                                        ? "text-[#16A34A]"
                                        : c.overallScore >= 60
                                          ? "text-[#D97706]"
                                          : "text-[#DC2626]"
                                    }`}
                                  >
                                    {c.overallScore}%
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  <StatusPill status={c.overallStatus} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {!loading && filteredCourses.length > PAGE_SIZE && (
                        <Pagination
                          page={coursePage}
                          totalPages={courseTotalPages}
                          onChange={setCoursePage}
                          total={filteredCourses.length}
                          isRTL={isRTL}
                        />
                      )}
                    </div>
                  )}

                  {/* Virtual classes table */}
                  {tab === "virtual" && (
                    <div className="overflow-x-auto">
                      {loading && (
                        <div>
                          {Array.from({ length: 8 }).map((_, i) => (
                            <TableRowSkeleton key={i} cols={6} />
                          ))}
                        </div>
                      )}
                      {!loading && virtual.length === 0 && (
                        <p className="text-sm text-[var(--color-text-secondary)] py-12 text-center">
                          {t("noVirtual")}
                        </p>
                      )}
                      {!loading && virtual.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--color-surface-page)] text-xs uppercase text-[var(--color-text-secondary)]">
                            <tr>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.session")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.course")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.scheduled")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.zoom")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.recording")}
                              </th>
                              <th className={`px-5 py-3 text-start`}>
                                {t("table.status")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {visibleVirtual.map((v) => (
                              <tr key={v.sessionId}>
                                <td className="px-5 py-3">
                                  <p className="font-medium text-[var(--color-text-primary)] line-clamp-1">
                                    {v.sessionTitle}
                                  </p>
                                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                    {v.instructorName} • {v.type}
                                  </p>
                                </td>
                                <td className="px-5 py-3 text-[var(--color-text-secondary)] line-clamp-1">
                                  {v.courseTitle}
                                </td>
                                <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                                  {fmtDate(v.scheduledAt)}
                                </td>
                                <td className="px-5 py-3">
                                  {v.hasZoomLink ? (
                                    <Check className="w-4 h-4 text-[#16A34A]" />
                                  ) : (
                                    <X className="w-4 h-4 text-[#DC2626]" />
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  {v.hasRecording ? (
                                    <Check className="w-4 h-4 text-[#16A34A]" />
                                  ) : (
                                    <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  <StatusPill status={v.overallStatus} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {!loading && virtual.length > PAGE_SIZE && (
                        <Pagination
                          page={virtualPage}
                          totalPages={virtualTotalPages}
                          onChange={setVirtualPage}
                          total={virtual.length}
                          isRTL={isRTL}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {openCourse && (
        <ComplianceScorecardDrawer
          courseId={openCourse.id}
          courseTitle={openCourse.title}
          open
          onClose={() => setOpenCourse(null)}
        />
      )}
    </>
  );
};

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: typeof FileText;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{value}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{sub}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-[var(--color-primary)] text-[var(--color-text-primary)] bg-[var(--color-surface-card)]"
          : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
  total,
  isRTL,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  total: number;
  isRTL: boolean;
}) {
  const t = useTranslations("adminDashboard.compliancePage");
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-page)]">
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("pagination.showing", { start, end, total })}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRTL ? t("pagination.next") : t("pagination.prev")}
        </button>
        <span className="text-xs text-[var(--color-text-secondary)] px-2">
          {t("pagination.pageOf", { page, total: totalPages })}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRTL ? t("pagination.prev") : t("pagination.next")}
        </button>
      </div>
    </div>
  );
}

export default ComplianceContent;
