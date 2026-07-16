"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ShieldAlert,
  Loader2,
  ArrowLeft,
  Check,
  X,
  RotateCcw,
  Hand,
  User,
  CreditCard,
  AlertTriangle,
  UserPlus,
  Undo2,
  Search,
} from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import {
  escalationsApi,
  pointsAdminApi,
  ApiError,
  type ReconciliationEscalationDetail,
  type EscalationStatus,
  type EscalationUrgency,
  type AdminUserSearchResult,
} from "@/lib/api";

const STATUS_PILL: Record<EscalationStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-emerald-100 text-emerald-800",
  declined: "bg-slate-100 text-slate-700",
  sent_back: "bg-violet-100 text-violet-800",
};

const URGENCY_PILL: Record<EscalationUrgency, string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-red-100 text-red-700",
};

// Label lookup helpers — resolve dynamic keys under
// `adminDashboard.escalations.labels.*` at render time. Reused across
// EscalationsContent and EscalationDetailContent (same key namespace).
type LabelT = ReturnType<typeof useTranslations>;

function getStatusLabel(status: EscalationStatus, t: LabelT): string {
  return t(`labels.status.${status}`);
}

function getProposedActionLabel(action: string, t: LabelT): string {
  const has = t.has ? t.has(`labels.proposedAction.${action}`) : true;
  return has ? t(`labels.proposedAction.${action}`) : action;
}

function getDriftTypeLabel(driftType: string, t: LabelT): string {
  const has = t.has ? t.has(`labels.driftType.${driftType}`) : true;
  return has ? t(`labels.driftType.${driftType}`) : driftType;
}

function getUrgencyLabel(urgency: EscalationUrgency, t: LabelT): string {
  return t(`labels.urgency.${urgency}`);
}

export default function EscalationDetailContent({ escalationId }: { escalationId: string }) {
  const admin = useAdminProfile();
  const router = useRouter();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("adminDashboard.escalations");

  const [data, setData] = useState<ReconciliationEscalationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<
    "claim" | "send-back" | "close" | "enroll" | "refund" | null
  >(null);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [note, setNote] = useState("");

  // Enroll form state
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollStudentLabel, setEnrollStudentLabel] = useState("");
  const [enrollStudentSearch, setEnrollStudentSearch] = useState("");
  const [enrollStudentResults, setEnrollStudentResults] = useState<AdminUserSearchResult[]>([]);
  const [enrollStudentSearching, setEnrollStudentSearching] = useState(false);
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [enrollNote, setEnrollNote] = useState("");

  // Refund form state
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundNote, setRefundNote] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await escalationsApi.get(escalationId);
      setData(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("detail.toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [escalationId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaim = async () => {
    setActing("claim");
    try {
      await escalationsApi.claim(escalationId);
      toast.success(t("detail.toasts.claimed"));
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("detail.toasts.claimFailed"));
    } finally {
      setActing(null);
    }
  };

  const handleSendBack = async () => {
    if (note.trim().length < 10) {
      toast.error(t("detail.toasts.noteTooShort"));
      return;
    }
    setActing("send-back");
    try {
      await escalationsApi.sendBack(escalationId, note.trim());
      toast.success(t("detail.toasts.sentBack"));
      setSendBackOpen(false);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("detail.toasts.sendBackFailed"));
    } finally {
      setActing(null);
    }
  };

  const handleClose = async () => {
    if (note.trim().length < 10) {
      toast.error(t("detail.toasts.noteTooShort"));
      return;
    }
    setActing("close");
    try {
      await escalationsApi.close(escalationId, note.trim());
      toast.success(t("detail.toasts.closed"));
      setCloseOpen(false);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("detail.toasts.closeFailed"));
    } finally {
      setActing(null);
    }
  };

  // Debounced student search. We don't pull a separate library — small
  // 350ms inline debounce keeps the impl tight.
  useEffect(() => {
    if (!enrollOpen) return;
    const q = enrollStudentSearch.trim();
    if (q.length < 2) {
      setEnrollStudentResults([]);
      return;
    }
    setEnrollStudentSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await pointsAdminApi.searchUsers(q);
        setEnrollStudentResults(results.slice(0, 10));
      } catch {
        setEnrollStudentResults([]);
      } finally {
        setEnrollStudentSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [enrollStudentSearch, enrollOpen]);

  // Prefill enroll form when modal opens: if the finding already has a
  // linked payment, we know the studentId + courseId — use them. For
  // missing_local findings admin has to search.
  useEffect(() => {
    if (!enrollOpen || !data) return;
    if (data.customerId) {
      setEnrollStudentId(data.customerId);
      setEnrollStudentLabel(
        data.customerName || data.customerEmail || data.customerId,
      );
    }
    if (data.courseId) setEnrollCourseId(data.courseId);
  }, [enrollOpen, data]);

  useEffect(() => {
    if (!refundOpen || !data) return;
    if (data.paymentAmount) setRefundAmount(String(data.paymentAmount));
  }, [refundOpen, data]);

  const handleEnroll = async () => {
    if (!enrollStudentId || !enrollCourseId) {
      toast.error(t("detail.toasts.enrollValidationBoth"));
      return;
    }
    if (enrollNote.trim().length < 10) {
      toast.error(t("detail.toasts.noteTooShort"));
      return;
    }
    setActing("enroll");
    try {
      const result = await escalationsApi.enroll(escalationId, {
        studentId: enrollStudentId,
        courseId: enrollCourseId,
        note: enrollNote.trim(),
      });
      const parts = [t("detail.toasts.enrolled")];
      if (result.paymentCreated) parts.push(t("detail.toasts.paymentCreated"));
      else if (result.paymentFlipped) parts.push(t("detail.toasts.paymentFlipped"));
      if (result.receiptApproved) parts.push(t("detail.toasts.receiptApproved"));
      parts.push(t("detail.toasts.studentNotified"));
      toast.success(parts.join(" — "));
      setEnrollOpen(false);
      setEnrollStudentId("");
      setEnrollStudentLabel("");
      setEnrollStudentSearch("");
      setEnrollCourseId("");
      setEnrollNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("detail.toasts.enrollFailed"));
    } finally {
      setActing(null);
    }
  };

  const handleRefund = async () => {
    if (refundReason.trim().length === 0) {
      toast.error(t("detail.toasts.refundReasonRequired"));
      return;
    }
    if (refundNote.trim().length < 10) {
      toast.error(t("detail.toasts.noteTooShort"));
      return;
    }
    const amount = refundAmount ? Number(refundAmount) : undefined;
    if (refundAmount && (isNaN(amount as number) || (amount as number) <= 0)) {
      toast.error(t("detail.toasts.refundAmountInvalid"));
      return;
    }
    setActing("refund");
    try {
      const result = await escalationsApi.refund(escalationId, {
        amount,
        reason: refundReason.trim(),
        note: refundNote.trim(),
      });
      toast.success(
        result.gatewayRefundId
          ? t("detail.toasts.refundIssuedWithId", { id: result.gatewayRefundId.slice(0, 12) })
          : t("detail.toasts.refundIssued"),
      );
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      setRefundNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("detail.toasts.refundFailed"));
    } finally {
      setActing(null);
    }
  };

  const canAct =
    data && (data.status === "pending" || data.status === "in_progress");

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
              <button
                onClick={() => router.push(`/${locale}/dashboard/admin/finance/escalations`)}
                className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("detail.backToList")}
              </button>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : !data ? (
                <div className="text-center py-16 text-[var(--color-text-secondary)]">
                  {t("detail.notFound")}
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-5 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-5 h-5 text-violet-700" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_PILL[data.status]}`}
                            >
                              {getStatusLabel(data.status, t)}
                            </span>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${URGENCY_PILL[data.urgency]}`}
                            >
                              {getUrgencyLabel(data.urgency, t)} {t("detail.urgencySuffix")}
                            </span>
                            <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                              {data.id.slice(0, 8)}
                            </span>
                          </div>
                          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
                            {getDriftTypeLabel(data.driftType, t)} ·{" "}
                            {data.gateway}
                          </h1>
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            {t("detail.proposedActionLabel")}{" "}
                            <strong>
                              {getProposedActionLabel(data.proposedAction, t)}
                            </strong>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Context */}
                    <div className="lg:col-span-2 space-y-4">
                      {/* Customer + course */}
                      <Card title={t("detail.cards.customerCourse")} icon={<User className="w-4 h-4" />}>
                        <Row label={t("detail.cards.customerLabel")} value={data.customerName || data.customerEmail || "—"} isRTL={isRTL} />
                        <Row label={t("detail.cards.emailLabel")} value={data.customerEmail || "—"} mono isRTL={isRTL} />
                        <Row label={t("detail.cards.courseLabel")} value={data.courseTitle || "—"} isRTL={isRTL} />
                      </Card>

                      {/* Payment */}
                      <Card title={t("detail.cards.payment")} icon={<CreditCard className="w-4 h-4" />}>
                        <Row label={t("detail.cards.paymentIdLabel")} value={data.paymentId || "—"} mono isRTL={isRTL} />
                        <Row
                          label={t("detail.cards.amountLabel")}
                          value={
                            data.paymentAmount
                              ? `${data.paymentAmount} ${data.paymentCurrency || ""}`
                              : "—"
                          }
                          isRTL={isRTL}
                        />
                        <Row label={t("detail.cards.statusLabel")} value={data.paymentStatus || "—"} isRTL={isRTL} />
                        <Row label={t("detail.cards.gatewayLabel")} value={data.paymentGateway || data.gateway} isRTL={isRTL} />
                        <Row label={t("detail.cards.methodLabel")} value={data.paymentMethod || "—"} isRTL={isRTL} />
                        <Row label={t("detail.cards.gatewayChargeIdLabel")} value={data.gatewayChargeId || "—"} mono isRTL={isRTL} />
                        <Row
                          label={t("detail.cards.createdLabel")}
                          value={
                            data.paymentCreatedAt
                              ? new Date(data.paymentCreatedAt).toLocaleString(
                                  locale === "ar" ? "ar-SA" : "en-US",
                                )
                              : "—"
                          }
                          isRTL={isRTL}
                        />
                      </Card>

                      {/* Drift evidence */}
                      <Card title={t("detail.cards.driftEvidence")} icon={<AlertTriangle className="w-4 h-4" />}>
                        <div>
                          <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                            {t("detail.cards.ourValue")}
                          </div>
                          <pre className="bg-[var(--color-surface-page)] p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(data.ourValue, null, 2) || "null"}
                          </pre>
                        </div>
                        <div className="mt-3">
                          <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                            {t("detail.cards.gatewayValue")}
                          </div>
                          <pre className="bg-[var(--color-surface-page)] p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(data.gatewayValue, null, 2) || "null"}
                          </pre>
                        </div>
                      </Card>
                    </div>

                    {/* Right column — escalation + actions */}
                    <div className="space-y-4">
                      <Card title={t("detail.cards.financeEscalation")}>
                        <Row label={t("detail.cards.escalatedByLabel")} value={data.escalatedByName || t("detail.cards.escalatedByFallback")} isRTL={isRTL} />
                        <Row
                          label={t("detail.cards.atLabel")}
                          value={new Date(data.escalatedAt).toLocaleString(
                            locale === "ar" ? "ar-SA" : "en-US",
                          )}
                          isRTL={isRTL}
                        />
                        <div className="mt-3">
                          <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                            {t("detail.cards.noteLabel")}
                          </div>
                          <div className="text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-page)] p-3 rounded whitespace-pre-wrap">
                            {data.escalationNote}
                          </div>
                        </div>
                      </Card>

                      {data.status !== "pending" && (
                        <Card title={t("detail.cards.lifecycle")}>
                          {data.claimedByName && (
                            <>
                              <Row label={t("detail.cards.claimedByLabel")} value={data.claimedByName} isRTL={isRTL} />
                              <Row
                                label={t("detail.cards.claimedAtLabel")}
                                value={
                                  data.claimedAt
                                    ? new Date(data.claimedAt).toLocaleString(
                                        locale === "ar" ? "ar-SA" : "en-US",
                                      )
                                    : "—"
                                }
                                isRTL={isRTL}
                              />
                            </>
                          )}
                          {data.resolvedAt && (
                            <>
                              <Row label={t("detail.cards.resolvedByLabel")} value={data.resolvedByName || "—"} isRTL={isRTL} />
                              <Row
                                label={t("detail.cards.atLabel")}
                                value={new Date(data.resolvedAt).toLocaleString(
                                  locale === "ar" ? "ar-SA" : "en-US",
                                )}
                                isRTL={isRTL}
                              />
                              <Row label={t("detail.cards.actionTakenLabel")} value={data.actionTaken || "—"} isRTL={isRTL} />
                              {data.resolutionNote && (
                                <div className="mt-3">
                                  <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                                    {t("detail.cards.resolutionNoteLabel")}
                                  </div>
                                  <div className="text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-page)] p-3 rounded whitespace-pre-wrap">
                                    {data.resolutionNote}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </Card>
                      )}

                      {/* Action panel */}
                      {canAct && (
                        <Card title={t("detail.cards.actions")}>
                          {data.status === "pending" && (
                            <button
                              onClick={handleClaim}
                              disabled={acting !== null}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60 mb-2"
                            >
                              {acting === "claim" ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Hand className="w-4 h-4" />
                              )}
                              {t("detail.actions.claim")}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEnrollNote("");
                              setEnrollOpen(true);
                            }}
                            disabled={acting !== null}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 mb-2"
                          >
                            <UserPlus className="w-4 h-4" />
                            {t("detail.actions.enroll")}
                          </button>
                          <button
                            onClick={() => {
                              setRefundNote("");
                              setRefundReason("");
                              setRefundOpen(true);
                            }}
                            disabled={acting !== null || !data.paymentId}
                            title={
                              !data.paymentId
                                ? t("detail.actions.refundNoPaymentTitle")
                                : t("detail.actions.refundTitle")
                            }
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-60 mb-2"
                          >
                            <Undo2 className="w-4 h-4" />
                            {t("detail.actions.refund")}
                          </button>

                          <button
                            onClick={() => {
                              setNote("");
                              setSendBackOpen(true);
                            }}
                            disabled={acting !== null}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg disabled:opacity-60 mb-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            {t("detail.actions.sendBack")}
                          </button>
                          <button
                            onClick={() => {
                              setNote("");
                              setCloseOpen(true);
                            }}
                            disabled={acting !== null}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-page)] rounded-lg disabled:opacity-60"
                          >
                            <X className="w-4 h-4" />
                            {t("detail.actions.close")}
                          </button>
                        </Card>
                      )}

                      <Link
                        href={`/${locale}/dashboard/admin/finance`}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] block text-center"
                      >
                        {t("detail.openAdminFinance")}
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Send back modal */}
      {sendBackOpen && (
        <ActionModal
          title={t("detail.modals.sendBack.title")}
          subtitle={t("detail.modals.sendBack.subtitle")}
          icon={<RotateCcw className="w-5 h-5 text-violet-600" />}
          confirmLabel={t("detail.modals.sendBack.confirm")}
          confirmClass="bg-violet-600 hover:bg-violet-700"
          cancelLabel={t("detail.modals.cancel")}
          counterLabel={t("detail.modals.notesCounter", { count: note.length })}
          onClose={() => setSendBackOpen(false)}
          onConfirm={handleSendBack}
          note={note}
          setNote={setNote}
          notePlaceholder={t("detail.modals.sendBack.placeholder")}
          loading={acting === "send-back"}
        />
      )}

      {/* Close without action modal */}
      {closeOpen && (
        <ActionModal
          title={t("detail.modals.close.title")}
          subtitle={t("detail.modals.close.subtitle")}
          icon={<X className="w-5 h-5 text-[var(--color-text-secondary)]" />}
          confirmLabel={t("detail.modals.close.confirm")}
          confirmClass="bg-[var(--color-text-secondary)] hover:opacity-90"
          cancelLabel={t("detail.modals.cancel")}
          counterLabel={t("detail.modals.notesCounter", { count: note.length })}
          onClose={() => setCloseOpen(false)}
          onConfirm={handleClose}
          note={note}
          setNote={setNote}
          notePlaceholder={t("detail.modals.close.placeholder")}
          loading={acting === "close"}
        />
      )}

      {/* Enroll modal */}
      {enrollOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEnrollOpen(false)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <UserPlus className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-semibold">{t("detail.modals.enroll.title")}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("detail.modals.enroll.subtitle")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Student picker */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("detail.modals.enroll.studentLabel")} <span className="text-red-500">*</span>
                </label>
                {enrollStudentId ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-page)]">
                    <span className="text-sm">{enrollStudentLabel}</span>
                    <button
                      onClick={() => {
                        setEnrollStudentId("");
                        setEnrollStudentLabel("");
                        setEnrollStudentSearch("");
                        setEnrollStudentResults([]);
                      }}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-red-600"
                    >
                      {t("detail.modals.enroll.studentChange")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search
                        className={`absolute ${isRTL ? "right-2.5" : "left-2.5"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`}
                      />
                      <input
                        type="text"
                        value={enrollStudentSearch}
                        onChange={(e) => setEnrollStudentSearch(e.target.value)}
                        placeholder={t("detail.modals.enroll.studentSearchPlaceholder")}
                        className={`w-full ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]`}
                      />
                    </div>
                    {(enrollStudentSearching ||
                      enrollStudentResults.length > 0) && (
                      <div className="mt-1 border border-[var(--color-border)] rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                        {enrollStudentSearching ? (
                          <div className="p-2 text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t("detail.modals.enroll.searching")}
                          </div>
                        ) : (
                          enrollStudentResults.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => {
                                setEnrollStudentId(u.id);
                                setEnrollStudentLabel(
                                  `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                                    u.email,
                                );
                                setEnrollStudentSearch("");
                                setEnrollStudentResults([]);
                              }}
                              className={`w-full ${isRTL ? "text-right" : "text-left"} px-3 py-2 hover:bg-[var(--color-surface-page)] text-xs`}
                            >
                              <div className="font-medium">
                                {`${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                                  t("detail.modals.enroll.unknownName")}
                              </div>
                              <div className="text-[var(--color-text-secondary)]">
                                {u.email}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Course ID — kept as raw input for now, instructor list
                  picker can be added later if Amna asks. */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("detail.modals.enroll.courseIdLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={enrollCourseId}
                  onChange={(e) => setEnrollCourseId(e.target.value)}
                  placeholder={t("detail.modals.enroll.courseIdPlaceholder")}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
                />
                {!data?.courseId && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    {t("detail.modals.enroll.courseIdTip")}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("detail.modals.enroll.noteLabel")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={enrollNote}
                  onChange={(e) => setEnrollNote(e.target.value)}
                  rows={3}
                  placeholder={t("detail.modals.enroll.notePlaceholder")}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEnrollOpen(false)}
                disabled={acting === "enroll"}
                className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
              >
                {t("detail.modals.enroll.cancel")}
              </button>
              <button
                onClick={handleEnroll}
                disabled={
                  acting === "enroll" ||
                  !enrollStudentId ||
                  !enrollCourseId ||
                  enrollNote.trim().length < 10
                }
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {acting === "enroll" && <Loader2 className="w-4 h-4 animate-spin" />}
                <UserPlus className="w-4 h-4" />
                {t("detail.modals.enroll.submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {refundOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setRefundOpen(false)}
        >
          <div
            className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <Undo2 className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-semibold">{t("detail.modals.refund.title")}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("detail.modals.refund.subtitle")}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("detail.modals.refund.amountLabel", { currency: data?.paymentCurrency || "SAR" })}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={data?.paymentAmount || undefined}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={t("detail.modals.refund.amountPlaceholder", { amount: data?.paymentAmount ?? "—" })}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  {t("detail.modals.refund.amountHelp", {
                    amount: data?.paymentAmount ?? "—",
                    currency: data?.paymentCurrency || "",
                  })}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("detail.modals.refund.reasonLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder={t("detail.modals.refund.reasonPlaceholder")}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("detail.modals.refund.noteLabel")} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  rows={3}
                  placeholder={t("detail.modals.refund.notePlaceholder")}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRefundOpen(false)}
                disabled={acting === "refund"}
                className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
              >
                {t("detail.modals.refund.cancel")}
              </button>
              <button
                onClick={handleRefund}
                disabled={
                  acting === "refund" ||
                  refundReason.trim().length === 0 ||
                  refundNote.trim().length < 10
                }
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-60 flex items-center gap-2"
              >
                {acting === "refund" && <Loader2 className="w-4 h-4 animate-spin" />}
                <Undo2 className="w-4 h-4" />
                {t("detail.modals.refund.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
  /** Accepted for call-site symmetry; logical `text-end` already flips per dir. */
  isRTL?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <dt className="text-[var(--color-text-secondary)] font-medium shrink-0">{label}</dt>
      <dd
        className={`text-[var(--color-text-primary)] text-end break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function ActionModal({
  title,
  subtitle,
  icon,
  confirmLabel,
  confirmClass,
  cancelLabel,
  counterLabel,
  onClose,
  onConfirm,
  note,
  setNote,
  notePlaceholder,
  loading,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  confirmLabel: string;
  confirmClass: string;
  cancelLabel: string;
  counterLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  note: string;
  setNote: (n: string) => void;
  notePlaceholder: string;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {icon}
          <div className="flex-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{subtitle}</p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder={notePlaceholder}
          className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
        />
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">{counterLabel}</div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || note.trim().length < 10}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 flex items-center gap-2 ${confirmClass}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Check className="w-4 h-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
