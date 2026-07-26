"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  User,
  BookOpen,
  CreditCard,
  RotateCcw,
  Clock,
  Download,
  RefreshCcw,
  Ban,
  Send,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Layers,
  FileText,
} from "lucide-react";
import Drawer from "./shared/Drawer";
import Money from "./shared/Money";
import AdminOverridePanel, { AdminOverrideAction } from "./shared/AdminOverridePanel";
import { useActorRole, useIsAdminActor } from "./shared/ActorRoleContext";
import { financePath } from "./shared/financeRoutes";
import { FINANCE_COLORS } from "./shared/financeColors";
import { invoiceApi, adminFinanceApi } from "@/lib/api";
import { sanitizeCustomerName } from "@/lib/customer-name";
import InvoiceLanguageDialog from "@/components/ui/InvoiceLanguageDialog";
import { useInvoiceLanguage } from "@/hooks/useInvoiceLanguage";

type Tab = "overview" | "items" | "audit" | "pdf";

interface InvoiceDetailDrawerProps {
  invoiceId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  paid: { bg: FINANCE_COLORS.success.bg, text: FINANCE_COLORS.success.textDark },
  issued: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.textDark },
  overdue: { bg: FINANCE_COLORS.warning.bg, text: FINANCE_COLORS.warning.textDark },
  refunded: { bg: FINANCE_COLORS.violet.bg, text: FINANCE_COLORS.violet.textDark },
  partially_refunded: { bg: FINANCE_COLORS.violet.bgSoft, text: FINANCE_COLORS.violet.textDark },
  cancelled: { bg: FINANCE_COLORS.slate.bg, text: FINANCE_COLORS.slate.textDark },
  draft: { bg: FINANCE_COLORS.slate.bg, text: FINANCE_COLORS.slate.textDark },
};

const InvoiceDetailDrawer = ({
  invoiceId,
  onClose,
  onChanged,
}: InvoiceDetailDrawerProps) => {
  const t = useTranslations("financeDashboard");
  const tAdmin = useTranslations("financeDashboard.adminOverride");
  const isAdmin = useIsAdminActor();
  const actorRole = useActorRole();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<Awaited<ReturnType<typeof invoiceApi.getDetail>> | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof invoiceApi.getAudit>>>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [actionState, setActionState] = useState<
    | null
    | { kind: "resend" | "regen" | "cancel"; status: "running" | "ok" | "err"; message?: string }
  >(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  // Tracks the last locale the admin regenerated with, so the PDF preview
  // shows what they just produced instead of always falling back to EN.
  const [previewLocale, setPreviewLocale] = useState<"en" | "ar">("en");

  const open = !!invoiceId;

  const fetchDetail = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setData(null);
    setPdfUrl(null);
    try {
      const res = await invoiceApi.getDetail(invoiceId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  const fetchAudit = useCallback(async () => {
    if (!invoiceId) return;
    setAuditLoading(true);
    try {
      const res = await invoiceApi.getAudit(invoiceId);
      setAudit(res || []);
    } catch {
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, [invoiceId]);

  const fetchPdf = useCallback(
    async (loc?: "en" | "ar") => {
      if (!invoiceId) return;
      setPdfLoading(true);
      try {
        const res = await invoiceApi.getPdfUrl(invoiceId, loc || previewLocale);
        setPdfUrl(res.url);
      } catch {
        setPdfUrl(null);
      } finally {
        setPdfLoading(false);
      }
    },
    [invoiceId, previewLocale],
  );

  useEffect(() => {
    if (invoiceId) {
      setActiveTab("overview");
      setShowCancel(false);
      setCancelReason("");
      setActionState(null);
      fetchDetail();
    }
  }, [invoiceId, fetchDetail]);

  useEffect(() => {
    if (invoiceId && activeTab === "audit") fetchAudit();
  }, [invoiceId, activeTab, fetchAudit]);

  useEffect(() => {
    if (invoiceId && activeTab === "pdf" && !pdfUrl) fetchPdf();
  }, [invoiceId, activeTab, pdfUrl, fetchPdf]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("invoiceDetail.tabs.overview") },
    { key: "items", label: t("invoiceDetail.tabs.items") },
    { key: "audit", label: t("invoiceDetail.tabs.audit") },
    { key: "pdf", label: t("invoiceDetail.tabs.pdf") },
  ];

  const headerSubtitle = data ? data.invoice.invoiceNumber : "";
  const status = data?.invoice.status || "issued";
  const statusStyle = STATUS_PILL[status] || STATUS_PILL.issued;

  const { dialogProps: langDialogProps, promptForLocale } = useInvoiceLanguage();

  const handleDownloadPdf = async () => {
    if (!invoiceId) return;
    const chosen = await promptForLocale();
    if (!chosen) return;
    try {
      const res = await invoiceApi.getPdfUrl(invoiceId, chosen);
      if (res.url) window.open(res.url, "_blank");
    } catch {
      setActionState({ kind: "regen", status: "err", message: t("invoiceDetail.errors.pdfDownload") });
    }
  };

  const handleResend = async () => {
    if (!invoiceId) return;
    const chosen = await promptForLocale();
    if (!chosen) return;
    setActionState({ kind: "resend", status: "running" });
    try {
      await invoiceApi.resend(invoiceId, chosen);
      setActionState({ kind: "resend", status: "ok" });
    } catch {
      setActionState({ kind: "resend", status: "err" });
    }
  };

  const handleRegen = async () => {
    if (!invoiceId) return;
    const chosen = await promptForLocale();
    if (!chosen) return;
    setActionState({ kind: "regen", status: "running" });
    try {
      await invoiceApi.regeneratePdf(invoiceId, chosen);
      setActionState({ kind: "regen", status: "ok" });
      // Remember which locale the admin just regenerated so the preview
      // renders it, not the stale EN default.
      setPreviewLocale(chosen);
      setPdfUrl(null);
      if (activeTab === "pdf") fetchPdf(chosen);
      onChanged?.();
    } catch {
      setActionState({ kind: "regen", status: "err" });
    }
  };

  const handleCancel = async () => {
    if (!invoiceId) return;
    if (cancelReason.trim().length < 4) return;
    setActionState({ kind: "cancel", status: "running" });
    try {
      await invoiceApi.cancel(invoiceId, cancelReason.trim());
      setActionState({ kind: "cancel", status: "ok" });
      setShowCancel(false);
      setCancelReason("");
      await fetchDetail();
      if (activeTab === "audit") fetchAudit();
      onChanged?.();
    } catch {
      setActionState({ kind: "cancel", status: "err" });
    }
  };

  const canCancel = data && status !== "cancelled" && status !== "refunded";

  // Small localisation helpers so the drawer never renders raw snake_case
  // slugs in the UI. Gateway brand names transliterate to Arabic in AR
  // mode (ميسر / تمارا / تابي) via `reportsPage.gatewayLabels.*` —
  // matching the rest of the finance surface — while descriptive labels
  // (bank_transfer, card, bnpl, refund reasons, status pills) translate
  // to Arabic phrases.
  const KNOWN_GATEWAYS = new Set(["moyasar", "tabby", "tamara", "bank_transfer"]);
  const KNOWN_METHODS = new Set(["card", "mada", "apple_pay", "bnpl", "bank_transfer"]);
  const gwLabel = (g: string | null | undefined) =>
    !g ? "—" : KNOWN_GATEWAYS.has(g) ? t(`reportsPage.gatewayLabels.${g}`) : g.replace(/_/g, " ");
  const methodLabel = (m: string | null | undefined) =>
    !m ? "—" : KNOWN_METHODS.has(m) ? t(`reportsPage.methodLabels.${m}`) : m.replace(/_/g, " ");
  const REFUND_STATUSES = new Set(["pending", "approved", "processing", "completed", "rejected", "failed"]);
  const REFUND_REASONS = new Set([
    "policy",
    "cancelled",
    "course_cancelled",
    "duplicate",
    "technical",
    "other",
    "description_mismatch",
    "wrong_course",
    "access_issue",
  ]);
  const refundStatusLabel = (s: string | null | undefined) =>
    !s ? "—" : REFUND_STATUSES.has(s) ? t(`refundsPage.statusLabels.${s}`) : s.replace(/_/g, " ");
  const refundReasonLabel = (r: string | null | undefined) =>
    !r ? "" : REFUND_REASONS.has(r) ? t(`refundsPage.reasonLabels.${r}`) : r.replace(/_/g, " ");
  const INVOICE_STATUSES = new Set(["draft", "issued", "paid", "overdue", "refunded", "partially_refunded", "cancelled"]);
  const invoiceStatusLabel = (s: string | null | undefined) => {
    if (!s) return "—";
    if (!INVOICE_STATUSES.has(s)) return s.replace(/_/g, " ");
    const key = `invoiceDetail.statusLabels.${s}` as const;
    // Falls back to the raw slug if the key is not defined in the messages.
    const localised = t(key);
    if (localised === key || localised.includes("invoiceDetail.statusLabels.")) return s.replace(/_/g, " ");
    return localised;
  };

  const adminActions: AdminOverrideAction[] = invoiceId
    ? [
        {
          key: "resend-email",
          label: tAdmin("invoice.resendEmail"),
          description: tAdmin("invoice.resendEmailDesc"),
          successToast: tAdmin("invoice.resendEmailToast"),
          run: async (reason) => {
            const chosen = await promptForLocale();
            if (!chosen) throw new Error("cancelled");
            return adminFinanceApi.resendInvoiceEmail(invoiceId, {
              reason,
              locale: chosen,
            });
          },
        },
        {
          key: "regenerate-pdf",
          label: tAdmin("invoice.regeneratePdf"),
          description: tAdmin("invoice.regeneratePdfDesc"),
          successToast: tAdmin("invoice.regeneratePdfToast"),
          run: async (reason) => {
            const chosen = await promptForLocale();
            if (!chosen) throw new Error("cancelled");
            const result = await adminFinanceApi.regenerateInvoicePdf(
              invoiceId,
              { reason, locale: chosen },
            );
            // Sync the preview to what the admin just produced.
            setPreviewLocale(chosen);
            setPdfUrl(null);
            if (activeTab === "pdf") fetchPdf(chosen);
            return result;
          },
        },
        {
          key: "force-cancel",
          label: tAdmin("invoice.forceCancel"),
          description: tAdmin("invoice.forceCancelDesc"),
          danger: true,
          successToast: tAdmin("invoice.forceCancelToast"),
          run: (reason) => adminFinanceApi.forceCancelInvoice(invoiceId, { reason }),
        },
      ]
    : [];

  return (
    <>
    <Drawer
      open={open}
      onClose={onClose}
      title={t("invoiceDetail.title")}
      subtitle={headerSubtitle}
      width={680}
      headerExtra={
        data ? (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
            {invoiceStatusLabel(status)}
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
          {/* Amount strip — natural flex order lays the first cell on the
              start edge (LEFT in LTR, RIGHT in RTL via cascade). */}
          <div className="px-5 py-4 bg-[var(--color-surface-card)] border-b border-[var(--color-border-subtle)] flex items-baseline gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                {t("invoiceDetail.total")}
              </p>
              <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5">
                <Money amount={Number(data.invoice.totalAmount)} decimals={2} iconSize={18} />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                {t("invoiceDetail.issued")}
              </p>
              <p className="text-sm text-[var(--color-text-primary)] mt-0.5">
                {new Date(data.invoice.issuedAt).toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
            {data.invoice.paidAt && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t("invoiceDetail.paid")}
                </p>
                <p className="text-sm text-[var(--color-text-primary)] mt-0.5">
                  {new Date(data.invoice.paidAt).toLocaleDateString(locale === "ar" ? "ar-SA-u-nu-latn" : "en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Quick actions bar */}
          <div
            className={`px-5 py-2.5 bg-[var(--color-surface-page)] border-b border-[var(--color-border-subtle)] flex flex-wrap gap-2 ${
              isRTL ? "flex-row-reverse" : ""
            }`}
          >
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-page)] text-[var(--color-text-primary)]"
            >
              <Download className="w-3.5 h-3.5" />
              {t("invoiceDetail.actions.downloadPdf")}
            </button>
            <button
              onClick={handleResend}
              disabled={actionState?.kind === "resend" && actionState.status === "running"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-page)] text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {actionState?.kind === "resend" && actionState.status === "running" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {t("invoiceDetail.actions.resend")}
            </button>
            <button
              onClick={handleRegen}
              disabled={actionState?.kind === "regen" && actionState.status === "running"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] bg-[var(--color-surface-card)] hover:bg-[var(--color-surface-page)] text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {actionState?.kind === "regen" && actionState.status === "running" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="w-3.5 h-3.5" />
              )}
              {t("invoiceDetail.actions.regenPdf")}
            </button>
            {canCancel && (
              <button
                onClick={() => setShowCancel((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#FECACA] bg-white hover:bg-[#FEF2F2] text-[#DC2626]"
              >
                <Ban className="w-3.5 h-3.5" />
                {t("invoiceDetail.actions.cancel")}
              </button>
            )}
          </div>

          {/* Inline action feedback */}
          {actionState && actionState.status !== "running" && (
            <div
              className={`mx-5 mt-2 px-3 py-2 text-xs rounded-md border flex items-start gap-2 ${
                actionState.status === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {actionState.status === "ok" ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 mt-0.5" />
              )}
              <span>
                {actionState.status === "ok"
                  ? t(`invoiceDetail.feedback.${actionState.kind}.ok`)
                  : actionState.message || t(`invoiceDetail.feedback.${actionState.kind}.err`)}
              </span>
            </div>
          )}

          {/* Cancel confirmation */}
          {showCancel && (
            <div className="mx-5 mt-3 px-3 py-3 border border-[#FECACA] bg-[#FEF2F2] rounded-md space-y-2">
              <p className="text-xs font-semibold text-[#991B1B]">
                {t("invoiceDetail.cancelConfirm.title")}
              </p>
              <p className="text-[11px] text-[#7F1D1D]">
                {t("invoiceDetail.cancelConfirm.warning")}
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t("invoiceDetail.cancelConfirm.reasonPlaceholder")}
                rows={2}
                className="w-full text-xs px-2 py-1.5 border border-[#FECACA] rounded bg-white focus:outline-none focus:border-[#DC2626]"
              />
              <div className={`flex gap-2 ${isRTL ? "flex-row-reverse" : "justify-end"}`}>
                <button
                  onClick={() => { setShowCancel(false); setCancelReason(""); }}
                  className="px-3 py-1 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                >
                  {t("invoiceDetail.cancelConfirm.back")}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelReason.trim().length < 4 || actionState?.status === "running"}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-[#DC2626] text-white disabled:opacity-50"
                >
                  {actionState?.kind === "cancel" && actionState.status === "running"
                    ? t("invoiceDetail.cancelConfirm.running")
                    : t("invoiceDetail.cancelConfirm.confirm")}
                </button>
              </div>
            </div>
          )}

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

          <div className="p-5 space-y-5">
            {activeTab === "overview" && (
              <>
                <Card title={t("invoiceDetail.buyer")} icon={<User className="w-4 h-4" />} isRTL={isRTL}>
                  <Row
                    label={t("invoiceDetail.name")}
                    value={sanitizeCustomerName(data.buyer.name, data.buyer.email)}
                    isRTL={isRTL}
                  />
                  <Row label={t("invoiceDetail.email")} value={data.buyer.email || "—"} mono isRTL={isRTL} />
                  {/* National ID intentionally hidden — sensitive PII, kept on the
                      underlying invoice record for audit but never rendered here. */}
                </Card>

                <Card title={t("invoiceDetail.course")} icon={<BookOpen className="w-4 h-4" />} isRTL={isRTL}>
                  <Row
                    label={t("invoiceDetail.title")}
                    value={(locale === "ar" && data.course.titleAr) || data.course.title || "—"}
                    isRTL={isRTL}
                  />
                </Card>

                <Card title={t("invoiceDetail.amounts")} icon={<Layers className="w-4 h-4" />} isRTL={isRTL}>
                  <AmountRow label={t("invoiceDetail.subtotal")} amount={Number(data.invoice.subtotal)} isRTL={isRTL} />
                  {Number(data.invoice.discountAmount) > 0 && (
                    <AmountRow label={t("invoiceDetail.discount")} amount={-Number(data.invoice.discountAmount)} isRTL={isRTL} />
                  )}
                  {Number(data.invoice.taxAmount) > 0 && (
                    <AmountRow label={t("invoiceDetail.vat")} amount={Number(data.invoice.taxAmount)} isRTL={isRTL} />
                  )}
                  <div className="border-t border-[var(--color-border-subtle)] pt-2 mt-1">
                    <AmountRow label={t("invoiceDetail.total")} amount={Number(data.invoice.totalAmount)} isRTL={isRTL} bold />
                  </div>
                </Card>

                <Card title={t("invoiceDetail.payment")} icon={<CreditCard className="w-4 h-4" />} isRTL={isRTL}>
                  <Row label={t("invoiceDetail.gateway")} value={gwLabel(data.payment.gateway)} isRTL={isRTL} />
                  <Row label={t("invoiceDetail.method")} value={methodLabel(data.payment.paymentMethod)} isRTL={isRTL} />
                  <Row label={t("invoiceDetail.chargeId")} value={data.payment.gatewayChargeId || "—"} mono isRTL={isRTL} />
                  <Link
                    href={financePath(actorRole, locale, "payments", { paymentId: data.payment.id })}
                    className={`inline-flex items-center gap-1 mt-1 text-xs font-medium text-[var(--color-primary)] hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
                  >
                    {t("invoiceDetail.openPayment")}
                    <ArrowIcon className="w-3 h-3" />
                  </Link>
                </Card>

                {data.refunds.length > 0 && (
                  <Card
                    title={t("invoiceDetail.refundsHistory", { count: data.refunds.length })}
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
                            <span className={`text-[11px] font-medium ${
                              r.status === "approved" || r.status === "completed"
                                ? "text-[#16A34A]"
                                : r.status === "rejected"
                                  ? "text-[#DC2626]"
                                  : "text-[#D97706]"
                            }`}>
                              {refundStatusLabel(r.status)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {refundReasonLabel(r.reason)}{r.reasonNote && ` — ${r.reasonNote}`}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={financePath(actorRole, locale, "refunds")}
                      className={`inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--color-primary)] hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      {t("invoiceDetail.openRefunds")}
                      <ArrowIcon className="w-3 h-3" />
                    </Link>
                  </Card>
                )}
              </>
            )}

            {activeTab === "items" && (
              <Card title={t("invoiceDetail.lineItems")} icon={<Layers className="w-4 h-4" />} isRTL={isRTL}>
                {data.lineItems.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("invoiceDetail.noLineItems")}</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border-subtle)]">
                    {data.lineItems.map((item, idx) => (
                      <li key={idx} className={`py-2.5 flex items-start justify-between gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {item.description}
                          </p>
                          {item.descriptionAr && (
                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5" dir="rtl">
                              {item.descriptionAr}
                            </p>
                          )}
                          {item.deliveryType && (
                            <p className="text-[10px] uppercase text-[var(--color-text-secondary)] mt-0.5">
                              {item.deliveryType}
                            </p>
                          )}
                        </div>
                        <div className="font-semibold text-sm text-[var(--color-text-primary)] shrink-0">
                          <Money amount={Number(item.amount)} decimals={2} iconSize={12} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
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

            {activeTab === "pdf" && (
              <Card title={t("invoiceDetail.pdfPreview")} icon={<FileText className="w-4 h-4" />} isRTL={isRTL}>
                {/* Locale toggle — flip preview between EN + AR without regenerating. */}
                <div className="flex items-center gap-1 mb-3">
                  {(["en", "ar"] as const).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        if (loc === previewLocale) return;
                        setPreviewLocale(loc);
                        setPdfUrl(null);
                        fetchPdf(loc);
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        previewLocale === loc
                          ? "bg-[var(--color-primary)] text-white"
                          : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {loc === "en" ? "EN" : "AR"}
                    </button>
                  ))}
                </div>
                {pdfLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                  </div>
                ) : !pdfUrl ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-6">
                    <AlertCircle className="w-4 h-4" />
                    {t("invoiceDetail.pdfUnavailable")}
                  </div>
                ) : (
                  <>
                    <iframe
                      src={pdfUrl}
                      title={data.invoice.invoiceNumber}
                      className="w-full h-[520px] rounded-md border border-[var(--color-border-subtle)] bg-white"
                    />
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {t("invoiceDetail.openInNewTab")}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </Card>
            )}

            {isAdmin && invoiceId && (
              <AdminOverridePanel
                actions={adminActions}
                onAfter={() => {
                  fetchDetail();
                  if (activeTab === "audit") fetchAudit();
                  if (activeTab === "pdf") {
                    setPdfUrl(null);
                    fetchPdf();
                  }
                  onChanged?.();
                }}
              />
            )}
          </div>

          {/* QR verify footer */}
          <div className={`px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] ${isRTL ? "flex-row-reverse" : ""}`}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t("invoiceDetail.verifyHint")}</span>
            <Link
              href={`/${locale}/verify-invoice/${data.invoice.invoiceNumber}`}
              target="_blank"
              className="text-[var(--color-primary)] hover:underline font-medium"
            >
              {data.invoice.invoiceNumber}
            </Link>
          </div>
        </>
      )}
    </Drawer>
    <InvoiceLanguageDialog {...langDialogProps} />
    </>
  );
};

function Card({
  title,
  icon,
  children,
  isRTL: _isRTL,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isRTL: boolean;
}) {
  // No manual flex-row-reverse: with `<html dir="rtl">` cascading the icon
  // lands on the start edge (RIGHT in RTL, LEFT in LTR) and the title next
  // to it, reading naturally. Argument kept for call-site compatibility.
  return (
    <section className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <header className="px-4 py-2.5 border-b border-[var(--color-border-subtle)] flex items-center gap-2 text-[var(--color-text-primary)]">
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
}: {
  label: string;
  value: string;
  mono?: boolean;
  isRTL: boolean;
}) {
  // No manual flex-row-reverse: with `dir="rtl"` cascading, dt lands on
  // the start edge (RIGHT in RTL) and dd on the end edge (LEFT). Wave-2's
  // flex-row-reverse defeated the cascade and rendered labels on the LEFT
  // column with values on the RIGHT, contradicting the RTL reading order.
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-[var(--color-text-secondary)] font-medium shrink-0">{label}</dt>
      <dd className={`text-[var(--color-text-primary)] break-all ${mono ? "font-mono text-xs" : ""} ${isRTL ? "text-left" : "text-right"}`}>
        {value}
      </dd>
    </div>
  );
}

function AmountRow({
  label,
  amount,
  isRTL: _isRTL,
  bold,
}: {
  label: string;
  amount: number;
  isRTL: boolean;
  bold?: boolean;
}) {
  // No manual flex-row-reverse: with `dir="rtl"` cascading, label lands on
  // start edge (RIGHT in RTL) and amount on end edge (LEFT).
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`${bold ? "text-sm font-semibold" : "text-xs"} text-[var(--color-text-${bold ? "primary" : "secondary"})]`}>
        {label}
      </span>
      <div className={`${bold ? "text-base font-bold" : "text-sm"} text-[var(--color-text-primary)]`}>
        <Money amount={amount} decimals={2} iconSize={bold ? 14 : 11} />
      </div>
    </div>
  );
}

function prettyAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
            {t("invoiceDetail.tabs.audit")}
          </h3>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] disabled:opacity-40"
          aria-label={t("invoiceDetail.refreshAudit")}
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
          <p className="text-xs text-[var(--color-text-secondary)] py-3">{t("invoiceDetail.noAudit")}</p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => {
              const note =
                (entry.metadata?.reason as string) ||
                (entry.metadata?.reviewerNote as string) ||
                (entry.metadata?.internalNote as string) ||
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
                    {entry.actorName || t("invoiceDetail.systemActor")} ·{" "}
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

export default InvoiceDetailDrawer;
