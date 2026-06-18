"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  Clock,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Copy,
  AlertCircle,
  Building2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  financeBankTransferApi,
  type BankTransferQueueItem,
  type BankTransferReceiptDetail,
  ApiError,
} from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";

type TabKey = "pending" | "approved" | "rejected" | "all";

const TABS: { key: TabKey }[] = [
  { key: "pending" },
  { key: "approved" },
  { key: "rejected" },
  { key: "all" },
];

export default function BankTransferQueueContent() {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  const [tab, setTab] = useState<TabKey>("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BankTransferQueueItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<TabKey, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    all: 0,
  });
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);

  // Debounce search input
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeBankTransferApi.listQueue({
        status: tab,
        search: debouncedSearch || undefined,
        page,
        limit: 10,
      });
      setItems(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error("Failed to load bank transfer queue", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedSearch, page]);

  const fetchTabCounts = useCallback(async () => {
    try {
      const [p, a, r, all] = await Promise.all([
        financeBankTransferApi.listQueue({ status: "pending", page: 1, limit: 1 }),
        financeBankTransferApi.listQueue({ status: "approved", page: 1, limit: 1 }),
        financeBankTransferApi.listQueue({ status: "rejected", page: 1, limit: 1 }),
        financeBankTransferApi.listQueue({ status: "all", page: 1, limit: 1 }),
      ]);
      setTabCounts({
        pending: p.pagination.total,
        approved: a.pagination.total,
        rejected: r.pagination.total,
        all: all.pagination.total,
      });
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    fetchTabCounts();
  }, [fetchTabCounts]);

  // After approve/reject, the modal closes and we refresh the list + counts
  const handleActioned = useCallback(() => {
    setOpenReceiptId(null);
    fetchQueue();
    fetchTabCounts();
  }, [fetchQueue, fetchTabCounts]);

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar
                profile={profile}
                pendingBankTransferCount={tabCounts.pending}
              />
            </div>
            <FinanceMobileSidebar
              profile={profile}
              pendingBankTransferCount={tabCounts.pending}
            />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)] flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-[#4338CA]" />
                    {t("bankTransferQueue.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("bankTransferQueue.subtitle")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    fetchQueue();
                    fetchTabCounts();
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  {t("bankTransferQueue.refresh")}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-2 mb-4" role="tablist">
                {TABS.map(({ key }) => {
                  const active = tab === key;
                  const count = tabCounts[key];
                  return (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setTab(key);
                        setPage(1);
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        active
                          ? "bg-[#005bd3] text-white"
                          : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-page)]"
                      }`}
                    >
                      {t(`bankTransferQueue.tabs.${key}`)}
                      <span
                        className={`ms-2 inline-flex items-center justify-center min-w-[20px] px-1.5 h-5 rounded-full text-xs ${
                          active
                            ? "bg-white/20 text-white"
                            : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search */}
              <div className="mb-4">
                <div className="relative max-w-md">
                  <Search
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${
                      isRTL ? "right-3" : "left-3"
                    }`}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("bankTransferQueue.searchPlaceholder")}
                    className={`w-full h-10 ${
                      isRTL ? "pr-9 pl-3" : "pl-9 pr-3"
                    } bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#005bd3]`}
                  />
                </div>
              </div>

              {/* Table / list */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                    <Building2 className="w-12 h-12 text-[var(--color-text-secondary)] opacity-40 mb-3" />
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {t("bankTransferQueue.empty.title")}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {t("bankTransferQueue.empty.body")}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                            <Th>{t("bankTransferQueue.col.student")}</Th>
                            <Th>{t("bankTransferQueue.col.course")}</Th>
                            <Th>{t("bankTransferQueue.col.amount")}</Th>
                            <Th>{t("bankTransferQueue.col.uploaded")}</Th>
                            <Th>{t("bankTransferQueue.col.scan")}</Th>
                            <Th>{t("bankTransferQueue.col.status")}</Th>
                            <Th>{t("bankTransferQueue.col.actions")}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it) => (
                            <tr
                              key={it.receiptId}
                              className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-page)]"
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-[var(--color-text-primary)] truncate max-w-[200px]">
                                  {it.student.name}
                                </div>
                                <div className="text-xs text-[var(--color-text-secondary)] truncate max-w-[200px]">
                                  {it.student.email}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[var(--color-text-primary)] max-w-[220px] truncate">
                                {it.course.title}
                              </td>
                              <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                                {it.payment.currency} {Number(it.payment.amount).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">
                                {formatDate(it.uploadedAt, locale)}
                              </td>
                              <td className="px-4 py-3">
                                <ScanBadge status={it.scanStatus} t={t} />
                              </td>
                              <td className="px-4 py-3">
                                <ReviewBadge status={it.reviewStatus} t={t} />
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setOpenReceiptId(it.receiptId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#005bd3] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                >
                                  <Eye className="w-4 h-4" aria-hidden="true" />
                                  {t("bankTransferQueue.review")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-[var(--color-border)]">
                      {items.map((it) => (
                        <div key={it.receiptId} className="p-4">
                          <div className="flex justify-between items-start gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-[var(--color-text-primary)] truncate">
                                {it.student.name}
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                {it.student.email}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-[var(--color-text-primary)]">
                                {it.payment.currency} {Number(it.payment.amount).toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-[var(--color-text-primary)] truncate mb-2">
                            {it.course.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <ScanBadge status={it.scanStatus} t={t} />
                            <ReviewBadge status={it.reviewStatus} t={t} />
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {formatDate(it.uploadedAt, locale)}
                            </span>
                          </div>
                          <button
                            onClick={() => setOpenReceiptId(it.receiptId)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-[#005bd3] bg-[#EFF6FF] rounded-lg"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                            {t("bankTransferQueue.review")}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          {t("bankTransferQueue.showing", {
                            from: (page - 1) * 10 + 1,
                            to: Math.min(page * 10, total),
                            total,
                          })}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </button>
                          <span className="px-3 text-sm">
                            {page} / {totalPages}
                          </span>
                          <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded hover:bg-[var(--color-surface-page)] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {openReceiptId && (
        <ReviewReceiptModal
          receiptId={openReceiptId}
          onClose={() => setOpenReceiptId(null)}
          onActioned={handleActioned}
          t={t}
          locale={locale}
        />
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslations<"financeDashboard">>;

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
      {children}
    </th>
  );
}

function ScanBadge({
  status,
  t,
}: {
  status: BankTransferQueueItem["scanStatus"];
  t: TFn;
}) {
  const map: Record<typeof status, { tone: string; Icon: React.ElementType; label: string }> = {
    pending: {
      tone: "bg-amber-100 text-amber-800",
      Icon: Clock,
      label: t("bankTransferQueue.scan.pending"),
    },
    clean: {
      tone: "bg-emerald-100 text-emerald-800",
      Icon: ShieldCheck,
      label: t("bankTransferQueue.scan.clean"),
    },
    infected: {
      tone: "bg-red-100 text-red-800",
      Icon: AlertTriangle,
      label: t("bankTransferQueue.scan.infected"),
    },
    error: {
      tone: "bg-gray-100 text-gray-800",
      Icon: AlertCircle,
      label: t("bankTransferQueue.scan.error"),
    },
  };
  const { tone, Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function ReviewBadge({
  status,
  t,
}: {
  status: BankTransferQueueItem["reviewStatus"];
  t: TFn;
}) {
  const map: Record<typeof status, { tone: string; label: string }> = {
    pending: {
      tone: "bg-blue-100 text-blue-800",
      label: t("bankTransferQueue.reviewStatus.pending"),
    },
    approved: {
      tone: "bg-green-100 text-green-800",
      label: t("bankTransferQueue.reviewStatus.approved"),
    },
    rejected: {
      tone: "bg-red-100 text-red-800",
      label: t("bankTransferQueue.reviewStatus.rejected"),
    },
  };
  const { tone, label } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function ReviewReceiptModal({
  receiptId,
  onClose,
  onActioned,
  t,
  locale,
}: {
  receiptId: string;
  onClose: () => void;
  onActioned: () => void;
  t: TFn;
  locale: string;
}) {
  const isRTL = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BankTransferReceiptDetail | null>(null);
  const [acting, setActing] = useState(false);
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [reviewerNote, setReviewerNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    financeBankTransferApi
      .getReceipt(receiptId)
      .then(setDetail)
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "Failed to load receipt";
        toast.error(msg);
        onClose();
      })
      .finally(() => setLoading(false));
  }, [receiptId, onClose]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleApprove = async () => {
    if (!detail) return;
    setActing(true);
    try {
      await financeBankTransferApi.approve(receiptId, {
        internalNote: internalNote.trim() || undefined,
      });
      toast.success(t("bankTransferQueue.actions.approveSuccess"));
      onActioned();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("bankTransferQueue.actions.approveFailed");
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    if (reviewerNote.trim().length < 5) {
      toast.error(t("bankTransferQueue.actions.noteRequired"));
      return;
    }
    setActing(true);
    try {
      await financeBankTransferApi.reject(receiptId, {
        reviewerNote: reviewerNote.trim(),
        internalNote: internalNote.trim() || undefined,
      });
      toast.success(t("bankTransferQueue.actions.rejectSuccess"));
      onActioned();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("bankTransferQueue.actions.rejectFailed");
      toast.error(msg);
    } finally {
      setActing(false);
    }
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !acting) onClose();
      }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#1F2937]">
            {t("bankTransferQueue.modal.title")}
          </h2>
          <button
            onClick={onClose}
            disabled={acting}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] disabled:opacity-50"
            aria-label={t("bankTransferQueue.modal.close")}
          >
            <X className="w-5 h-5 text-[#6B7280]" aria-hidden="true" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Scan warning */}
              {detail.receipt.scanStatus === "infected" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">
                    {t("bankTransferQueue.modal.infectedWarning")}
                  </p>
                </div>
              )}
              {detail.receipt.scanStatus === "pending" && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    {t("bankTransferQueue.modal.scanPending")}
                  </p>
                </div>
              )}

              {/* Receipt preview */}
              <ReceiptPreview detail={detail} t={t} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Payment context */}
                <Section title={t("bankTransferQueue.modal.payment")}>
                  <KV label={t("bankTransferQueue.modal.student")} value={`${detail.student.name} (${detail.student.email})`} />
                  <KV label={t("bankTransferQueue.modal.course")} value={detail.course.title} />
                  <KV
                    label={t("bankTransferQueue.modal.amount")}
                    value={`${detail.payment.currency} ${Number(detail.payment.amount).toFixed(2)}`}
                  />
                  <KV label={t("bankTransferQueue.modal.uploadedAt")} value={formatDate(detail.receipt.uploadedAt, locale)} />
                  <KV
                    label={t("bankTransferQueue.modal.paymentId")}
                    value={detail.payment.id}
                    mono
                    copyable={(v) => copyText(v, "paymentId")}
                    copied={copied === "paymentId"}
                  />
                </Section>

                {/* Refund info snapshot */}
                <Section title={t("bankTransferQueue.modal.refundInfo")}>
                  <KV label={t("bankTransferQueue.modal.accountHolder")} value={detail.receipt.refundInfo.accountHolder} />
                  <KV
                    label={t("bankTransferQueue.modal.iban")}
                    value={detail.receipt.refundInfo.iban}
                    mono
                    copyable={(v) => copyText(v, "iban")}
                    copied={copied === "iban"}
                  />
                  <KV label={t("bankTransferQueue.modal.bank")} value={detail.receipt.refundInfo.bankName} />
                  {detail.receipt.refundInfo.nationalId && (
                    <KV label={t("bankTransferQueue.modal.nationalId")} value={detail.receipt.refundInfo.nationalId} mono />
                  )}
                </Section>
              </div>

              {/* Already-actioned summary (if approved/rejected) */}
              {detail.receipt.reviewStatus !== "pending" && (
                <div
                  className={`border rounded-lg p-4 ${
                    detail.receipt.reviewStatus === "approved"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <p className={`text-sm font-semibold ${detail.receipt.reviewStatus === "approved" ? "text-green-900" : "text-red-900"}`}>
                    {t(`bankTransferQueue.modal.${detail.receipt.reviewStatus}Notice`)}
                  </p>
                  {detail.receipt.reviewerNote && (
                    <p className="text-sm mt-2 text-gray-700">
                      <strong>{t("bankTransferQueue.modal.reviewerNote")}:</strong>{" "}
                      {detail.receipt.reviewerNote}
                    </p>
                  )}
                  {detail.receipt.reviewedAt && (
                    <p className="text-xs mt-1 text-gray-600">
                      {formatDate(detail.receipt.reviewedAt, locale)}
                    </p>
                  )}
                </div>
              )}

              {/* Action panel (only when pending) */}
              {detail.receipt.reviewStatus === "pending" && mode === "view" && (
                <Section title={t("bankTransferQueue.modal.internalNote")}>
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={2}
                    placeholder={t("bankTransferQueue.modal.internalNotePlaceholder")}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#005bd3]"
                  />
                  <p className="text-xs text-[#6B7280] mt-1">
                    {t("bankTransferQueue.modal.internalNoteHint")}
                  </p>
                </Section>
              )}

              {detail.receipt.reviewStatus === "pending" && mode === "reject" && (
                <Section title={t("bankTransferQueue.modal.rejectTitle")}>
                  <textarea
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    rows={3}
                    placeholder={t("bankTransferQueue.modal.rejectNotePlaceholder")}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                  />
                  <p className="text-xs text-red-600 mt-1">
                    {t("bankTransferQueue.modal.rejectNoteHint")}
                  </p>
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={2}
                    placeholder={t("bankTransferQueue.modal.internalNotePlaceholder")}
                    className="w-full mt-3 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#005bd3]"
                  />
                  <p className="text-xs text-[#6B7280] mt-1">
                    {t("bankTransferQueue.modal.internalNoteHint")}
                  </p>
                </Section>
              )}
            </div>

            {/* Footer actions */}
            {detail.receipt.reviewStatus === "pending" && (
              <div className="border-t border-[#E5E7EB] px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {mode === "view" ? (
                  <>
                    <button
                      onClick={onClose}
                      disabled={acting}
                      className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50"
                    >
                      {t("bankTransferQueue.modal.cancel")}
                    </button>
                    <button
                      onClick={() => setMode("reject")}
                      disabled={acting}
                      className="px-4 py-2 text-sm font-medium text-red-700 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                      {t("bankTransferQueue.modal.reject")}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={
                        acting ||
                        detail.receipt.scanStatus === "infected" ||
                        detail.receipt.scanStatus === "pending"
                      }
                      className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {acting ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      {t("bankTransferQueue.modal.approve")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setMode("view");
                        setReviewerNote("");
                      }}
                      disabled={acting}
                      className="px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50"
                    >
                      {t("bankTransferQueue.modal.back")}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={acting || reviewerNote.trim().length < 5}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {acting ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <X className="w-4 h-4" aria-hidden="true" />
                      )}
                      {t("bankTransferQueue.modal.confirmReject")}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReceiptPreview({
  detail,
  t,
}: {
  detail: BankTransferReceiptDetail;
  t: TFn;
}) {
  const isImage = detail.receipt.mimeType.startsWith("image/");
  const isPdf = detail.receipt.mimeType === "application/pdf";

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[#374151]">
          {t("bankTransferQueue.modal.receipt")}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6B7280]">
            {detail.receipt.fileName} ·{" "}
            {(detail.receipt.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
          </span>
          <a
            href={detail.receipt.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#005bd3] hover:underline"
          >
            {t("bankTransferQueue.modal.openInNewTab")}
          </a>
        </div>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] overflow-hidden">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.receipt.downloadUrl}
            alt={detail.receipt.fileName}
            className="w-full max-h-[420px] object-contain bg-white"
          />
        ) : isPdf ? (
          <iframe
            src={detail.receipt.downloadUrl}
            title={detail.receipt.fileName}
            className="w-full h-[420px] bg-white"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-[#6B7280]">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">{t("bankTransferQueue.modal.previewUnavailable")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-[#374151] mb-2">{title}</h3>
      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 space-y-2">
        {children}
      </div>
    </section>
  );
}

function KV({
  label,
  value,
  mono,
  copyable,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: (v: string) => void;
  copied?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs text-[#6B7280] flex-shrink-0">{label}</span>
      <span className="flex items-center gap-1 min-w-0">
        <span
          className={`text-sm text-[#1F2937] text-end break-all ${mono ? "font-mono" : ""}`}
        >
          {value}
        </span>
        {copyable && (
          <button
            onClick={() => copyable(value)}
            className="flex-shrink-0 p-1 text-[#6B7280] hover:text-[#005bd3]"
            aria-label={copied ? "Copied" : "Copy"}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </span>
    </div>
  );
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
