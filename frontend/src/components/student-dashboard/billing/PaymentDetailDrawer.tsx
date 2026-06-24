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
} from "./billingHelpers";
import StudentRefundRequestModal from "./StudentRefundRequestModal";

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
const PaymentDetailDrawer = ({ paymentId, onClose, policy }: Props) => {
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

  if (!paymentId) return null;

  const handleDownloadInvoice = async (invoiceId: string) => {
    setDownloadingPdf(true);
    try {
      const res = await invoiceApi.getPdfUrl(invoiceId);
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
            aria-label="Close"
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
              policy={policy}
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
        />
      )}
    </>
  );
};

export default PaymentDetailDrawer;

function DrawerBody({
  data,
  policy,
  locale,
  t,
  onDownloadInvoice,
  downloadingPdf,
  onRequestRefund,
}: {
  data: StudentPaymentDetailResponse;
  policy: StudentFinancePolicySnapshot | null;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onDownloadInvoice: (invoiceId: string) => Promise<void>;
  downloadingPdf: boolean;
  onRequestRefund: () => void;
}) {
  const { payment, refunds, refundability } = data;
  const courseTitle = pickCourseTitle(
    payment.courseTitle,
    payment.courseTitleAr,
    locale,
  );

  return (
    <>
      {/* Status + amount */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusPillClasses(payment.status)}`}
          >
            {t(`status.${payment.status}` as never)}
          </span>
          <span className="text-xs text-[#6B7280]">
            {formatDateTime(payment.paidAt ?? payment.createdAt, locale)}
          </span>
        </div>
        <div className="text-2xl font-bold text-[#1F2937] tabular-nums">
          {formatSar(payment.amount)} {t("common.sar")}
        </div>
        <div className="text-sm text-[#6B7280] mt-1">{courseTitle}</div>
      </div>

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
            view, not the public marketing page. */}
        {payment.courseId && (
          <a
            href={`/${locale}/dashboard/student/courses/${payment.courseId}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            {t("drawer.viewCourse")}
          </a>
        )}
      </section>

      {/* Refund eligibility / action */}
      <section className="border border-[#E5E7EB] rounded-lg p-3">
        {refundability.canRequest ? (
          <>
            <p className="text-xs text-[#6B7280] mb-2">
              {refundability.partialAllowed
                ? t("policy.partialAllowed")
                : t("policy.partialNotAllowed")}
            </p>
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
              {refundability.reason ?? t("drawer.refundIneligible")}
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
                    {t(`status.${r.status}` as never)}
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

      {policy?.activeGateways && (
        <p className="text-[11px] text-[#9CA3AF] text-center pt-2">
          {t("policy.merchantDeductionNote")}
        </p>
      )}
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
