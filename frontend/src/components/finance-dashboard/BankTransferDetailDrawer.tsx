"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  Check,
  X as XIcon,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Download,
  FileText,
  User as UserIcon,
  BookOpen,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  AlertOctagon,
  CheckCircle2,
  Upload,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import Drawer from "./shared/Drawer";
import Money from "./shared/Money";
import { useActorRole } from "./shared/ActorRoleContext";
import { financePath } from "./shared/financeRoutes";
import { FINANCE_COLORS } from "./shared/financeColors";
import { financeBankTransferApi } from "@/lib/api";

type Tab = "overview" | "history" | "audit";

interface Props {
  receiptId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const REVIEW_PILL: Record<string, { bg: string; text: string }> = {
  pending: { bg: FINANCE_COLORS.warning.bg, text: FINANCE_COLORS.warning.textDark },
  approved: { bg: FINANCE_COLORS.success.bg, text: FINANCE_COLORS.success.textDark },
  rejected: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark },
};

const SCAN_PILL: Record<
  string,
  { bg: string; text: string; Icon: typeof ShieldCheck }
> = {
  clean: { bg: FINANCE_COLORS.success.bg, text: FINANCE_COLORS.success.textDark, Icon: ShieldCheck },
  pending: { bg: FINANCE_COLORS.warning.bg, text: FINANCE_COLORS.warning.textDark, Icon: ShieldQuestion },
  infected: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark, Icon: ShieldX },
  error: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark, Icon: ShieldAlert },
};

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

const BankTransferDetailDrawer = ({ receiptId, onClose, onChanged }: Props) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const actorRole = useActorRole();
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Awaited<
    ReturnType<typeof financeBankTransferApi.getReceipt>
  > | null>(null);
  const [history, setHistory] = useState<Awaited<
    ReturnType<typeof financeBankTransferApi.getReplacementChain>
  >>([]);
  const [audit, setAudit] = useState<Awaited<
    ReturnType<typeof financeBankTransferApi.getReceiptAudit>
  >>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectInternalNote, setRejectInternalNote] = useState("");
  const [rejectErr, setRejectErr] = useState(false);

  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(new Set());

  const open = !!receiptId;

  const fetchDetail = useCallback(async () => {
    if (!receiptId) return;
    setLoading(true);
    try {
      const res = await financeBankTransferApi.getReceipt(receiptId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  const fetchHistory = useCallback(async () => {
    if (!receiptId) return;
    setHistoryLoading(true);
    try {
      const res = await financeBankTransferApi.getReplacementChain(receiptId);
      setHistory(res || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [receiptId]);

  const fetchAudit = useCallback(async () => {
    if (!receiptId) return;
    setAuditLoading(true);
    try {
      const res = await financeBankTransferApi.getReceiptAudit(receiptId);
      setAudit(res || []);
    } catch {
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    if (receiptId) {
      setTab("overview");
      setApproveOpen(false);
      setApproveNote("");
      setRejectOpen(false);
      setRejectNote("");
      setRejectInternalNote("");
      setRejectErr(false);
      setExpandedAudit(new Set());
      fetchDetail();
    }
  }, [receiptId, fetchDetail]);

  useEffect(() => {
    if (receiptId && tab === "history") fetchHistory();
  }, [receiptId, tab, fetchHistory]);

  useEffect(() => {
    if (receiptId && tab === "audit") fetchAudit();
  }, [receiptId, tab, fetchAudit]);

  const handleApprove = async () => {
    if (!receiptId) return;
    setActing("approve");
    try {
      await financeBankTransferApi.approve(receiptId, {
        internalNote: approveNote || undefined,
      });
      toast.success(t("bankTransferQueue.actions.approveSuccess"));
      setApproveOpen(false);
      setApproveNote("");
      await fetchDetail();
      if (tab === "audit") await fetchAudit();
      if (tab === "history") await fetchHistory();
      onChanged?.();
    } catch (e: any) {
      toast.error(
        e?.message || t("bankTransferQueue.actions.approveFailed"),
      );
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!receiptId) return;
    if (!rejectNote.trim() || rejectNote.trim().length < 5) {
      setRejectErr(true);
      return;
    }
    setActing("reject");
    try {
      await financeBankTransferApi.reject(receiptId, {
        reviewerNote: rejectNote.trim(),
        internalNote: rejectInternalNote || undefined,
      });
      toast.success(t("bankTransferQueue.actions.rejectSuccess"));
      setRejectOpen(false);
      setRejectNote("");
      setRejectInternalNote("");
      await fetchDetail();
      if (tab === "audit") await fetchAudit();
      if (tab === "history") await fetchHistory();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || t("bankTransferQueue.actions.rejectFailed"));
    } finally {
      setActing(null);
    }
  };

  const review = data?.receipt.reviewStatus || "pending";
  const scan = data?.receipt.scanStatus || "pending";
  const reviewStyle = REVIEW_PILL[review] || REVIEW_PILL.pending;
  const scanStyle = SCAN_PILL[scan] || SCAN_PILL.pending;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("bankTransferQueue.drawer.tabs.overview") },
    { key: "history", label: t("bankTransferQueue.drawer.tabs.history") },
    { key: "audit", label: t("bankTransferQueue.drawer.tabs.audit") },
  ];

  const canApprove = review === "pending" && scan === "clean";
  const canReject = review === "pending";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("bankTransferQueue.drawer.title")}
      subtitle={data ? `${data.student.name} · ${data.course.title}` : ""}
      width={640}
      headerExtra={
        data ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${scanStyle.bg} ${scanStyle.text}`}
            >
              <scanStyle.Icon className="w-3 h-3" />
              {t(`bankTransferQueue.scan.${scan}` as any)}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${reviewStyle.bg} ${reviewStyle.text}`}
            >
              {t(`bankTransferQueue.reviewStatus.${review}` as any)}
            </span>
          </div>
        ) : null
      }
      footer={
        data && review === "pending" ? (
          <div className={`flex flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <button
              type="button"
              onClick={() => {
                if (!canApprove) {
                  toast.error(
                    t("bankTransferQueue.drawer.blockedByScan", {
                      status: t(`bankTransferQueue.scan.${scan}` as any),
                    }),
                  );
                  return;
                }
                setApproveOpen(true);
              }}
              disabled={acting !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-50"
            >
              {acting === "approve" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {t("bankTransferQueue.drawer.approve.confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canReject) return;
                setRejectOpen(true);
                setRejectNote("");
                setRejectInternalNote("");
                setRejectErr(false);
              }}
              disabled={acting !== null}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] bg-[var(--color-surface-card)] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
            >
              <XIcon className="w-4 h-4" />
              {t("bankTransferQueue.drawer.reject.confirm")}
            </button>
          </div>
        ) : null
      }
    >
      {loading || !data ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <div className="flex gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5 w-fit">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                  tab === tb.key
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <>
              {/* Receipt preview */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                <div
                  className={`flex items-center justify-between gap-2 px-4 py-2 border-b border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <div className={`flex items-center gap-2 min-w-0 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <FileText className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                    <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
                      {data.receipt.fileName}
                    </p>
                    <span className="text-[10px] text-[var(--color-text-secondary)]">
                      ({(data.receipt.fileSizeBytes / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={data.receipt.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline px-2 py-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t("bankTransferQueue.drawer.overview.openInNewTab")}
                    </a>
                    <a
                      href={data.receipt.downloadUrl}
                      download={data.receipt.fileName}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1"
                    >
                      <Download className="w-3 h-3" />
                      {t("bankTransferQueue.drawer.overview.download")}
                    </a>
                  </div>
                </div>
                <ReceiptPreview
                  url={data.receipt.downloadUrl}
                  mimeType={data.receipt.mimeType}
                  unavailableLabel={t(
                    "bankTransferQueue.drawer.overview.previewUnavailable",
                  )}
                  imageAlt={t("bankTransferQueue.drawer.overview.receiptImageAlt")}
                  pdfTitle={t("bankTransferQueue.drawer.overview.receiptPdfTitle")}
                />
              </div>

              {/* Amount + meta */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                    {t("bankTransferQueue.drawer.overview.amount")}
                  </p>
                  <Money
                    amount={Number(data.payment.amount || 0)}
                    className="text-2xl font-bold text-[var(--color-text-primary)]"
                    iconSize={18}
                  />
                </div>
              </div>

              {/* Student + Course + Payment meta */}
              <div className="space-y-2 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
                <Row
                  icon={<UserIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("bankTransferQueue.drawer.overview.student")}
                  value={
                    <div className="text-right">
                      <p className="text-sm text-[var(--color-text-primary)] font-medium">
                        {data.student.name}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {data.student.email}
                      </p>
                    </div>
                  }
                />
                <Row
                  icon={<BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("bankTransferQueue.drawer.overview.course")}
                  value={
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {data.course.title}
                    </span>
                  }
                />
                <Row
                  icon={<Clock className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("bankTransferQueue.drawer.overview.uploadedAt")}
                  value={
                    <span className="text-[12px] text-[var(--color-text-primary)]">
                      {formatDateTime(data.receipt.uploadedAt, locale)}
                    </span>
                  }
                />
                <Row
                  icon={<CreditCard className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("bankTransferQueue.drawer.overview.paymentId")}
                  value={
                    <span className="text-[11px] font-mono text-[var(--color-text-primary)] break-all max-w-[260px] text-right">
                      {data.payment.id}
                    </span>
                  }
                />
              </div>

              {/* Refund bank details */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
                <h4 className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-2">
                  {t("bankTransferQueue.drawer.overview.refundInfoTitle")}
                </h4>
                <div className="space-y-1.5">
                  <Row
                    label={t("bankTransferQueue.drawer.overview.accountHolder")}
                    value={
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {data.receipt.refundInfo.accountHolder}
                      </span>
                    }
                  />
                  <Row
                    label={t("bankTransferQueue.drawer.overview.iban")}
                    value={
                      <span className="text-[12px] font-mono text-[var(--color-text-primary)] break-all max-w-[260px] text-right">
                        {data.receipt.refundInfo.iban}
                      </span>
                    }
                  />
                  <Row
                    label={t("bankTransferQueue.drawer.overview.bank")}
                    value={
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {data.receipt.refundInfo.bankName}
                      </span>
                    }
                  />
                  {data.receipt.refundInfo.nationalId && (
                    <Row
                      label={t("bankTransferQueue.drawer.overview.nationalId")}
                      value={
                        <span className="text-sm text-[var(--color-text-primary)]">
                          {data.receipt.refundInfo.nationalId}
                        </span>
                      }
                    />
                  )}
                </div>
              </div>

              {/* Notes */}
              {(data.receipt.reviewerNote || data.receipt.financeInternalNote) && (
                <div className="space-y-2">
                  {data.receipt.reviewerNote && (
                    <div className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[#B91C1C] font-semibold mb-0.5">
                        {t("bankTransferQueue.drawer.overview.reviewerNote")}
                      </p>
                      <p className="text-[12px] text-[#B91C1C]">
                        {data.receipt.reviewerNote}
                      </p>
                    </div>
                  )}
                  {data.receipt.financeInternalNote && (
                    <div className="bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded-lg px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold mb-0.5">
                        {t("bankTransferQueue.drawer.overview.internalNote")}
                      </p>
                      <p className="text-[12px] text-[var(--color-text-primary)]">
                        {data.receipt.financeInternalNote}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Cross-links */}
              <div className="space-y-2">
                <Link
                  href={financePath(actorRole, locale, "payments", { paymentId: data.payment.id })}
                  className="flex items-center justify-between gap-2 p-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                    <CreditCard className="w-4 h-4" />
                    {t("bankTransferQueue.drawer.overview.openPayment")}
                  </span>
                  <ArrowIcon className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />
                </Link>
              </div>
            </>
          )}

          {tab === "history" && (
            <div className="space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-center text-[var(--color-text-secondary)] py-8">
                  {t("bankTransferQueue.drawer.history.empty")}
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">
                    {t("bankTransferQueue.drawer.history.title")}
                  </p>
                  {history.map((h) => {
                    const isThis = h.isThis;
                    const isCurrent = h.replacedById === null;
                    return (
                      <div
                        key={h.id}
                        className={`p-3 rounded-lg border ${
                          isThis
                            ? "border-[var(--color-primary)] bg-[var(--color-surface-card)]"
                            : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className={`flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                              <Upload className="w-3 h-3 text-[var(--color-text-secondary)]" />
                              <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                                {h.fileName}
                              </p>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                              {formatDateTime(h.uploadedAt, locale)}
                            </p>
                            {h.reviewerNote && (
                              <div className="mt-2 bg-[#FEF2F2] border border-[#FEE2E2] rounded px-2 py-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-[#B91C1C] font-semibold">
                                  {t("bankTransferQueue.drawer.history.rejectedNote")}
                                </p>
                                <p className="text-[11px] text-[#B91C1C] mt-0.5">
                                  {h.reviewerNote}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {isThis && (
                              <span className="text-[10px] uppercase tracking-wide bg-[var(--color-primary)] text-white rounded px-1.5 py-0.5">
                                {t("bankTransferQueue.drawer.history.this")}
                              </span>
                            )}
                            <span
                              className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${
                                REVIEW_PILL[h.reviewStatus]?.bg || ""
                              } ${REVIEW_PILL[h.reviewStatus]?.text || ""}`}
                            >
                              {t(`bankTransferQueue.reviewStatus.${h.reviewStatus}` as any)}
                            </span>
                            {!isCurrent && (
                              <span className="text-[10px] uppercase tracking-wide bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] rounded px-1.5 py-0.5">
                                {t("bankTransferQueue.drawer.history.replaced")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-2">
              {auditLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
                </div>
              ) : audit.length === 0 ? (
                <p className="text-sm text-center text-[var(--color-text-secondary)] py-8">
                  {t("bankTransferQueue.drawer.audit.empty")}
                </p>
              ) : (
                audit.map((entry) => {
                  const expanded = expandedAudit.has(entry.id);
                  const hasMeta =
                    entry.metadata && Object.keys(entry.metadata).length > 0;
                  return (
                    <div
                      key={entry.id}
                      className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                            {entry.action}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                            {formatDateTime(entry.createdAt, locale)}
                            {entry.actorName ? (
                              <>
                                {" · "}
                                {t("bankTransferQueue.drawer.audit.by")}{" "}
                                <span className="text-[var(--color-text-primary)]">
                                  {entry.actorName}
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] rounded px-1.5 py-0.5">
                          {entry.entityType}
                        </span>
                      </div>
                      {hasMeta && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(expandedAudit);
                            if (next.has(entry.id)) next.delete(entry.id);
                            else next.add(entry.id);
                            setExpandedAudit(next);
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline"
                        >
                          {expanded ? (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              {t("bankTransferQueue.drawer.audit.hideMeta")}
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-3 h-3" />
                              {t("bankTransferQueue.drawer.audit.viewMeta")}
                            </>
                          )}
                        </button>
                      )}
                      {hasMeta && expanded && (
                        <pre className="mt-2 p-2 bg-[var(--color-surface-page)] border border-[var(--color-border-subtle)] rounded text-[11px] text-[var(--color-text-primary)] overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Approve inline modal */}
      {approveOpen && (
        <NoteModal
          title={t("bankTransferQueue.drawer.approve.title")}
          description={null}
          noteLabel={t("bankTransferQueue.drawer.approve.note")}
          placeholder={t("bankTransferQueue.drawer.approve.notePlaceholder")}
          note={approveNote}
          setNote={setApproveNote}
          err={false}
          errMsg=""
          required={false}
          confirmLabel={t("bankTransferQueue.drawer.approve.confirm")}
          confirmColor="#16A34A"
          loading={acting === "approve"}
          onConfirm={handleApprove}
          onCancel={() => {
            setApproveOpen(false);
            setApproveNote("");
          }}
        />
      )}

      {/* Reject inline modal */}
      {rejectOpen && (
        <NoteModal
          title={t("bankTransferQueue.drawer.reject.title")}
          description={null}
          noteLabel={t("bankTransferQueue.drawer.reject.note")}
          placeholder={t("bankTransferQueue.drawer.reject.notePlaceholder")}
          note={rejectNote}
          setNote={(v) => {
            setRejectNote(v);
            if (v.trim().length >= 5) setRejectErr(false);
          }}
          err={rejectErr}
          errMsg={t("bankTransferQueue.drawer.reject.required")}
          required
          extraInternalNote={{
            label: t("bankTransferQueue.drawer.reject.internalNote"),
            value: rejectInternalNote,
            setValue: setRejectInternalNote,
          }}
          confirmLabel={t("bankTransferQueue.drawer.reject.confirm")}
          confirmColor="#DC2626"
          loading={acting === "reject"}
          onConfirm={handleReject}
          onCancel={() => {
            setRejectOpen(false);
            setRejectNote("");
            setRejectInternalNote("");
            setRejectErr(false);
          }}
        />
      )}
    </Drawer>
  );
};

function ReceiptPreview({
  url,
  mimeType,
  unavailableLabel,
  imageAlt,
  pdfTitle,
}: {
  url: string;
  mimeType: string;
  unavailableLabel: string;
  imageAlt: string;
  pdfTitle: string;
}) {
  if (mimeType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={imageAlt}
        className="w-full max-h-[420px] object-contain bg-[var(--color-surface-page)]"
      />
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={url}
        title={pdfTitle}
        className="w-full h-[420px] bg-[var(--color-surface-page)]"
      />
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-[12px] text-[var(--color-text-secondary)] bg-[var(--color-surface-page)]">
      <FileText className="w-8 h-8 mb-2 opacity-50" />
      {unavailableLabel}
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
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

function NoteModal({
  title,
  description,
  noteLabel,
  placeholder,
  note,
  setNote,
  err,
  errMsg,
  required,
  confirmLabel,
  confirmColor,
  loading,
  onConfirm,
  onCancel,
  extraInternalNote,
}: {
  title: string;
  description: string | null;
  noteLabel: string;
  placeholder: string;
  note: string;
  setNote: (v: string) => void;
  err: boolean;
  errMsg: string;
  required: boolean;
  confirmLabel: string;
  confirmColor: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  extraInternalNote?: {
    label: string;
    value: string;
    setValue: (v: string) => void;
  };
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            {description}
          </p>
        )}
        <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
          {noteLabel}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`w-full px-3 py-2 border rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none resize-none ${
            err
              ? "border-[#DC2626] focus:border-[#DC2626]"
              : "border-[var(--color-border)] focus:border-[var(--color-primary)]"
          }`}
        />
        {err && <p className="text-[12px] text-[#DC2626] mt-1">{errMsg}</p>}

        {extraInternalNote && (
          <div className="mt-3">
            <label className="block text-[12px] font-medium text-[var(--color-text-secondary)] mb-1">
              {extraInternalNote.label}
            </label>
            <textarea
              value={extraInternalNote.value}
              onChange={(e) => extraInternalNote.setValue(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || (required && note.trim().length < 5)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: confirmColor }}
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BankTransferDetailDrawer;
