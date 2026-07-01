"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  Check,
  X as XIcon,
  AlertOctagon,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Ban,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  User,
  BookOpen,
  CreditCard,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import Drawer from "./shared/Drawer";
import Money from "./shared/Money";
import AdminOverridePanel, { AdminOverrideAction } from "./shared/AdminOverridePanel";
import { useActorRole, useIsAdminActor } from "./shared/ActorRoleContext";
import { financePath } from "./shared/financeRoutes";
import { FINANCE_COLORS } from "./shared/financeColors";
import { refundApi, adminFinanceApi } from "@/lib/api";

type Tab = "overview" | "payment" | "audit";

interface RefundDetailDrawerProps {
  refundId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  pending: { bg: FINANCE_COLORS.warning.bg, text: FINANCE_COLORS.warning.textDark },
  approved: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.textDark },
  processing: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.textDark },
  completed: { bg: FINANCE_COLORS.success.bg, text: FINANCE_COLORS.success.textDark },
  rejected: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark },
  failed: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark },
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

const RefundDetailDrawer = ({
  refundId,
  onClose,
  onChanged,
}: RefundDetailDrawerProps) => {
  const t = useTranslations("financeDashboard");
  const tAdmin = useTranslations("financeDashboard.adminOverride");
  const isAdmin = useIsAdminActor();
  const actorRole = useActorRole();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Awaited<ReturnType<typeof refundApi.getDetail>> | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof refundApi.getAudit>>>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [acting, setActing] = useState<"approve" | "reject" | "fail" | null>(null);

  // Reject/Fail modal state — opened inline inside the drawer.
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectErr, setRejectErr] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [failNote, setFailNote] = useState("");
  const [failErr, setFailErr] = useState(false);

  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(new Set());

  const open = !!refundId;

  const fetchDetail = useCallback(async () => {
    if (!refundId) return;
    setLoading(true);
    try {
      const res = await refundApi.getDetail(refundId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [refundId]);

  const fetchAudit = useCallback(async () => {
    if (!refundId) return;
    setAuditLoading(true);
    try {
      const res = await refundApi.getAudit(refundId);
      setAudit(res || []);
    } catch {
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, [refundId]);

  useEffect(() => {
    if (refundId) {
      setTab("overview");
      setRejectOpen(false);
      setRejectNote("");
      setFailOpen(false);
      setFailNote("");
      setExpandedAudit(new Set());
      fetchDetail();
    }
  }, [refundId, fetchDetail]);

  useEffect(() => {
    if (refundId && tab === "audit") fetchAudit();
  }, [refundId, tab, fetchAudit]);

  const handleApprove = async () => {
    if (!refundId) return;
    setActing("approve");
    try {
      await refundApi.approve(refundId);
      toast.success(t("refundsPage.toasts.approveSuccess"));
      await fetchDetail();
      if (tab === "audit") await fetchAudit();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || t("refundsPage.toasts.genericError"));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!refundId) return;
    if (!rejectNote.trim()) {
      setRejectErr(true);
      return;
    }
    setActing("reject");
    try {
      await refundApi.reject(refundId, rejectNote.trim());
      toast.success(t("refundsPage.toasts.rejectSuccess"));
      setRejectOpen(false);
      setRejectNote("");
      await fetchDetail();
      if (tab === "audit") await fetchAudit();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || t("refundsPage.toasts.genericError"));
    } finally {
      setActing(null);
    }
  };

  const handleMarkFailed = async () => {
    if (!refundId) return;
    if (!failNote.trim()) {
      setFailErr(true);
      return;
    }
    setActing("fail");
    try {
      await refundApi.markFailed(refundId, failNote.trim());
      toast.success(t("refundsPage.toasts.markFailedSuccess"));
      setFailOpen(false);
      setFailNote("");
      await fetchDetail();
      if (tab === "audit") await fetchAudit();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message || t("refundsPage.toasts.genericError"));
    } finally {
      setActing(null);
    }
  };

  const status = data?.status || "pending";
  const statusStyle = STATUS_PILL[status] || STATUS_PILL.pending;

  const adminActions: AdminOverrideAction[] =
    refundId && data?.status === "pending"
      ? [
          {
            key: "force-approve",
            label: tAdmin("refund.forceApprove"),
            description: tAdmin("refund.forceApproveDesc"),
            successToast: tAdmin("refund.forceApproveToast"),
            run: (reason) => adminFinanceApi.forceApproveRefund(refundId, { reason }),
          },
        ]
      : [];

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("refundsPage.drawer.tabs.overview") },
    { key: "payment", label: t("refundsPage.drawer.tabs.payment") },
    { key: "audit", label: t("refundsPage.drawer.tabs.audit") },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("refundsPage.drawer.title")}
      subtitle={
        data
          ? `${data.requesterName || data.requesterEmail || "—"} · ${data.courseTitle || ""}`
          : ""
      }
      width={620}
      headerExtra={
        data ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
          >
            {t(`refundsPage.statusLabels.${status}` as any) || status}
          </span>
        ) : null
      }
      footer={
        data && (status === "pending" || status === "approved" || status === "processing") ? (
          <div className={`flex flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            {status === "pending" && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={acting !== null}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#16A34A] rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-50"
                >
                  {acting === "approve" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t("refundsPage.actions.approve")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectOpen(true);
                    setRejectNote("");
                    setRejectErr(false);
                  }}
                  disabled={acting !== null}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] bg-[var(--color-surface-card)] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
                >
                  <XIcon className="w-4 h-4" />
                  {t("refundsPage.actions.reject")}
                </button>
              </>
            )}
            {status === "approved" && (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={acting !== null}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50"
                >
                  {acting === "approve" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {t("refundsPage.actions.retryGateway")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFailOpen(true);
                    setFailNote("");
                    setFailErr(false);
                  }}
                  disabled={acting !== null}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] bg-[var(--color-surface-card)] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
                >
                  <AlertOctagon className="w-4 h-4" />
                  {t("refundsPage.actions.markFailed")}
                </button>
              </>
            )}
            {status === "processing" && (
              <button
                type="button"
                onClick={() => {
                  setFailOpen(true);
                  setFailNote("");
                  setFailErr(false);
                }}
                disabled={acting !== null}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] bg-[var(--color-surface-card)] border border-[#FEE2E2] rounded-lg hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
              >
                <AlertOctagon className="w-4 h-4" />
                {t("refundsPage.actions.markFailed")}
              </button>
            )}
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
          {/* Tabs */}
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
              {/* Amount card */}
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                    {t("refundsPage.drawer.overview.refundAmount")}
                  </p>
                  <Money
                    amount={Number(data.refundAmount || 0)}
                    className="text-2xl font-bold text-[var(--color-text-primary)]"
                    iconSize={18}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                  <div className="flex items-baseline justify-between border-t border-[var(--color-border-subtle)] pt-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {t("refundsPage.drawer.overview.originalAmount")}
                    </span>
                    <Money
                      amount={Number(data.originalAmount || 0)}
                      className="text-[var(--color-text-primary)]"
                      iconSize={12}
                    />
                  </div>
                  {Number(data.deductionAmount || 0) > 0 && (
                    <div className="flex items-baseline justify-between border-t border-[var(--color-border-subtle)] pt-2">
                      <span className="text-[#92400E]">
                        {t("refundsPage.drawer.overview.merchantFee")}
                      </span>
                      <Money
                        amount={Number(data.deductionAmount || 0)}
                        className="text-[#92400E]"
                        iconSize={12}
                      />
                    </div>
                  )}
                </div>
                {data.deductionReason && (
                  <p className="mt-2 text-[11px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-md px-2 py-1">
                    {data.deductionReason}
                  </p>
                )}
              </div>

              {/* Requester + Course + Invoice */}
              <div className="space-y-3">
                <Row
                  icon={<User className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("refundsPage.drawer.overview.requester")}
                  value={
                    <div className="text-right">
                      <p className="text-sm text-[var(--color-text-primary)] font-medium">
                        {data.requesterName || "—"}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {data.requesterEmail || "—"}
                      </p>
                    </div>
                  }
                />
                <Row
                  icon={<BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("refundsPage.drawer.overview.course")}
                  value={
                    data.refundedItems && data.refundedItems.length > 0 ? (
                      <div className="text-right">
                        {data.refundedItems.map((ri) => {
                          const title =
                            (locale === "ar" && ri.courseTitleAr) ||
                            ri.courseTitle ||
                            "—";
                          return (
                            <p
                              key={ri.paymentItemId}
                              className="text-sm text-[var(--color-text-primary)]"
                            >
                              {title}
                              <span className="text-[11px] text-[var(--color-text-secondary)] ms-1">
                                · <Money amount={Number(ri.lineTotal)} iconSize={10} />
                              </span>
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {locale === "ar"
                          ? data.courseTitleAr || data.courseTitle || "—"
                          : data.courseTitle || "—"}
                      </span>
                    )
                  }
                />
                <Row
                  icon={<FileText className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("refundsPage.drawer.overview.invoice")}
                  value={
                    data.invoiceNumber && data.invoiceId ? (
                      <Link
                        href={financePath(actorRole, locale, "invoices", { invoiceId: data.invoiceId })}
                        className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
                      >
                        {data.invoiceNumber}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                    )
                  }
                />
                <Row
                  icon={<ShieldCheck className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("refundsPage.drawer.overview.reason")}
                  value={
                    <div className="text-right">
                      <p className="text-sm text-[var(--color-text-primary)]">
                        {t(`refundsPage.reasonLabels.${data.reason}` as any) || data.reason}
                      </p>
                      {data.reasonNote && (
                        <p className="text-[11px] text-[var(--color-text-secondary)] max-w-[260px] truncate">
                          {data.reasonNote}
                        </p>
                      )}
                    </div>
                  }
                />
              </div>

              {/* Processed by + notes */}
              {(data.processorName || data.approvalNote || data.rejectionNote) && (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
                  {data.processorName && (
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-[var(--color-text-secondary)]">
                        {t("refundsPage.drawer.overview.processor")}
                      </span>
                      <span className="text-[var(--color-text-primary)]">
                        {data.processorName}
                      </span>
                    </div>
                  )}
                  {data.approvalNote && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                        {t("refundsPage.drawer.overview.approvalNote")}
                      </p>
                      <p className="text-[13px] text-[var(--color-text-primary)] mt-0.5">
                        {data.approvalNote}
                      </p>
                    </div>
                  )}
                  {data.rejectionNote && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-[#B91C1C]">
                        {t("refundsPage.drawer.overview.rejectionNote")}
                      </p>
                      <p className="text-[13px] text-[#B91C1C] mt-0.5 bg-[#FEF2F2] border border-[#FEE2E2] rounded-md px-2 py-1.5">
                        {data.rejectionNote}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  {t("refundsPage.drawer.timeline.title")}
                </h3>
                <Timeline
                  items={[
                    {
                      icon: <Send className="w-3 h-3" />,
                      color: "#CA8A04",
                      label: t("refundsPage.drawer.timeline.requested"),
                      at: data.createdAt,
                    },
                    data.approvedAt && {
                      icon: <Check className="w-3 h-3" />,
                      color: "#16A34A",
                      label: t("refundsPage.drawer.timeline.approved"),
                      at: data.approvedAt,
                    },
                    data.gatewayRefundId && data.status !== "completed" && {
                      icon: <Clock className="w-3 h-3" />,
                      color: "#2563EB",
                      label: t("refundsPage.drawer.timeline.processing"),
                      at: data.approvedAt,
                    },
                    data.completedAt && {
                      icon: <CheckCircle2 className="w-3 h-3" />,
                      color: "#065F46",
                      label: t("refundsPage.drawer.timeline.completed"),
                      at: data.completedAt,
                    },
                    data.rejectedAt && {
                      icon: <XCircle className="w-3 h-3" />,
                      color: "#DC2626",
                      label: t("refundsPage.drawer.timeline.rejected"),
                      at: data.rejectedAt,
                    },
                    data.status === "failed" && {
                      icon: <Ban className="w-3 h-3" />,
                      color: "#DC2626",
                      label: t("refundsPage.drawer.timeline.failed"),
                      at: null,
                    },
                  ].filter(Boolean) as TimelineItem[]}
                  locale={locale}
                />
              </div>
            </>
          )}

          {tab === "payment" && (
            <div className="space-y-3">
              <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
                <Row
                  icon={<CreditCard className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                  label={t("refundsPage.drawer.overview.gateway")}
                  value={
                    <span className="text-sm text-[var(--color-text-primary)] uppercase">
                      {data.gateway || "—"}
                    </span>
                  }
                />
                <Row
                  label={t("refundsPage.drawer.overview.method")}
                  value={
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {data.paymentMethod || "—"}
                    </span>
                  }
                />
                <Row
                  label={t("refundsPage.drawer.overview.gatewayRefundId")}
                  value={
                    <span className="text-[12px] font-mono text-[var(--color-text-primary)] break-all max-w-[280px] text-right">
                      {data.gatewayRefundId || "—"}
                    </span>
                  }
                />
                {data.gatewayChargeId && (
                  <Row
                    label="Gateway Charge ID"
                    value={
                      <span className="text-[12px] font-mono text-[var(--color-text-primary)] break-all max-w-[280px] text-right">
                        {data.gatewayChargeId}
                      </span>
                    }
                  />
                )}
              </div>

              <Link
                href={financePath(actorRole, locale, "payments", { paymentId: data.paymentId })}
                className="flex items-center justify-between gap-2 p-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] transition-colors group"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                  <CreditCard className="w-4 h-4" />
                  {t("refundsPage.actions.openPayment")}
                </span>
                <ArrowIcon className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />
              </Link>

              {data.invoiceId && (
                <Link
                  href={financePath(actorRole, locale, "invoices", { invoiceId: data.invoiceId })}
                  className="flex items-center justify-between gap-2 p-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                    <FileText className="w-4 h-4" />
                    {t("refundsPage.actions.openInvoice")}
                  </span>
                  <ArrowIcon className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />
                </Link>
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
                  {t("refundsPage.drawer.audit.empty")}
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
                                {t("refundsPage.drawer.audit.by")}{" "}
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
                              {t("refundsPage.drawer.audit.hideMeta")}
                            </>
                          ) : (
                            <>
                              <ChevronRight className="w-3 h-3" />
                              {t("refundsPage.drawer.audit.viewMeta")}
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

          {isAdmin && refundId && adminActions.length > 0 && (
            <AdminOverridePanel
              actions={adminActions}
              onAfter={() => {
                fetchDetail();
                if (tab === "audit") fetchAudit();
                onChanged?.();
              }}
            />
          )}
        </div>
      )}

      {/* Reject inline modal */}
      {rejectOpen && (
        <ConfirmModal
          title={t("refundsPage.rejectModal.title")}
          description={t("refundsPage.rejectModal.description")}
          placeholder={t("refundsPage.rejectModal.placeholder")}
          note={rejectNote}
          setNote={(v) => {
            setRejectNote(v);
            if (v.trim()) setRejectErr(false);
          }}
          err={rejectErr}
          errMsg={t("refundsPage.rejectModal.required")}
          confirmLabel={t("refundsPage.rejectModal.confirm")}
          cancelLabel={t("refundsPage.rejectModal.cancel")}
          confirmColor="#DC2626"
          loading={acting === "reject"}
          onConfirm={handleReject}
          onCancel={() => {
            setRejectOpen(false);
            setRejectNote("");
            setRejectErr(false);
          }}
        />
      )}

      {/* Mark-failed inline modal */}
      {failOpen && (
        <ConfirmModal
          title={t("refundsPage.failModal.title")}
          description={t("refundsPage.failModal.description")}
          placeholder={t("refundsPage.failModal.placeholder")}
          note={failNote}
          setNote={(v) => {
            setFailNote(v);
            if (v.trim()) setFailErr(false);
          }}
          err={failErr}
          errMsg={t("refundsPage.failModal.required")}
          confirmLabel={t("refundsPage.failModal.confirm")}
          cancelLabel={t("refundsPage.rejectModal.cancel")}
          confirmColor="#DC2626"
          loading={acting === "fail"}
          onConfirm={handleMarkFailed}
          onCancel={() => {
            setFailOpen(false);
            setFailNote("");
            setFailErr(false);
          }}
        />
      )}
    </Drawer>
  );
};

type TimelineItem = {
  icon: React.ReactNode;
  color: string;
  label: string;
  at: string | null;
};

function Timeline({
  items,
  locale,
}: {
  items: TimelineItem[];
  locale: string;
}) {
  return (
    <ol className="relative border-l-2 border-[var(--color-border-subtle)] ms-2 space-y-3">
      {items.map((it, idx) => (
        <li key={idx} className="ps-4 relative">
          <span
            className="absolute -start-[9px] top-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: it.color }}
          >
            {it.icon}
          </span>
          <p className="text-[13px] text-[var(--color-text-primary)] font-medium">
            {it.label}
          </p>
          {it.at && (
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {formatDateTime(it.at, locale)}
            </p>
          )}
        </li>
      ))}
    </ol>
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
      <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right">{value}</div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  placeholder,
  note,
  setNote,
  err,
  errMsg,
  confirmLabel,
  cancelLabel,
  confirmColor,
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  placeholder: string;
  note: string;
  setNote: (v: string) => void;
  err: boolean;
  errMsg: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmColor: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          {title}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {description}
        </p>
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
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
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

export default RefundDetailDrawer;
