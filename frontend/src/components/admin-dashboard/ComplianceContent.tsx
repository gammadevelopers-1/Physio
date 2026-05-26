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
import ComplianceScorecardDrawer from "./ComplianceScorecardDrawer";
import { nelcComplianceApi } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

type Status = "passed" | "review" | "failed";

interface CourseRow {
  courseId: string;
  courseTitle: string;
  instructorName: string;
  deliveryType: string | null;
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

interface Issue {
  key: string;
  courseId: string;
  courseTitle: string;
  rule: string;
  detail: string;
  status: Status;
}

type SortKey = "score" | "title" | "instructor";
type StatusFilter = "all" | Status;

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
  const [sortBy, setSortBy] = useState<SortKey>("score");
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
      if (q && !c.courseTitle.toLowerCase().includes(q) && !c.instructorName.toLowerCase().includes(q))
        return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (sortBy === "score") return a.overallScore - b.overallScore; // worst first
      if (sortBy === "title") return a.courseTitle.localeCompare(b.courseTitle);
      return a.instructorName.localeCompare(b.instructorName);
    });
  }, [courses, search, statusFilter, sortBy]);

  // ── Top issues aggregated across courses for the sidebar ──────────
  // We don't have the per-course scorecards loaded by default, so the
  // issue list works off the all-courses summary + virtual sessions
  // we already have. Each course with failing/review categories
  // contributes a single row pointing to its scorecard.
  const issues: Issue[] = useMemo(() => {
    const fromCourses = courses
      .filter((c) => c.overallStatus !== "passed")
      .map<Issue>((c) => ({
        key: `course-${c.courseId}`,
        courseId: c.courseId,
        courseTitle: c.courseTitle,
        rule: c.overallStatus === "failed" ? t("issueFailed") : t("issueReview"),
        detail: t("issueCounts", {
          review: c.summary.review,
          failed: c.summary.failed,
          total: c.summary.total,
        }),
        status: c.overallStatus,
      }));
    return fromCourses.slice(0, 30);
  }, [courses, t]);

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

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
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
                          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                        />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={t("searchPlaceholder")}
                          className={`w-full ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-page)] focus:outline-none focus:border-[var(--color-primary)]`}
                        />
                      </div>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        className="px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-page)]"
                      >
                        <option value="all">{t("filters.allStatuses")}</option>
                        <option value="passed">{tShared("pass")}</option>
                        <option value="review">{tShared("review")}</option>
                        <option value="failed">{tShared("fail")}</option>
                      </select>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortKey)}
                        className="px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-page)]"
                      >
                        <option value="score">{t("filters.sortScore")}</option>
                        <option value="title">{t("filters.sortTitle")}</option>
                        <option value="instructor">{t("filters.sortInstructor")}</option>
                      </select>
                    </div>
                  )}

                  {/* Courses table */}
                  {tab === "courses" && (
                    <div className="overflow-x-auto">
                      {loading && (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                        </div>
                      )}
                      {!loading && filteredCourses.length === 0 && (
                        <p className="text-sm text-[var(--color-text-secondary)] py-12 text-center">
                          {t("noCourses")}
                        </p>
                      )}
                      {!loading && filteredCourses.length > 0 && (
                        <table className="w-full text-sm">
                          <thead className="bg-[var(--color-surface-page)] text-xs uppercase text-[var(--color-text-secondary)]">
                            <tr>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.course")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.instructor")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.delivery")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.score")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.status")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {filteredCourses.map((c) => (
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
                    </div>
                  )}

                  {/* Virtual classes table */}
                  {tab === "virtual" && (
                    <div className="overflow-x-auto">
                      {loading && (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
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
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.session")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.course")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.scheduled")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.zoom")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.recording")}
                              </th>
                              <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                                {t("table.status")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {virtual.map((v) => (
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
                    </div>
                  )}
                </div>

                {/* Issues sidebar */}
                <aside className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 h-fit xl:sticky xl:top-6">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-[#D97706]" />
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {t("issuesTitle")}
                    </h3>
                    {issues.length > 0 && (
                      <span className="ms-auto bg-[#EF4444] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {issues.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1 -mr-1">
                    {loading && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                      </div>
                    )}
                    {!loading && issues.length === 0 && (
                      <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
                        {t("noIssues")}
                      </p>
                    )}
                    {!loading &&
                      issues.map((issue) => (
                        <button
                          key={issue.key}
                          type="button"
                          onClick={() =>
                            setOpenCourse({ id: issue.courseId, title: issue.courseTitle })
                          }
                          className={`w-full text-start p-3 rounded-lg border transition-colors ${
                            issue.status === "failed"
                              ? "bg-[#FEE2E2] border-[#FCA5A5] hover:bg-[#FECACA]"
                              : "bg-[#FEF3C7] border-[#FCD34D] hover:bg-[#FDE68A]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {issue.status === "failed" ? (
                              <X className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium ${issue.status === "failed" ? "text-[#991B1B]" : "text-[#92400E]"} line-clamp-1`}
                              >
                                {issue.courseTitle}
                              </p>
                              <p
                                className={`text-xs mt-0.5 ${issue.status === "failed" ? "text-[#B91C1C]" : "text-[#B45309]"}`}
                              >
                                {issue.detail}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </aside>
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

export default ComplianceContent;
