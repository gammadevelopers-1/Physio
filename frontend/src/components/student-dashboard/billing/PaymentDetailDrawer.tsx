"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  X,
  Loader2,
  ExternalLink,
  Download,
  Info,
  AlertCircle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  studentFinanceApi,
  invoiceApi,
  type StudentPaymentDetailResponse,
  type StudentFinancePolicySnapshot,
} from "@/lib/api";
import {
  formatSar,
  formatDateTime,
  pickCourseTitle,
  statusPillClasses,
  statusLabel,
  resolvePaymentStatusChip,
} from "./billingHelpers";
import StudentRefundRequestModal from "./StudentRefundRequestModal";
import InvoiceLanguageDialog from "@/components/ui/InvoiceLanguageDialog";
import { useInvoiceLanguage } from "@/hooks/useInvoiceLanguage";

type Props = {
  paymentId: string | null;
  onClose: () => void;
  policy: StudentFinancePolicySnapshot | null;
};

/**
 * Slide-over drawer for one payment. Phase 2 scope: render the data
 * (status, VAT breakdown, refund history, eligibility copy). The
 * "Request refund" action is rendered but disabled with a TODO marker —
 * the actual refund modal lands in Phase 3.
 */
const PaymentDetailDrawer = ({ paymentId, onClose, policy: _policy }: Props) => {
  // `policy` is retained on the public prop shape (callers still pass it)
  // but the drawer no longer needs to render partial-refund copy — the
  // modal itself surfaces the actual policy at request time. Underscore
  // prefix silences the unused-var hint without breaking the API.
  const locale = useLocale();
  const t = useTranslations("studentDashboard.billing");
  const isRTL = locale === "ar";

  const [data, setData] = useState<StudentPaymentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  // Bumped after a successful refund submit to force a refetch.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!paymentId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    studentFinanceApi
      .getPaymentDetail(paymentId)
      .then((res) => {
        if (!cancelled) setData(res);
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
  }, [paymentId, t, refreshTick]);

  // Close on Escape
  useEffect(() => {
    if (!paymentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paymentId, onClose]);

  // MUST stay above the early-return below — hooks cannot be conditional.
  const { dialogProps: langDialogProps, promptForLocale } = useInvoiceLanguage();

  if (!paymentId) return null;

  const handleDownloadInvoice = async (invoiceId: string) => {
    const chosen = await promptForLocale();
    if (!chosen) return;
    setDownloadingPdf(true);
    try {
      const res = await invoiceApi.getPdfUrl(invoiceId, chosen);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        toast.info(t("common.loadFailed"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[70]"
        onClick={onClose}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        className={`fixed top-0 ${isRTL ? "left-0" : "right-0"} h-full w-full max-w-md bg-white shadow-xl z-[71] flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-drawer-title"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <header className="flex items-center justify-between p-4 border-b border-[#E5E7EB] shrink-0">
          <h2
            id="payment-drawer-title"
            className="text-base font-semibold text-[#1F2937]"
          >
            {t("drawer.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#F3F4F6]"
            aria-label={t("drawer.close")}
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : error ? (
            <div className="text-center text-sm text-[#DC2626] py-10">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              {error}
            </div>
          ) : data ? (
            <DrawerBody
              data={data}
              locale={locale}
              t={t}
              onDownloadInvoice={handleDownloadInvoice}
              downloadingPdf={downloadingPdf}
              onRequestRefund={() => setRefundModalOpen(true)}
            />
          ) : null}
        </div>
      </aside>

      {/* Refund request modal — only mounted when the user clicks the
          button to keep the form state fresh per attempt. */}
      {data && (
        <StudentRefundRequestModal
          open={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          onSuccess={() => {
            // Refetch detail so the new pending refund appears in history
            // and the eligibility flag flips to "refund_in_progress".
            setRefreshTick((n) => n + 1);
          }}
          payment={{
            id: data.payment.id,
            amount: data.payment.amount,
            gateway: data.payment.gateway,
            courseTitle: data.payment.courseTitle,
            courseTitleAr: data.payment.courseTitleAr,
            invoiceNumber: data.payment.invoiceNumber,
          }}
          lineItems={data.lineItems}
        />
      )}
      <InvoiceLanguageDialog {...langDialogProps} />
    </>
  );
};

export default PaymentDetailDrawer;

function DrawerBody({
  data,
  locale,
  t,
  onDownloadInvoice,
  downloadingPdf,
  onRequestRefund,
}: {
  data: StudentPaymentDetailResponse;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onDownloadInvoice: (invoiceId: string) => Promise<void>;
  downloadingPdf: boolean;
  onRequestRefund: () => void;
}) {
  const { payment, refunds, refundability, lineItems } = data;
  const courseTitle = pickCourseTitle(
    payment.courseTitle,
    payment.courseTitleAr,
    locale,
  );
  // Cart purchases ALWAYS have at least one payment_items row (created by
  // the cart flow); single-course legacy payments get a fabricated single
  // line by the backend. We show the breakdown section whenever there's
  // more than one course OR at least one line carries a refund history.
  const showLineBreakdown =
    lineItems.length > 1 ||
    lineItems.some((l) => l.alreadyRefundedByRefundId);

  // Derive the chip from BOTH the payment.status AND the latest refund —
  // see `resolvePaymentStatusChip` for the full rationale. Without this,
  // a fresh refund request still reads "Paid" (backend deliberately keeps
  // payment.status until completion), and previously certain callers were
  // even labeling pending refunds as "Refunded".
  const chip = resolvePaymentStatusChip(payment.status, refunds);
  return (
    <>
      {/* Status + amount */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses(chip.pillKey)}`}
          >
            {t(chip.labelKey)}
          </span>
          <span className="text-xs text-[#6B7280]">
            {formatDateTime(payment.paidAt ?? payment.createdAt, locale)}
          </span>
        </div>
        <div className="text-2xl font-bold text-[#1F2937] tabular-nums">
          {formatSar(payment.amount)} {t("common.sar")}
        </div>
        <div className="text-sm text-[#6B7280] mt-1">
          {lineItems.length > 1
            ? t("drawer.multiCourseSummary", { count: lineItems.length })
            : courseTitle}
        </div>
      </div>

      {/* Per-course line items — only for cart purchases or after at least
          one course has been refunded. Single-course payments don't need
          the redundant breakdown. */}
      {showLineBreakdown && (
        <section className="border border-[#E5E7EB] rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">
            {t("drawer.lineItemsTitle")}
          </h3>
          <ul className="space-y-2">
            {lineItems.map((li) => {
              const title = pickCourseTitle(
                li.courseTitle,
                li.courseTitleAr,
                locale,
              );
              // Backend flags a line item with `alreadyRefundedByRefundId`
              // for ANY in-flight or completed refund (so a second refund
              // can't re-select the same line). Only show the "Refunded"
              // strikethrough when the linked refund is actually COMPLETED;
              // otherwise the refund is still pending/approved/processing
              // and we mark the line as such without the finality of
              // strikethrough copy.
              const linkedRefund = li.alreadyRefundedByRefundId
                ? refunds.find((r) => r.id === li.alreadyRefundedByRefundId)
                : null;
              const isRefunded = linkedRefund?.status === "completed";
              const isRefundInProgress =
                !!linkedRefund && linkedRefund.status !== "completed";
              return (
                <li
                  key={li.paymentItemId ?? li.courseId}
                  className={`flex items-start justify-between gap-3 p-2.5 rounded-md ${
                    isRefunded || isRefundInProgress
                      ? "bg-[#F3F4F6] opacity-70"
                      : "bg-white border border-[#F3F4F6]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isRefunded
                          ? "text-[#6B7280] line-through"
                          : isRefundInProgress
                            ? "text-[#6B7280]"
                            : "text-[#1F2937]"
                      }`}
                    >
                      {title}
                    </p>
                    {isRefunded ? (
                      <p className="text-[11px] text-[#16A34A] flex items-center gap-1 mt-0.5">
                        <Check className="w-3 h-3" />
                        {t("drawer.lineRefunded")}
                      </p>
                    ) : isRefundInProgress ? (
                      <p className="text-[11px] text-[#B45309] mt-0.5">
                        {t("drawer.lineRefundInProgress")}
                      </p>
                    ) : li.enrollmentStatus ? (
                      <p className="text-[11px] text-[#6B7280] mt-0.5">
                        {enrollmentStatusLabel(li.enrollmentStatus, t)}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-end shrink-0 tabular-nums">
                    <p
                      className={`text-sm font-semibold ${
                        isRefunded || isRefundInProgress
                          ? "text-[#9CA3AF]"
                          : "text-[#1F2937]"
                      }`}
                    >
                      {formatSar(li.lineTotal)} {t("common.sar")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Tax / VAT breakdown */}
      {payment.vatBreakdown.vatSar > 0 && (
        <section className="border border-[#E5E7EB] rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">
            {t("vatBreakdown.title")}
          </h3>
          <dl className="space-y-1 text-sm">
            <Row
              label={t("vatBreakdown.subtotal")}
              value={`${formatSar(payment.vatBreakdown.subtotalSar)} ${t("common.sar")}`}
            />
            {payment.vatBreakdown.discountSar > 0 && (
              <Row
                label={t("vatBreakdown.discount")}
                value={`− ${formatSar(payment.vatBreakdown.discountSar)} ${t("common.sar")}`}
                valueClass="text-[#16A34A]"
              />
            )}
            <Row
              label={t("vatBreakdown.vat", {
                rate: payment.vatBreakdown.vatRatePct,
              })}
              value={`${formatSar(payment.vatBreakdown.vatSar)} ${t("common.sar")}`}
            />
            <div className="border-t border-[#E5E7EB] pt-1.5 mt-1.5">
              <Row
                label={t("vatBreakdown.total")}
                value={`${formatSar(payment.vatBreakdown.totalSar)} ${t("common.sar")}`}
                bold
              />
            </div>
          </dl>
        </section>
      )}

      {/* Meta block */}
      <section className="border border-[#E5E7EB] rounded-lg p-3 space-y-1 text-sm">
        {payment.invoiceNumber && (
          <Row
            label={t("drawerExtras.invoiceNumber")}
            value={
              <code className="text-xs font-mono text-[#1F2937] break-all">
                {payment.invoiceNumber}
              </code>
            }
          />
        )}
        <Row
          label={t("drawer.paymentMethod")}
          value={
            payment.paymentMethod ? t(`method.${payment.paymentMethod}` as never) : "—"
          }
        />
        <Row
          label={t("drawer.gateway")}
          value={knownGatewayLabel(payment.gateway, t)}
        />
        {payment.gatewayChargeId && (
          <Row
            label={t("drawer.transactionId")}
            value={
              <code className="text-xs font-mono text-[#6B7280] break-all">
                {payment.gatewayChargeId}
              </code>
            }
          />
        )}
      </section>

      {/* Actions */}
      <section className="flex flex-col gap-2">
        {payment.invoiceId && (
          <button
            type="button"
            onClick={() => onDownloadInvoice(payment.invoiceId as string)}
            disabled={downloadingPdf}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            {downloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {t("common.downloadInvoice")}
          </button>
        )}

        {/* Course link — deep-link into the student's enrolled course
            view, not the public marketing page. Hidden once the enrolment
            for THIS course has been dropped (full refund, per-line refund,
            or any other drop) so a refunded student cannot reach the
            workspace via the invoice drawer. Backend also 404s the
            workspace API, but hiding the button avoids a dead click. */}
        {payment.courseId && (() => {
          const line = lineItems.find((li) => li.courseId === payment.courseId);
          const courseDropped = line
            ? line.enrollmentStatus === "dropped" ||
              Boolean(line.alreadyRefundedByRefundId)
            : payment.status === "refunded" ||
              payment.status === "partially_refunded";
          if (courseDropped) return null;
          return (
            <a
              href={`/${locale}/dashboard/student/courses/${payment.courseId}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              {t("drawer.viewCourse")}
            </a>
          );
        })()}
      </section>

      {/* Refund eligibility / action */}
      <section className="border border-[#E5E7EB] rounded-lg p-3">
        {refundability.canRequest ? (
          <>
            {/* Removed on request: the "Partial refunds allowed" line and the
                "we cover the gateway processing fee" note were confusing users
                on the card. Only the CTA remains — the refund modal itself
                still surfaces the actual policy the moment they open it. */}
            <button
              type="button"
              onClick={onRequestRefund}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
            >
              {t("common.requestRefund")}
            </button>
          </>
        ) : (
          <p className="text-xs text-[#6B7280] flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              {refundBlockedLabel(refundability.blockedBy, refundability.reason, t)}
            </span>
          </p>
        )}
      </section>

      {/* Refund history */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">
          {t("drawer.refundHistory")}
        </h3>
        {refunds.length === 0 ? (
          <p className="text-xs text-[#6B7280]">{t("drawer.noRefunds")}</p>
        ) : (
          <ul className="space-y-2">
            {refunds.map((r) => (
              <li
                key={r.id}
                className="border border-[#E5E7EB] rounded-lg p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses(r.status)}`}
                  >
                    {statusLabel(r.status, t)}
                  </span>
                  <span className="text-xs text-[#6B7280] tabular-nums">
                    {formatDateTime(r.createdAt, locale)}
                  </span>
                </div>
                <div className="tabular-nums text-[#1F2937] font-medium">
                  {formatSar(r.refundAmount)} {t("common.sar")}
                </div>
                {r.rejectionNote && (
                  <p className="mt-1 text-xs text-[#DC2626]">
                    {r.rejectionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

    </>
  );
}

function Row({
  label,
  value,
  valueClass,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-[#6B7280]">{label}</dt>
      <dd
        className={`text-sm tabular-nums ${bold ? "font-semibold" : ""} ${valueClass ?? "text-[#1F2937]"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function knownGatewayLabel(
  raw: string,
  t: (k: string) => string,
): string {
  const known = new Set(["moyasar", "tamara", "tabby", "bank_transfer", "mock"]);
  return known.has(raw) ? t(`gateway.${raw}`) : raw;
}

// Backend returns `refundability.reason` as English fallback text alongside
// a machine-friendly `blockedBy` code. Prefer the localized string keyed on
// that code so Arabic users see Arabic copy; fall back to the backend's
// English `reason` for unknown codes, then to the generic ineligibility
// message. Keep in sync with student-finance.controller.ts refundBlockedBy.
const KNOWN_REFUND_BLOCKED_CODES = new Set([
  "bank_transfer_under_review",
  "not_paid",
  "already_refunded",
  "refund_in_progress",
  "refund_rejected",
]);
function refundBlockedLabel(
  blockedBy: string | null,
  reason: string | null,
  t: (k: string) => string,
): string {
  if (blockedBy && KNOWN_REFUND_BLOCKED_CODES.has(blockedBy)) {
    return t(`drawer.refundBlockedReason.${blockedBy}`);
  }
  return reason ?? t("drawer.refundIneligible");
}

// Same defensive pattern for enrollment status. Unknown statuses fall back
// to a humanized capitalisation of the raw string (existing behavior) so
// a schema change doesn't render an empty pill.
const KNOWN_ENROLLMENT_STATUSES = new Set([
  "pending_payment",
  "active",
  "completed",
  "dropped",
  "suspended",
  "expired",
]);
function enrollmentStatusLabel(
  raw: string,
  t: (k: string) => string,
): string {
  if (KNOWN_ENROLLMENT_STATUSES.has(raw)) {
    return t(`drawer.enrollmentStatus.${raw}`);
  }
  const humanized = raw.replace(/_/g, " ");
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}
