"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  User,
  CreditCard,
  FileText,
  RotateCcw,
  Building2,
  Scale,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Eye,
  RefreshCcw,
  AlertCircle,
} from "lucide-react";
import Drawer from "./shared/Drawer";
import Money from "./shared/Money";
import GatewayResponseViewer from "./GatewayResponseViewer";
import { FINANCE_COLORS, gatewayColor } from "./shared/financeColors";
import { paymentApi } from "@/lib/api";

type Tab = "overview" | "gateway" | "audit";

interface PaymentDetailDrawerProps {
  paymentId: string | null;
  onClose: () => void;
}

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  paid: { bg: FINANCE_COLORS.success.bg, text: FINANCE_COLORS.success.textDark },
  pending: { bg: FINANCE_COLORS.warning.bg, text: FINANCE_COLORS.warning.textDark },
  processing: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.textDark },
  awaiting_approval: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.textDark },
  failed: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark },
  rejected: { bg: FINANCE_COLORS.slate.bg, text: FINANCE_COLORS.slate.textDark },
  refunded: { bg: FINANCE_COLORS.violet.bg, text: FINANCE_COLORS.violet.textDark },
  partially_refunded: { bg: FINANCE_COLORS.violet.bgSoft, text: FINANCE_COLORS.violet.textDark },
  chargeback: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.textDark },
  abandoned: { bg: FINANCE_COLORS.slate.bg, text: FINANCE_COLORS.slate.textDark },
};

const PaymentDetailDrawer = ({ paymentId, onClose }: PaymentDetailDrawerProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<Awaited<ReturnType<typeof paymentApi.getDetail>> | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof paymentApi.getAudit>>>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const open = !!paymentId;

  const fetchDetail = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    setData(null);
    try {
      const res = await paymentApi.getDetail(paymentId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  const fetchAudit = useCallback(async () => {
    if (!paymentId) return;
    setAuditLoading(true);
    try {
      const res = await paymentApi.getAudit(paymentId);
      setAudit(res || []);
    } catch {
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (paymentId) {
      setActiveTab("overview");
      fetchDetail();
    }
  }, [paymentId, fetchDetail]);

  useEffect(() => {
    if (paymentId && activeTab === "audit") fetchAudit();
  }, [paymentId, activeTab, fetchAudit]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("paymentDetail.tabs.overview") },
    { key: "gateway", label: t("paymentDetail.tabs.gateway") },
    { key: "audit", label: t("paymentDetail.tabs.audit") },
  ];

  const headerSubtitle = data
    ? `${data.payment.id.slice(0, 13).toUpperCase()} · ${data.payment.gateway?.replace(/_/g, " ")}`
    : "";

  const statusKey =
    data?.payment.status === "partially_refunded"
      ? "partiallyRefunded"
      : data?.payment.status === "awaiting_approval"
        ? "awaitingApproval"
        : data?.payment.status || "pending";
  const statusStyle = STATUS_PILL[data?.payment.status || "pending"] || STATUS_PILL.pending;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("paymentDetail.title")}
      subtitle={headerSubtitle}
      width={640}
      headerExtra={
        data ? (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
            {t(`status.${statusKey}`)}
          </span>
        ) : null
      }
    >
      {loading || !data ? (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : (
        <>
          {/* Amount summary strip */}
          <div
            className={`px-5 py-4 bg-[var(--color-surface-card)] border-b border-[var(--color-border-subtle)] flex items-baseline gap-6 ${
              isRTL ? "flex-row-reverse text-right" : ""
            }`}
          >
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                {t("paymentDetail.amount")}
              </p>
              <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5">
                <Money amount={Number(data.payment.amount)} decimals={2} iconSize={18} />
              </div>
            </div>
            {data.payment.paidAt && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t("paymentDetail.paidAt")}
                </p>
                <p className="text-sm text-[var(--color-text-primary)] mt-0.5">
                  {new Date(data.payment.paidAt).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
                </p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className={`px-5 pt-3 border-b border-[var(--color-border-subtle)] flex gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5 space-y-5">
            {activeTab === "overview" && (
              <>
                {/* Customer + Course */}
                <Card title={t("paymentDetail.customerCourse")} icon={<User className="w-4 h-4" />} isRTL={isRTL}>
                  <Row label={t("paymentDetail.customer")} value={data.payment.userName || "—"} isRTL={isRTL} />
                  <Row label={t("paymentDetail.email")} value={data.payment.userEmail || "—"} mono isRTL={isRTL} />
                  <Row
                    label={t("paymentDetail.course")}
                    value={
                      (locale === "ar" && data.payment.courseTitleAr) ||
                      data.payment.courseTitle ||
                      "—"
                    }
                    isRTL={isRTL}
                  />
                </Card>

                {/* Payment */}
                <Card title={t("paymentDetail.payment")} icon={<CreditCard className="w-4 h-4" />} isRTL={isRTL}>
                  <Row label={t("paymentDetail.gateway")} isRTL={isRTL}>
                    <span className={`inline-flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: gatewayColor(data.payment.gateway) }}
                      />
                      <span className="capitalize">{data.payment.gateway?.replace(/_/g, " ")}</span>
                    </span>
                  </Row>
                  <Row label={t("paymentDetail.method")} value={prettyMethod(data.payment.paymentMethod) || "—"} isRTL={isRTL} />
                  <Row label={t("paymentDetail.chargeId")} value={data.payment.gatewayChargeId || "—"} mono isRTL={isRTL} />
                  <Row
                    label={t("paymentDetail.created")}
                    value={new Date(data.payment.createdAt).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
                    isRTL={isRTL}
                  />
                  {data.payment.failureReason && (
                    <Row label={t("paymentDetail.failureReason")} isRTL={isRTL}>
                      <span className="text-[#DC2626]">
                        {data.payment.errorCode ? `${data.payment.errorCode}: ` : ""}
                        {data.payment.failureReason}
                      </span>
                    </Row>
                  )}
                </Card>

                {/* Linked Invoice */}
                <Card title={t("paymentDetail.invoice")} icon={<FileText className="w-4 h-4" />} isRTL={isRTL}>
                  {data.payment.invoiceId ? (
                    <Link
                      href={`/${locale}/dashboard/finance/invoices`}
                      className={`flex items-center justify-between gap-2 text-sm group ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {data.payment.invoiceNumber}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-secondary)] capitalize">
                          · {data.payment.invoiceStatus}
                        </span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />
                    </Link>
                  ) : (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t("paymentDetail.noInvoice")}
                    </p>
                  )}
                </Card>

                {/* Refunds */}
                {data.refunds.length > 0 && (
                  <Card
                    title={t("paymentDetail.refundsHistory", { count: data.refunds.length })}
                    icon={<RotateCcw className="w-4 h-4" />}
                    isRTL={isRTL}
                  >
                    <ul className="space-y-2">
                      {data.refunds.map((r) => (
                        <li
                          key={r.id}
                          className="p-2.5 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border-subtle)]"
                        >
                          <div className={`flex items-center justify-between gap-2 mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                              <Money amount={Number(r.amount)} decimals={2} iconSize={11} />
                            </span>
                            <span className={`text-[11px] font-medium capitalize ${
                              r.status === "approved" || r.status === "completed"
                                ? "text-[#16A34A]"
                                : r.status === "rejected"
                                  ? "text-[#DC2626]"
                                  : "text-[#D97706]"
                            }`}>
                              {r.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {r.reason}
                            {r.reasonNote && ` — ${r.reasonNote}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/${locale}/dashboard/finance/refunds`}
                      className={`inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--color-primary)] hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      {t("paymentDetail.viewRefunds")}
                      <ArrowIcon className="w-3 h-3" />
                    </Link>
                  </Card>
                )}

                {/* Bank Transfer Receipt */}
                {data.receipt && (
                  <Card title={t("paymentDetail.receipt")} icon={<Building2 className="w-4 h-4" />} isRTL={isRTL}>
                    <ReceiptPreview receipt={data.receipt} isRTL={isRTL} />
                  </Card>
                )}

                {/* Reconciliation finding */}
                {data.reconciliation && (
                  <Card title={t("paymentDetail.reconciliation")} icon={<Scale className="w-4 h-4" />} isRTL={isRTL}>
                    <Row label={t("paymentDetail.driftType")} isRTL={isRTL}>
                      <span className="capitalize">
                        {data.reconciliation.driftType.replace(/_/g, " ")}
                      </span>
                    </Row>
                    <Row label={t("paymentDetail.findingStatus")} isRTL={isRTL}>
                      <span className="capitalize">{data.reconciliation.status}</span>
                    </Row>
                    {data.reconciliation.escalationId && (
                      <Row label={t("paymentDetail.escalation")} isRTL={isRTL}>
                        <span className="capitalize">
                          {data.reconciliation.escalationStatus}
                          {data.reconciliation.escalationUrgency &&
                            ` · ${data.reconciliation.escalationUrgency}`}
                        </span>
                      </Row>
                    )}
                    <Link
                      href={`/${locale}/dashboard/finance/reconciliation`}
                      className={`inline-flex items-center gap-1 mt-1 text-xs font-medium text-[var(--color-primary)] hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      {t("paymentDetail.viewReconciliation")}
                      <ArrowIcon className="w-3 h-3" />
                    </Link>
                  </Card>
                )}
              </>
            )}

            {activeTab === "gateway" && (
              <GatewayResponseViewer
                gatewayResponse={data.payment.gatewayResponse as Record<string, unknown> | null}
                metadata={data.payment.metadata as Record<string, unknown> | null}
                gateway={data.payment.gateway}
              />
            )}

            {activeTab === "audit" && (
              <AuditTrail
                entries={audit}
                loading={auditLoading}
                isRTL={isRTL}
                locale={locale}
                t={t}
                onRefresh={fetchAudit}
              />
            )}
          </div>
        </>
      )}
    </Drawer>
  );
};

function Card({
  title,
  icon,
  children,
  isRTL,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isRTL: boolean;
}) {
  return (
    <section className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <header
        className={`px-4 py-2.5 border-b border-[var(--color-border-subtle)] flex items-center gap-2 text-[var(--color-text-primary)] ${
          isRTL ? "flex-row-reverse" : ""
        }`}
      >
        <span className="text-[var(--color-primary)]">{icon}</span>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider">{title}</h3>
      </header>
      <div className="p-4 space-y-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  isRTL,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  isRTL: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 text-sm ${isRTL ? "flex-row-reverse" : ""}`}>
      <dt className="text-[var(--color-text-secondary)] font-medium shrink-0">{label}</dt>
      <dd
        className={`text-[var(--color-text-primary)] break-all ${mono ? "font-mono text-xs" : ""} ${
          isRTL ? "text-left" : "text-right"
        }`}
      >
        {children ?? value}
      </dd>
    </div>
  );
}

function prettyMethod(method: string | null | undefined): string | null {
  if (!method) return null;
  const map: Record<string, string> = {
    card: "Card",
    mada: "Mada",
    applepay: "Apple Pay",
    apple_pay: "Apple Pay",
    samsungpay: "Samsung Pay",
    samsung_pay: "Samsung Pay",
    stcpay: "STC Pay",
    stc_pay: "STC Pay",
    bnpl: "BNPL",
    bank_transfer: "Bank Transfer",
  };
  return map[method.toLowerCase()] || method.replace(/_/g, " ");
}

function ScanPill({ status }: { status: string }) {
  const isClean = status === "clean";
  const isInfected = status === "infected";
  const Icon = isClean ? ShieldCheck : isInfected ? ShieldAlert : ShieldOff;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
        isClean
          ? `${FINANCE_COLORS.success.bg} ${FINANCE_COLORS.success.textDark}`
          : isInfected
            ? `${FINANCE_COLORS.error.bg} ${FINANCE_COLORS.error.textDark}`
            : `${FINANCE_COLORS.warning.bg} ${FINANCE_COLORS.warning.textDark}`
      }`}
    >
      <Icon className="w-3 h-3" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ReceiptPreview({
  receipt,
  isRTL,
}: {
  receipt: {
    id: string;
    fileName: string;
    mimeType?: string;
    fileSizeBytes?: number;
    scanStatus: string;
    reviewStatus: string;
    uploadedAt: string;
    downloadUrl?: string | null;
  };
  isRTL: boolean;
}) {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isImage = receipt.mimeType?.startsWith("image/");
  const fileSizeKB = receipt.fileSizeBytes ? Math.round(receipt.fileSizeBytes / 1024) : null;

  return (
    <div className="space-y-3">
      {receipt.downloadUrl && isImage && (
        <a
          href={receipt.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative w-full h-48 rounded-lg overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-surface-page)] group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receipt.downloadUrl}
            alt={receipt.fileName}
            className="w-full h-full object-contain"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Eye className="w-6 h-6 text-white" />
          </div>
        </a>
      )}

      {receipt.downloadUrl && !isImage && (
        <a
          href={receipt.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-page)] hover:border-[var(--color-primary)] group ${
            isRTL ? "flex-row-reverse" : ""
          }`}
        >
          <div className={`flex items-center gap-2 min-w-0 ${isRTL ? "flex-row-reverse" : ""}`}>
            <FileText className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-primary)] truncate" dir="ltr">
                {receipt.fileName}
              </p>
              {fileSizeKB !== null && (
                <p className="text-[10px] text-[var(--color-text-secondary)]">
                  {fileSizeKB.toLocaleString("en-US")} KB
                </p>
              )}
            </div>
          </div>
          <Download className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] flex-shrink-0" />
        </a>
      )}

      {!receipt.downloadUrl && receipt.scanStatus !== "clean" && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-page)] text-xs text-[var(--color-text-secondary)]">
          <AlertCircle className="w-4 h-4 text-[#D97706]" />
          {t("paymentDetail.receiptUnavailable")}
        </div>
      )}

      <div className="space-y-1.5">
        <Row label={t("paymentDetail.fileName")} value={receipt.fileName} mono isRTL={isRTL} />
        <Row label={t("paymentDetail.scanStatus")} isRTL={isRTL}>
          <ScanPill status={receipt.scanStatus} />
        </Row>
        <Row label={t("paymentDetail.reviewStatus")} isRTL={isRTL}>
          <span className="capitalize">{receipt.reviewStatus}</span>
        </Row>
        <Row
          label={t("paymentDetail.uploadedAt")}
          value={new Date(receipt.uploadedAt).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
          isRTL={isRTL}
        />
      </div>
    </div>
  );
}

function prettyAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AuditTrail({
  entries,
  loading,
  isRTL,
  locale,
  t,
  onRefresh,
}: {
  entries: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    performedBy: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actorName?: string | null;
    actorEmail?: string | null;
  }>;
  loading: boolean;
  isRTL: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  onRefresh: () => void;
}) {
  return (
    <section className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <header
        className={`px-4 py-2.5 border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-2 text-[var(--color-text-primary)] ${
          isRTL ? "flex-row-reverse" : ""
        }`}
      >
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <Clock className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider">
            {t("paymentDetail.auditTrail")}
          </h3>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] disabled:opacity-40"
          aria-label="Refresh audit trail"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] py-3">
            {t("paymentDetail.noAudit")}
          </p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => {
              const note =
                (entry.metadata?.reviewerNote as string) ||
                (entry.metadata?.internalNote as string) ||
                (entry.metadata?.reason as string) ||
                null;
              return (
                <li
                  key={entry.id}
                  className={`relative ${isRTL ? "pr-4 border-r-2" : "pl-4 border-l-2"} border-[var(--color-border-subtle)]`}
                >
                  <span
                    className={`absolute top-1.5 ${isRTL ? "-right-[5px]" : "-left-[5px]"} w-2 h-2 rounded-full bg-[var(--color-primary)]`}
                  />
                  <div className={`flex items-baseline justify-between gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <p className="text-[12px] font-medium text-[var(--color-text-primary)]">
                      {prettyAction(entry.action)}
                    </p>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {entry.entityType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className={`text-[11px] text-[var(--color-text-secondary)] ${isRTL ? "text-right" : ""}`}>
                    {entry.actorName || t("paymentDetail.systemActor")} ·{" "}
                    {new Date(entry.createdAt).toLocaleString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US")}
                  </p>
                  {note && (
                    <p className="text-[11px] text-[var(--color-text-primary)] mt-1 px-2 py-1 bg-[var(--color-surface-page)] rounded">
                      {note}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

export default PaymentDetailDrawer;
