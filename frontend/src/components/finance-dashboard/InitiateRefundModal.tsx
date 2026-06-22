"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, Search, X, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { refundApi } from "@/lib/api";
import Money from "./shared/Money";

interface InitiateRefundModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (refundId: string) => void;
}

type Payment = Awaited<ReturnType<typeof refundApi.listRefundablePayments>>[number];

const REASONS = ["policy", "cancelled", "duplicate", "technical", "other"] as const;

const InitiateRefundModal = ({
  open,
  onClose,
  onCreated,
}: InitiateRefundModalProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();

  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("policy");
  const [note, setNote] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    setSearch("");
    setPayments([]);
    setSelected(null);
    setReason("policy");
    setNote("");
    setJustification("");
    fetchPayments("");
  }, [open, fetchPayments]);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchPayments(v), 300);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await refundApi.adminInitiate({
        paymentId: selected.id,
        reason,
        reasonNote: note || undefined,
        justification: justification || undefined,
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("refundsPage.initiateModal.title")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t("refundsPage.initiateModal.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md hover:bg-[var(--color-surface-page)] flex items-center justify-center text-[var(--color-text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t("refundsPage.initiateModal.searchPlaceholder")}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                  autoFocus
                />
              </div>

              <div className="max-h-80 overflow-y-auto border border-[var(--color-border-subtle)] rounded-lg divide-y divide-[var(--color-border-subtle)]">
                {searchLoading ? (
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
                      onClick={() => setSelected(p)}
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
            </>
          ) : (
            <>
              <div className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <CreditCard className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                      {t("refundsPage.initiateModal.paymentLabel")}
                    </p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {selected.userName} · {selected.courseTitle}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <Money
                    amount={Number(selected.amount || 0)}
                    className="text-sm font-semibold text-[var(--color-text-primary)]"
                    iconSize={12}
                  />
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-[11px] text-[var(--color-primary)] hover:underline mt-0.5"
                  >
                    {locale === "ar" ? "تغيير" : "Change"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("refundsPage.initiateModal.reasonLabel")}
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-card)]"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`refundsPage.reasonLabels.${r}` as any)}
                    </option>
                  ))}
                </select>
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
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-page)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-card)] transition-colors"
          >
            {t("refundsPage.rejectModal.cancel")}
          </button>
          {selected && (
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
  );
};

export default InitiateRefundModal;
