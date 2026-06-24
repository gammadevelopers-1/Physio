"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { refundApi } from "@/lib/api";
import { formatSar, pickCourseTitle } from "./billingHelpers";

/**
 * Student-initiated refund request. Two screens:
 *   1. FORM       — reason picker + optional note + gateway-specific hint
 *   2. CONFIRM    — math summary (you'll receive X, processed when, refunded to ...)
 * After submit → success state, then closes and tells the parent to
 * refetch detail so the new pending refund shows in the history.
 *
 * Student requests are ALWAYS full refunds — partial is admin-only. The
 * backend re-validates eligibility on POST so we can't game the gates
 * client-side.
 */

type Gateway = "moyasar" | "tamara" | "tabby" | "bank_transfer" | "mock";

// Backend's CreateRefundDto accepts exactly these values.
const REASON_KEYS = [
  "policy",
  "cancelled",
  "technical",
  "duplicate",
  "other",
] as const;

type ReasonKey = (typeof REASON_KEYS)[number];

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payment: {
    id: string;
    amount: string;
    gateway: string;
    courseTitle: string | null;
    courseTitleAr: string | null;
    invoiceNumber: string | null;
  };
};

type Step = "form" | "confirm" | "success";

const StudentRefundRequestModal = ({
  open,
  onClose,
  onSuccess,
  payment,
}: Props) => {
  const t = useTranslations("studentDashboard.billing.refundModal");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [step, setStep] = useState<Step>("form");
  const [reason, setReason] = useState<ReasonKey | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const courseTitle = pickCourseTitle(
    payment.courseTitle,
    payment.courseTitleAr,
    locale,
  );
  const amountNum = Number(payment.amount) || 0;
  // Customer always receives full amount; merchant fee is borne by us.
  const customerReceivesSar = amountNum;

  const resetAndClose = () => {
    setStep("form");
    setReason("");
    setNote("");
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const goNext = () => {
    if (!reason) {
      setError(t("reasonSelect"));
      return;
    }
    if (reason === "other" && note.trim().length < 3) {
      setError(t("noteRequired"));
      return;
    }
    setError(null);
    setStep("confirm");
  };

  const goBack = () => {
    setError(null);
    setStep("form");
  };

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await refundApi.request({
        paymentId: payment.id,
        reason,
        reasonNote: note.trim() || undefined,
      });
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (step === "success") {
      onSuccess();
    }
    resetAndClose();
  };

  const gatewayKey = (
    ["moyasar", "tamara", "tabby", "bank_transfer", "mock"].includes(
      payment.gateway,
    )
      ? payment.gateway
      : "moyasar"
  ) as Gateway;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden
      />
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] shrink-0">
          <div className="min-w-0">
            <h2
              id="refund-modal-title"
              className="text-base font-semibold text-[#1F2937]"
            >
              {t("title")}
            </h2>
            {step !== "success" && (
              <p className="text-xs text-[#6B7280] mt-0.5">
                {step === "form" ? t("subtitleForm") : t("subtitleConfirm")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-[#F3F4F6] shrink-0"
            aria-label={t("cancel")}
          >
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === "success" ? (
            <div className="py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#DCFCE7] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-[#16A34A]" />
              </div>
              <h3 className="text-base font-semibold text-[#1F2937] mb-1">
                {t("successTitle")}
              </h3>
              <p className="text-sm text-[#6B7280]">{t("successBody")}</p>
            </div>
          ) : (
            <>
              {/* Payment context — always shown */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 space-y-1.5 text-sm">
                {payment.invoiceNumber && (
                  <Row
                    label={t("paymentLabel")}
                    value={payment.invoiceNumber}
                  />
                )}
                <Row label={t("courseLabel")} value={courseTitle} />
                <Row
                  label={t("originalAmount")}
                  value={`${formatSar(amountNum)} ${locale === "ar" ? "ر.س" : "SAR"}`}
                />
              </div>

              {step === "form" ? (
                <>
                  <fieldset>
                    <legend className="block text-sm font-medium text-[#374151] mb-2">
                      {t("reasonLabel")}
                    </legend>
                    <div className="space-y-1.5">
                      {REASON_KEYS.map((r) => {
                        const selected = reason === r;
                        return (
                          <label
                            key={r}
                            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition ${
                              selected
                                ? "border-[var(--color-primary)] bg-[#FFFBF0]"
                                : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                            }`}
                          >
                            <input
                              type="radio"
                              name="refund-reason"
                              value={r}
                              checked={selected}
                              onChange={() => {
                                setReason(r);
                                setError(null);
                              }}
                              className="mt-0.5 accent-[var(--color-primary)]"
                            />
                            <span className="text-sm text-[#374151]">
                              {t(`reasons.${r}`)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div>
                    <label
                      htmlFor="refund-note"
                      className="block text-sm font-medium text-[#374151] mb-2"
                    >
                      {reason === "other"
                        ? t("noteRequiredLabel")
                        : t("noteLabel")}
                    </label>
                    <textarea
                      id="refund-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder={t("notePlaceholder")}
                      className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
                    />
                  </div>
                </>
              ) : (
                /* Confirm step */
                <>
                  <section className="border border-[#E5E7EB] rounded-lg p-3 space-y-1.5 text-sm">
                    <Row
                      label={t("reasonLabel")}
                      value={reason ? t(`reasons.${reason}`) : ""}
                    />
                    {note.trim() && (
                      <Row
                        label={t("noteLabel")}
                        value={
                          <span className="text-[#6B7280] whitespace-pre-wrap">
                            {note}
                          </span>
                        }
                      />
                    )}
                  </section>

                  <section className="border border-[#E5E7EB] rounded-lg p-3 space-y-1.5 text-sm">
                    <Row
                      label={t("youReceive")}
                      value={`${formatSar(customerReceivesSar)} ${locale === "ar" ? "ر.س" : "SAR"}`}
                      bold
                    />
                  </section>

                  <p className="text-xs text-[#6B7280] flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {t("fullRefundNote")}
                      <br />
                      {t(`gatewayHints.${gatewayKey}`)}
                    </span>
                  </p>
                </>
              )}

              {error && (
                <p className="text-sm text-[#DC2626] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-[#E5E7EB] flex gap-2 shrink-0">
          {step === "success" ? (
            <button
              type="button"
              onClick={handleClose}
              className="ms-auto px-5 py-2.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90"
            >
              {t("successClose")}
            </button>
          ) : step === "form" ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!reason}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50 hover:opacity-90"
              >
                {t("next")}
                {isRTL ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50"
              >
                {isRTL ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
                {t("back")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50 hover:opacity-90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  t("submit")
                )}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

export default StudentRefundRequestModal;

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-[#6B7280] shrink-0">{label}</span>
      <span
        className={`text-sm text-end text-[#1F2937] tabular-nums ${bold ? "font-semibold" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
