"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, FileText, MessageSquare } from "lucide-react";
import { refundApi } from "@/lib/api";
import { formatSar, formatDateTime, statusPillClasses } from "./billingHelpers";

/**
 * Lists the student's refund requests. Reuses `/refunds/my-refunds` (already
 * permission-guarded). Shows decision rationale when a refund was rejected
 * so the student knows why.
 */
type RefundRow = {
  id: string;
  paymentId: string;
  status: string;
  reason: string;
  reasonNote: string | null;
  originalAmount: string;
  refundAmount: string;
  createdAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
};

const BillingRefundsTab = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.billing");
  const tReasons = useTranslations("studentDashboard.refund.reasons");
  const isRTL = locale === "ar";

  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mount-only fetch — `loading: true` and `error: null` are initial
    // state, so the sync setState calls would be redundant (lint rule
    // react-hooks/set-state-in-effect).
    let cancelled = false;
    refundApi
      .getMyRefunds(1, 100)
      .then((res) => {
        if (cancelled) return;
        const mapped: RefundRow[] = (res.data || []).map(
          (r: Record<string, unknown>) => ({
            id: String(r.id ?? ""),
            paymentId: String(r.paymentId ?? ""),
            status: String(r.status ?? "pending"),
            reason: String(r.reason ?? "other"),
            reasonNote:
              typeof r.reasonNote === "string" ? r.reasonNote : null,
            originalAmount: String(r.originalAmount ?? r.refundAmount ?? "0"),
            refundAmount: String(r.refundAmount ?? "0"),
            createdAt: String(r.createdAt ?? ""),
            approvedAt:
              typeof r.approvedAt === "string" ? r.approvedAt : null,
            completedAt:
              typeof r.completedAt === "string" ? r.completedAt : null,
            rejectedAt:
              typeof r.rejectedAt === "string" ? r.rejectedAt : null,
            rejectionNote:
              typeof r.rejectionNote === "string" ? r.rejectionNote : null,
          }),
        );
        setRows(mapped);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : t("common.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-[#E5E7EB]">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center text-sm text-[#DC2626]">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] py-16 px-4 text-center">
          <FileText className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[#1F2937]">
            {t("refunds.emptyTitle")}
          </h3>
          <p className="text-xs text-[#6B7280] mt-1">
            {t("refunds.emptyDesc")}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const statusKey = mapRefundStatus(r.status);
            return (
              <li
                key={r.id}
                className="bg-white rounded-xl border border-[#E5E7EB] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses(statusKey)}`}
                      >
                        {labelForRefundStatus(statusKey, t)}
                      </span>
                      <span className="text-xs text-[#6B7280] tabular-nums">
                        {formatDateTime(r.createdAt, locale)}
                      </span>
                    </div>
                    <p className="text-sm text-[#1F2937] font-medium">
                      {reasonLabel(r.reason, tReasons)}
                    </p>
                    {r.reasonNote && (
                      <p className="mt-1 text-xs text-[#6B7280] flex items-start gap-1.5">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                        <span>{r.reasonNote}</span>
                      </p>
                    )}
                    {r.rejectionNote && (
                      <p className="mt-2 text-xs text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-md p-2">
                        {r.rejectionNote}
                      </p>
                    )}
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-sm font-semibold text-[#1F2937] tabular-nums">
                      {formatSar(r.refundAmount)} {t("common.sar")}
                    </div>
                    {r.completedAt && (
                      <div className="text-[11px] text-[#16A34A] mt-1">
                        {formatDateTime(r.completedAt, locale)}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default BillingRefundsTab;

function mapRefundStatus(
  raw: string,
): "pending" | "approved" | "processing" | "completed" | "rejected" | "failed" {
  if (raw === "approved") return "approved";
  if (raw === "processing") return "processing";
  if (raw === "completed") return "completed";
  if (raw === "rejected") return "rejected";
  if (raw === "failed") return "failed";
  return "pending";
}

function labelForRefundStatus(
  key:
    | "pending"
    | "approved"
    | "processing"
    | "completed"
    | "rejected"
    | "failed",
  t: (k: string) => string,
): string {
  switch (key) {
    case "approved":
      return t("status.approved");
    case "processing":
      return t("status.processing");
    case "completed":
      return t("status.completed");
    case "rejected":
      return t("status.rejected");
    case "failed":
      return t("status.failed");
    case "pending":
    default:
      return t("status.pending");
  }
}

function reasonLabel(
  raw: string,
  t: (key: string) => string,
): string {
  const known = new Set([
    "course_issue",
    "personal",
    "technical",
    "duplicate",
    "other",
  ]);
  // Backend's enum is { policy, cancelled, technical, duplicate, other };
  // student-side i18n was built around the older { course_issue, personal,
  // technical, duplicate, other } set. Map closest.
  const mapped =
    raw === "policy"
      ? "course_issue"
      : raw === "cancelled"
        ? "personal"
        : raw;
  return known.has(mapped) ? t(mapped) : raw;
}
