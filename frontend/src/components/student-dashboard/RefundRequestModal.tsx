"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { refundApi } from "@/lib/api";

interface RefundRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
  invoiceNumber: string;
  amount: number;
  onSuccess?: () => void;
}

const REASONS = [
  "course_issue",
  "personal",
  "technical",
  "duplicate",
  "other",
] as const;

const RefundRequestModal = ({
  isOpen,
  onClose,
  paymentId,
  invoiceNumber,
  amount,
  onSuccess,
}: RefundRequestModalProps) => {
  const t = useTranslations("studentDashboard");
  const [reason, setReason] = useState<string>("");
  const [reasonNote, setReasonNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason) {
      setError(t("refund.selectReason"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await refundApi.request({
        paymentId,
        reason,
        reasonNote: reasonNote || undefined,
      });
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("refund.submitError")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setReasonNote("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#1F2937]">
            {t("refund.title")}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] transition"
          >
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">&#9989;</span>
              </div>
              <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                {t("refund.successTitle")}
              </h3>
              <p className="text-sm text-[#6B7280]">
                {t("refund.successMessage")}
              </p>
              <button
                onClick={handleClose}
                className="mt-4 px-6 py-2.5 btn-gold text-white rounded-lg font-medium"
              >
                {t("refund.close")}
              </button>
            </div>
          ) : (
            <>
              {/* Invoice Info */}
              <div className="bg-[#F9FAFB] rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">{t("refund.invoice")}</span>
                  <span className="font-medium text-[#1F2937]">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-[#6B7280]">{t("refund.amount")}</span>
                  <span className="font-medium text-[#1F2937]">SAR {amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Reason Selection */}
              <label className="block text-sm font-medium text-[#374151] mb-2">
                {t("refund.reasonLabel")}
              </label>
              <div className="space-y-2 mb-4">
                {REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                      reason === r
                        ? "border-[#a37f49] bg-[#FFFBF0]"
                        : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-4 h-4 text-[#a37f49] accent-[#a37f49]"
                    />
                    <span className="text-sm text-[#374151]">
                      {t(`refund.reasons.${r}`)}
                    </span>
                  </label>
                ))}
              </div>

              {/* Additional Notes */}
              <label className="block text-sm font-medium text-[#374151] mb-2">
                {t("refund.notesLabel")}
              </label>
              <textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                rows={3}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#a37f49] resize-none"
                placeholder={t("refund.notesPlaceholder")}
              />

              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex gap-3 px-6 py-4 border-t border-[#E5E7EB]">
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition"
            >
              {t("refund.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !reason}
              className="flex-1 py-2.5 text-sm font-medium text-white btn-gold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("refund.submit")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefundRequestModal;
