"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Search,
  Eye,
  FileText,
} from "lucide-react";
import AdminNavbar from "@/components/admin-dashboard/AdminNavbar";
import AdminSidebar from "@/components/admin-dashboard/AdminSidebar";
import AdminMobileSidebar from "@/components/admin-dashboard/AdminMobileSidebar";
import Select from "@/components/ui/Select";
import SubmissionDetailDrawer from "./SubmissionDetailDrawer";
import { instructorApi, ApiError } from "@/lib/api";
import { pickLocaleTitle } from "@/lib/locale-title";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import type {
  AssessmentResponse,
  AssessmentQuestion,
  AssessmentSubmission,
} from "@/types/instructor-dashboard";

interface Props {
  courseId: string;
  assessmentId: string;
}

type Status = "in_progress" | "submitted" | "graded";

function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("adminDashboard.assessmentSubmissions");
  const style =
    status === "graded"
      ? "bg-[#DCFCE7] text-[#16A34A]"
      : status === "submitted"
        ? "bg-[#FEF3C7] text-[#D97706]"
        : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  const label =
    status === "graded"
      ? t("statuses.graded")
      : status === "submitted"
        ? t("statuses.submitted")
        : t("statuses.inProgress");
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${style}`}>{label}</span>
  );
}

export default function AssessmentSubmissionsContent({ courseId, assessmentId }: Props) {
  const t = useTranslations("adminDashboard.assessmentSubmissions");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<
    (AssessmentResponse & { questions: AssessmentQuestion[] }) | null
  >(null);
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, subs] = await Promise.all([
        instructorApi.getAssessmentDetail(assessmentId),
        instructorApi.getSubmissions(assessmentId),
      ]);
      setAssessment(detail);
      setSubmissions(subs);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      const name = `${s.studentFirstName || ""} ${s.studentLastName || ""} ${s.studentEmail || ""}`.toLowerCase();
      return name.includes(q);
    });
  }, [submissions, search, statusFilter]);

  const counts = useMemo(() => {
    const total = submissions.length;
    const graded = submissions.filter((s) => s.status === "graded").length;
    const pending = submissions.filter((s) => s.status === "submitted").length;
    const inProgress = submissions.filter((s) => s.status === "in_progress").length;
    return { total, graded, pending, inProgress };
  }, [submissions]);

  const openSubmission = useMemo(
    () => submissions.find((s) => s.id === openSubmissionId) ?? null,
    [submissions, openSubmissionId],
  );

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
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
              {/* Back link */}
              <Link
                href={`/${locale}/dashboard/admin/courses/${courseId}`}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-4"
              >
                {isRTL ? (
                  <ArrowRight className="w-4 h-4" />
                ) : (
                  <ArrowLeft className="w-4 h-4" />
                )}
                {t("backToCourse")}
              </Link>

              {/* Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {assessment ? pickLocaleTitle(assessment.title, assessment.titleAr, locale) : t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("subtitle")}
                </p>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <CountCard label={t("counts.total")} value={counts.total} />
                <CountCard
                  label={t("counts.graded")}
                  value={counts.graded}
                  color="text-[#16A34A]"
                />
                <CountCard
                  label={t("counts.pending")}
                  value={counts.pending}
                  color="text-[#D97706]"
                />
                <CountCard
                  label={t("counts.inProgress")}
                  value={counts.inProgress}
                  color="text-[var(--color-text-secondary)]"
                />
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row gap-3">
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
                  <Select
                    value={statusFilter}
                    onChange={(v) => setStatusFilter(v as "all" | Status)}
                    size="sm"
                    className="min-w-[160px]"
                    options={[
                      { value: "all", label: t("filters.all") },
                      { value: "graded", label: t("statuses.graded") },
                      { value: "submitted", label: t("statuses.submitted") },
                      { value: "in_progress", label: t("statuses.inProgress") },
                    ]}
                  />
                </div>

                {/* Table */}
                {loading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                  </div>
                )}

                {!loading && filtered.length === 0 && (
                  <div className="py-16 text-center">
                    <FileText className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("empty")}
                    </p>
                  </div>
                )}

                {!loading && filtered.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-surface-page)] text-xs uppercase text-[var(--color-text-secondary)]">
                        <tr>
                          <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                            {t("table.student")}
                          </th>
                          <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                            {t("table.status")}
                          </th>
                          <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                            {t("table.score")}
                          </th>
                          <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                            {t("table.submittedAt")}
                          </th>
                          <th className={`px-5 py-3 ${isRTL ? "text-right" : "text-left"}`}>
                            {t("table.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {filtered.map((s) => {
                          const studentName =
                            `${s.studentFirstName || ""} ${s.studentLastName || ""}`.trim() ||
                            s.studentEmail;
                          const isGraded = s.status === "graded";
                          const total = s.totalMarks ?? assessment?.totalMarks ?? 0;
                          // Prefer the sum of per-answer marksAwarded (same
                          // source the SubmissionDetailDrawer uses) — the
                          // submissions.score column has been observed to
                          // fall out of sync with the per-answer marks on
                          // some legacy rows, so trust the per-answer sum
                          // when available.
                          const answerSum = Array.isArray(s.answers)
                            ? s.answers.reduce(
                                (sum, a) => sum + (a?.marksAwarded ?? 0),
                                0,
                              )
                            : null;
                          const scored = answerSum ?? s.score ?? 0;
                          const pct = total > 0 ? Math.round((scored / total) * 100) : 0;
                          return (
                            <tr
                              key={s.id}
                              onClick={() => setOpenSubmissionId(s.id)}
                              className="cursor-pointer hover:bg-[var(--color-border-subtle)] transition-colors"
                            >
                              <td className="px-5 py-3">
                                <p className="font-medium text-[var(--color-text-primary)] line-clamp-1">
                                  {studentName}
                                </p>
                                <p className="text-xs text-[var(--color-text-secondary)]">
                                  {s.studentEmail}
                                </p>
                              </td>
                              <td className="px-5 py-3">
                                <StatusBadge status={s.status} />
                              </td>
                              <td className="px-5 py-3">
                                {isGraded ? (
                                  <span
                                    className={`font-semibold ${
                                      pct >= 80
                                        ? "text-[#16A34A]"
                                        : pct >= 60
                                          ? "text-[#D97706]"
                                          : "text-[#DC2626]"
                                    }`}
                                  >
                                    {scored} / {total}
                                    <span className="text-xs font-normal text-[var(--color-text-secondary)] ms-1">
                                      ({pct}%)
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-[var(--color-text-secondary)]">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-[var(--color-text-secondary)]">
                                {fmtDate(s.submittedAt)}
                              </td>
                              <td className="px-5 py-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenSubmissionId(s.id);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] px-2 py-1 rounded"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  {t("view")}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SubmissionDetailDrawer
        open={openSubmissionId !== null}
        onClose={() => setOpenSubmissionId(null)}
        submission={openSubmission}
        assessment={assessment}
      />
    </>
  );
}

function CountCard({
  label,
  value,
  color = "text-[var(--color-text-primary)]",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
