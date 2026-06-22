"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  Search,
  X,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  FileText,
  BookOpen,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Banknote,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { refundApi } from "@/lib/api";
import Money from "./shared/Money";
import Select from "@/components/admin-dashboard/Select";

interface InitiateRefundModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (refundId: string) => void;
}

type RefundablePayment = Awaited<
  ReturnType<typeof refundApi.listRefundablePayments>
>[number];
type RefundPreview = Awaited<ReturnType<typeof refundApi.getPreview>>;

const REASONS = ["policy", "cancelled", "duplicate", "technical", "other"] as const;

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleString(lng, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleDateString(lng, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const InitiateRefundModal = ({
  open,
  onClose,
  onCreated,
}: InitiateRefundModalProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const NextIcon = isRTL ? ArrowLeft : ArrowRight;
  const PrevIcon = isRTL ? ArrowRight : ArrowLeft;

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — picker
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<RefundablePayment[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Step 2 — preview
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [customAmountError, setCustomAmountError] = useState<string | null>(null);

  // Step 3 — reason
  const [reason, setReason] = useState<(typeof REASONS)[number]>("policy");
  const [note, setNote] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const previewDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPaymentIdRef = useRef<string | null>(null);

  const fetchPayments = useCallback(async (q: string) => {
    setSearchLoading(true);
    try {
      const list = await refundApi.listRefundablePayments(q || undefined, 25);
      setPayments(list);
    } catch {
      setPayments([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSearch("");
    setPayments([]);
    setPreview(null);
    setPreviewError(null);
    setReason("policy");
    setNote("");
    setJustification("");
    setCustomAmount("");
    setCustomAmountError(null);
    lastPaymentIdRef.current = null;
    fetchPayments("");
  }, [open, fetchPayments]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchPayments(v), 300);
  };

  const fetchPreview = useCallback(
    async (paymentId: string, amount?: number) => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await refundApi.getPreview(paymentId, amount);
        setPreview(res);
      } catch (e: any) {
        setPreviewError(
          e?.message || t("refundsPage.initiateModal.preview.error"),
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [t],
  );

  const handlePick = async (p: RefundablePayment) => {
    lastPaymentIdRef.current = p.id;
    setCustomAmount("");
    setCustomAmountError(null);
    setStep(2);
    await fetchPreview(p.id);
  };

  /**
   * Debounced refetch when the operator edits the partial-refund amount.
   * Skips refetch if value is empty (treated as "full refund" — use preview
   * as-is) or invalid.
   */
  const handleCustomAmountChange = (raw: string) => {
    setCustomAmount(raw);

    if (!preview) return;
    if (previewDebounce.current) clearTimeout(previewDebounce.current);

    if (!raw.trim()) {
      setCustomAmountError(null);
      // Refetch full preview
      previewDebounce.current = setTimeout(() => {
        if (lastPaymentIdRef.current)
          fetchPreview(lastPaymentIdRef.current);
      }, 350);
      return;
    }

    const n = Number(raw);
    if (Number.isNaN(n) || n <= 0) {
      setCustomAmountError(t("refundsPage.toasts.genericError"));
      return;
    }
    if (n > preview.capabilities.maxRefundAmount) {
      setCustomAmountError(
        `Max ${preview.capabilities.maxRefundAmount}`,
      );
      return;
    }
    setCustomAmountError(null);
    previewDebounce.current = setTimeout(() => {
      if (lastPaymentIdRef.current) fetchPreview(lastPaymentIdRef.current, n);
    }, 350);
  };

  const handleSubmit = async () => {
    if (!preview) return;
    // If a custom partial amount is being requested, pass it through.
    // The breakdown preview was already refetched with this same amount
    // so what the operator saw is what gets created.
    const partialAmount =
      preview.capabilities.supportsPartial && preview.breakdown.isPartial
        ? preview.breakdown.refundAmount
        : undefined;
    setSubmitting(true);
    try {
      const res = await refundApi.adminInitiate({
        paymentId: preview.payment.id,
        reason,
        reasonNote: note || undefined,
        justification: justification || undefined,
        refundAmount: partialAmount,
      });
      toast.success(t("refundsPage.initiateModal.successToast"));
      onCreated?.(res?.id);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || t("refundsPage.toasts.genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const reasonOptions = REASONS.map((r) => ({
    value: r,
    label: t(`refundsPage.reasonLabels.${r}` as any),
  }));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("refundsPage.initiateModal.title")}
            </h3>
            <Stepper step={step} t={t} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <PickerStep
              search={search}
              onSearchChange={handleSearchChange}
              payments={payments}
              loading={searchLoading}
              onPick={handlePick}
              t={t}
              locale={locale}
            />
          )}

          {step === 2 && (
            <PreviewStep
              preview={preview}
              loading={previewLoading}
              error={previewError}
              locale={locale}
              t={t}
              customAmount={customAmount}
              customAmountError={customAmountError}
              onCustomAmountChange={handleCustomAmountChange}
            />
          )}

          {step === 3 && preview && (
            <ReasonStep
              reason={reason}
              setReason={setReason}
              reasonOptions={reasonOptions}
              note={note}
              setNote={setNote}
              justification={justification}
              setJustification={setJustification}
              preview={preview}
              t={t}
              locale={locale}
            />
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between gap-2 px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-page)] ${isRTL ? "flex-row-reverse" : ""}`}>
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1) as any)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-card)] rounded-lg transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <PrevIcon className="w-4 h-4" />
                {t("refundsPage.initiateModal.back")}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-card)] transition-colors"
            >
              {t("refundsPage.rejectModal.cancel")}
            </button>
            {step === 2 && preview && !previewLoading && !previewError && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition-opacity ${isRTL ? "flex-row-reverse" : ""}`}
              >
                {t("refundsPage.initiateModal.next")}
                <NextIcon className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                {t("refundsPage.initiateModal.confirm")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function Stepper({
  step,
  t,
}: {
  step: 1 | 2 | 3;
  t: ReturnType<typeof useTranslations>;
}) {
  const labels = [
    t("refundsPage.initiateModal.step1Title"),
    t("refundsPage.initiateModal.step2Title"),
    t("refundsPage.initiateModal.step3Title"),
  ];
  return (
    <div className="flex items-center gap-2 mt-1">
      {labels.map((label, idx) => {
        const n = (idx + 1) as 1 | 2 | 3;
        const active = step === n;
        const done = step > n;
        return (
          <div key={n} className="flex items-center gap-1.5">
            <span
              className={`text-[11px] inline-flex items-center justify-center w-5 h-5 rounded-full ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : done
                    ? "bg-[#DCFCE7] text-[#15803D]"
                    : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]"
              }`}
            >
              {done ? <CheckCircle2 className="w-3 h-3" /> : n}
            </span>
            <span
              className={`text-[11px] ${
                active
                  ? "text-[var(--color-text-primary)] font-medium"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PickerStep({
  search,
  onSearchChange,
  payments,
  loading,
  onPick,
  t,
  locale,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  payments: RefundablePayment[];
  loading: boolean;
  onPick: (p: RefundablePayment) => void;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        {t("refundsPage.initiateModal.description")}
      </p>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("refundsPage.initiateModal.searchPlaceholder")}
          className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
          autoFocus
        />
      </div>

      <div className="border border-[var(--color-border-subtle)] rounded-lg divide-y divide-[var(--color-border-subtle)] max-h-[55vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-center text-[var(--color-text-secondary)] py-8">
            {t("refundsPage.initiateModal.noPayments")}
          </p>
        ) : (
          payments.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface-page)] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {p.userName}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                    {p.userEmail} · {p.courseTitle}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] opacity-75 mt-0.5">
                    {formatDate(p.paidAt, locale)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Money
                    amount={Number(p.amount || 0)}
                    className="text-sm font-semibold text-[var(--color-text-primary)]"
                    iconSize={12}
                  />
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mt-0.5">
                    {p.gateway}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PreviewStep({
  preview,
  loading,
  error,
  locale,
  t,
  customAmount,
  customAmountError,
  onCustomAmountChange,
}: {
  preview: RefundPreview | null;
  loading: boolean;
  error: string | null;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  customAmount: string;
  customAmountError: string | null;
  onCustomAmountChange: (v: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
        <p className="text-xs text-[var(--color-text-secondary)] mt-2">
          {t("refundsPage.initiateModal.preview.loading")}
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
        <p className="text-sm text-[#B91C1C] mt-2 text-center">{error}</p>
      </div>
    );
  }
  if (!preview) return null;

  return (
    <div className="space-y-4">
      {/* Invoice + Buyer + Course + Enrollment */}
      <div className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-xl p-4 space-y-2">
        <Row
          icon={<FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />}
          label={t("refundsPage.initiateModal.preview.invoice")}
          value={
            preview.invoice ? (
              <Link
                href={`/${locale}/dashboard/finance/invoices?invoiceId=${preview.invoice.id}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                {preview.invoice.invoiceNumber}
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <span className="text-sm text-[var(--color-text-secondary)]">—</span>
            )
          }
        />
        {preview.invoice && (
          <>
            <Row
              label={t("refundsPage.initiateModal.preview.issuedOn")}
              value={
                <span className="text-[12px] text-[var(--color-text-primary)]">
                  {formatDateTime(preview.invoice.issuedAt, locale)}
                </span>
              }
            />
            <Row
              label={t("refundsPage.initiateModal.preview.paidOn")}
              value={
                <span className="text-[12px] text-[var(--color-text-primary)]">
                  {formatDateTime(
                    preview.invoice.paidAt || preview.payment.paidAt,
                    locale,
                  )}
                </span>
              }
            />
          </>
        )}
        <Row
          icon={<UserIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />}
          label={t("refundsPage.initiateModal.preview.buyer")}
          value={
            <div className="text-right">
              <p className="text-sm text-[var(--color-text-primary)] font-medium">
                {preview.buyer?.name || "—"}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {preview.buyer?.email || "—"}
              </p>
            </div>
          }
        />
        <Row
          icon={<BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />}
          label={t("refundsPage.initiateModal.preview.course")}
          value={
            <span className="text-sm text-[var(--color-text-primary)]">
              {locale === "ar"
                ? preview.course?.titleAr || preview.course?.title || "—"
                : preview.course?.title || "—"}
            </span>
          }
        />
        {preview.enrollment && (
          <>
            <Row
              label={t("refundsPage.initiateModal.preview.enrolledOn")}
              value={
                <span className="text-[12px] text-[var(--color-text-primary)]">
                  {formatDate(preview.enrollment.enrolledAt, locale)}
                </span>
              }
            />
            <Row
              label={t("refundsPage.initiateModal.preview.enrollmentStatus")}
              value={
                <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5">
                  {preview.enrollment.status}
                </span>
              }
            />
          </>
        )}
        <Row
          icon={<CreditCard className="w-4 h-4 text-[var(--color-text-secondary)]" />}
          label={t("refundsPage.initiateModal.preview.gateway")}
          value={
            <span className="text-sm text-[var(--color-text-primary)] uppercase">
              {preview.payment.gateway}
            </span>
          }
        />
        {preview.payment.paymentMethod && (
          <Row
            label={t("refundsPage.initiateModal.preview.method")}
            value={
              <span className="text-sm text-[var(--color-text-primary)]">
                {preview.payment.paymentMethod}
              </span>
            }
          />
        )}
        {preview.payment.gatewayChargeId && (
          <Row
            label={t("refundsPage.initiateModal.preview.chargeId")}
            value={
              <span className="text-[11px] font-mono text-[var(--color-text-primary)] break-all max-w-[240px] text-right">
                {preview.payment.gatewayChargeId}
              </span>
            }
          />
        )}
      </div>

      {/* Partial refund amount input */}
      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold">
            {t("refundsPage.initiateModal.preview.partialTitle")}
          </h4>
          {preview.breakdown.isPartial && (
            <span className="text-[10px] uppercase tracking-wide bg-[#EDE9FE] text-[#6D28D9] rounded px-1.5 py-0.5 font-medium">
              {t("refundsPage.initiateModal.preview.partialBadge")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={preview.capabilities.minRefundAmount}
            max={preview.capabilities.maxRefundAmount}
            step="0.01"
            value={customAmount}
            onChange={(e) => onCustomAmountChange(e.target.value)}
            disabled={!preview.capabilities.supportsPartial}
            placeholder={String(preview.breakdown.originalAmount)}
            className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none ${
              customAmountError
                ? "border-[#DC2626] focus:border-[#DC2626]"
                : "border-[var(--color-border)] focus:border-[var(--color-primary)]"
            } ${
              !preview.capabilities.supportsPartial
                ? "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] cursor-not-allowed"
                : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)]"
            }`}
          />
          <span className="text-[12px] text-[var(--color-text-secondary)]">
            / {preview.capabilities.maxRefundAmount.toLocaleString("en-US")} SAR
          </span>
        </div>
        {customAmountError && (
          <p className="text-[11px] text-[#DC2626] mt-1">{customAmountError}</p>
        )}
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
          {preview.capabilities.supportsPartial
            ? t("refundsPage.initiateModal.preview.partialHelpPartial")
            : t("refundsPage.initiateModal.preview.partialHelpFull")}
        </p>
      </div>

      {/* Refund breakdown */}
      <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
        <h4 className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-3">
          {t("refundsPage.initiateModal.preview.breakdownTitle")}
        </h4>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-[var(--color-text-secondary)]">
              {t("refundsPage.initiateModal.preview.originalAmount")}
            </span>
            <Money
              amount={preview.breakdown.originalAmount}
              className="text-[var(--color-text-primary)]"
              iconSize={12}
            />
          </div>
          <div className="flex items-baseline justify-between border-t border-[var(--color-border-subtle)] pt-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("refundsPage.initiateModal.preview.learnerReceives")}
            </span>
            <Money
              amount={preview.breakdown.refundAmount}
              className="text-base font-bold text-[#15803D]"
              iconSize={14}
            />
          </div>
          {preview.breakdown.merchantFeeAmount > 0 && (
            <div className="border-t border-[var(--color-border-subtle)] pt-2">
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-[#92400E]">
                  {t("refundsPage.initiateModal.preview.deduction")}
                </span>
                <Money
                  amount={preview.breakdown.merchantFeeAmount}
                  className="text-[#92400E]"
                  iconSize={11}
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                {preview.breakdown.merchantFeeReason ||
                  t("refundsPage.initiateModal.preview.deductionNote")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Destination */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3">
        <h4 className="text-[11px] uppercase tracking-wide text-[#1D4ED8] font-semibold mb-1 flex items-center gap-1.5">
          <Banknote className="w-3 h-3" />
          {t("refundsPage.initiateModal.preview.destinationTitle")}
        </h4>
        <p className="text-[12px] text-[#1E3A8A]">
          {preview.refundDestination.label}
        </p>
      </div>

      {/* Consequences warning */}
      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3">
        <h4 className="text-[11px] uppercase tracking-wide text-[#92400E] font-semibold mb-1 flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          {t("refundsPage.initiateModal.preview.consequencesTitle")}
        </h4>
        <ul className="space-y-1 text-[12px] text-[#92400E]">
          {preview.consequences.dropsEnrollment && (
            <li>· {t("refundsPage.initiateModal.preview.consequenceDropsEnrollment")}</li>
          )}
          {preview.consequences.revokesCertificate && (
            <li>· {t("refundsPage.initiateModal.preview.consequenceCertRevoked")}</li>
          )}
          {preview.consequences.cancelsFutureWebinarRegistrations && (
            <li>· {t("refundsPage.initiateModal.preview.consequenceWebinarCancelled")}</li>
          )}
          {preview.consequences.reversesDiscount && (
            <li>· {t("refundsPage.initiateModal.preview.consequenceReversesDiscount")}</li>
          )}
          <li>· {t("refundsPage.initiateModal.preview.consequenceNotifyEmail")}</li>
        </ul>
      </div>
    </div>
  );
}

function ReasonStep({
  reason,
  setReason,
  reasonOptions,
  note,
  setNote,
  justification,
  setJustification,
  preview,
  t,
  locale,
}: {
  reason: (typeof REASONS)[number];
  setReason: (v: (typeof REASONS)[number]) => void;
  reasonOptions: { value: string; label: string }[];
  note: string;
  setNote: (v: string) => void;
  justification: string;
  setJustification: (v: string) => void;
  preview: RefundPreview;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  return (
    <div className="space-y-4">
      {/* Compact recap pill */}
      <div className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-lg p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {preview.buyer?.name}
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
            {locale === "ar"
              ? preview.course?.titleAr || preview.course?.title
              : preview.course?.title}
          </p>
        </div>
        <Money
          amount={preview.breakdown.refundAmount}
          className="text-sm font-semibold text-[var(--color-text-primary)]"
          iconSize={12}
        />
      </div>

      <div>
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
          {t("refundsPage.initiateModal.reasonLabel")}
        </label>
        <Select
          options={reasonOptions}
          value={reason}
          onChange={(v) => setReason(v as (typeof REASONS)[number])}
          size="default"
        />
      </div>

      <div>
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
          {t("refundsPage.initiateModal.noteLabel")}
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      <div>
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
          {t("refundsPage.initiateModal.justificationLabel")}
        </label>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder={t("refundsPage.initiateModal.justificationPlaceholder")}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] resize-none"
        />
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

export default InitiateRefundModal;
