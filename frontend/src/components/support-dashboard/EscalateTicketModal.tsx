"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";

interface Props {
  ticketId: string;
  ticketReference: string;
  currentPriority: string;
  alreadyEscalated: boolean;
  onClose: () => void;
  onEscalated: () => void;
}

type PriorityBump = "" | "medium" | "high";

export default function EscalateTicketModal({
  ticketId,
  ticketReference,
  currentPriority,
  alreadyEscalated,
  onClose,
  onEscalated,
}: Props) {
  const t = useTranslations("supportDashboard.ticketDetail.escalate");
  const [reason, setReason] = useState("");
  const [bumpPriority, setBumpPriority] = useState<PriorityBump>("");
  const [submitting, setSubmitting] = useState(false);

  const canBumpMedium = currentPriority === "low";
  const canBumpHigh = currentPriority !== "high";

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error(t("validation.reasonTooShort"));
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.escalateTicket(ticketId, {
        reason: trimmed,
        bumpPriority: bumpPriority || undefined,
      });
      toast.success(
        alreadyEscalated ? t("toasts.updated") : t("toasts.escalated"),
      );
      onEscalated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("toasts.failed");
      toast.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escalate-ticket-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 flex-shrink-0 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <h2
                id="escalate-ticket-title"
                className="text-base font-semibold text-slate-900"
              >
                {alreadyEscalated ? t("titleUpdate") : t("title")}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {ticketReference}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            aria-label={t("dismissAria")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            {alreadyEscalated ? t("bodyUpdate") : t("body")}
          </p>

          <div>
            <label
              htmlFor="escalate-reason"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              {t("reasonLabel")} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="escalate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
              maxLength={500}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-slate-400 resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              {reason.length}/500
            </p>
          </div>

          {(canBumpMedium || canBumpHigh) && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t("bumpLabel")}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBumpPriority("")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    bumpPriority === ""
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {t("bumpKeep", { current: currentPriority.toUpperCase() })}
                </button>
                {canBumpMedium && (
                  <button
                    type="button"
                    onClick={() => setBumpPriority("medium")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      bumpPriority === "medium"
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {t("bumpMedium")}
                  </button>
                )}
                {canBumpHigh && (
                  <button
                    type="button"
                    onClick={() => setBumpPriority("high")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      bumpPriority === "high"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {t("bumpHigh")}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {alreadyEscalated ? t("submitUpdate") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
