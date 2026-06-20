"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";
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

const STATUS_LABEL: Record<EscalationStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
  declined: "Declined",
  sent_back: "Sent back",
};

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

const PROPOSED_ACTION_LABEL: Record<string, string> = {
  enroll: "Manual enrollment",
  refund: "Issue refund",
  investigate: "Investigate",
  other: "Other",
  system_inferred: "System-inferred",
};

const DRIFT_TYPE_LABEL: Record<string, string> = {
  missing_local: "Missing locally",
  missing_gateway: "Missing on gateway",
  amount_mismatch: "Amount mismatch",
  status_mismatch: "Status mismatch",
  stuck_pending: "Stuck pending",
  stuck_approval: "Stuck approval",
  orphan_receipt: "Orphan receipt",
  paid_no_receipt: "Paid, no receipt",
};

export default function EscalationDetailContent({ escalationId }: { escalationId: string }) {
  const admin = useAdminProfile();
  const router = useRouter();
  const locale = useLocale();

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
      toast.error(err instanceof ApiError ? err.message : "Failed to load escalation");
    } finally {
      setLoading(false);
    }
  }, [escalationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaim = async () => {
    setActing("claim");
    try {
      await escalationsApi.claim(escalationId);
      toast.success("Claimed — you own this escalation now");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to claim");
    } finally {
      setActing(null);
    }
  };

  const handleSendBack = async () => {
    if (note.trim().length < 10) {
      toast.error("Note must be at least 10 characters");
      return;
    }
    setActing("send-back");
    try {
      await escalationsApi.sendBack(escalationId, note.trim());
      toast.success("Sent back to finance");
      setSendBackOpen(false);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send back");
    } finally {
      setActing(null);
    }
  };

  const handleClose = async () => {
    if (note.trim().length < 10) {
      toast.error("Note must be at least 10 characters");
      return;
    }
    setActing("close");
    try {
      await escalationsApi.close(escalationId, note.trim());
      toast.success("Escalation closed (no action)");
      setCloseOpen(false);
      setNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to close");
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
      toast.error("Both student and course are required");
      return;
    }
    if (enrollNote.trim().length < 10) {
      toast.error("Note must be at least 10 characters");
      return;
    }
    setActing("enroll");
    try {
      const result = await escalationsApi.enroll(escalationId, {
        studentId: enrollStudentId,
        courseId: enrollCourseId,
        note: enrollNote.trim(),
      });
      toast.success(
        result.paymentCreated
          ? "Enrolled — payment row created + student notified"
          : "Enrolled — student notified",
      );
      setEnrollOpen(false);
      setEnrollStudentId("");
      setEnrollStudentLabel("");
      setEnrollStudentSearch("");
      setEnrollCourseId("");
      setEnrollNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to enroll");
    } finally {
      setActing(null);
    }
  };

  const handleRefund = async () => {
    if (refundReason.trim().length === 0) {
      toast.error("Refund reason is required");
      return;
    }
    if (refundNote.trim().length < 10) {
      toast.error("Note must be at least 10 characters");
      return;
    }
    const amount = refundAmount ? Number(refundAmount) : undefined;
    if (refundAmount && (isNaN(amount as number) || (amount as number) <= 0)) {
      toast.error("Refund amount must be a positive number");
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
          ? `Refund issued — gateway refund ${result.gatewayRefundId.slice(0, 12)}`
          : "Refund issued",
      );
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
      setRefundNote("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to refund");
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

            <div className="flex-1 min-w-0">
              <button
                onClick={() => router.push(`/${locale}/dashboard/admin/finance/escalations`)}
                className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to escalations
              </button>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : !data ? (
                <div className="text-center py-16 text-[var(--color-text-secondary)]">
                  Escalation not found.
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
                              {STATUS_LABEL[data.status]}
                            </span>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${URGENCY_PILL[data.urgency]}`}
                            >
                              {data.urgency} urgency
                            </span>
                            <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                              {data.id.slice(0, 8)}
                            </span>
                          </div>
                          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
                            {DRIFT_TYPE_LABEL[data.driftType] || data.driftType} ·{" "}
                            {data.gateway}
                          </h1>
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                            Proposed action:{" "}
                            <strong>
                              {PROPOSED_ACTION_LABEL[data.proposedAction] ||
                                data.proposedAction}
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
                      <Card title="Customer & course" icon={<User className="w-4 h-4" />}>
                        <Row label="Customer" value={data.customerName || data.customerEmail || "—"} />
                        <Row label="Email" value={data.customerEmail || "—"} mono />
                        <Row label="Course" value={data.courseTitle || "—"} />
                      </Card>

                      {/* Payment */}
                      <Card title="Payment" icon={<CreditCard className="w-4 h-4" />}>
                        <Row label="Payment ID" value={data.paymentId || "—"} mono />
                        <Row
                          label="Amount"
                          value={
                            data.paymentAmount
                              ? `${data.paymentAmount} ${data.paymentCurrency || ""}`
                              : "—"
                          }
                        />
                        <Row label="Status" value={data.paymentStatus || "—"} />
                        <Row label="Gateway" value={data.paymentGateway || data.gateway} />
                        <Row label="Method" value={data.paymentMethod || "—"} />
                        <Row label="Gateway charge ID" value={data.gatewayChargeId || "—"} mono />
                        <Row
                          label="Created"
                          value={
                            data.paymentCreatedAt
                              ? new Date(data.paymentCreatedAt).toLocaleString(
                                  locale === "ar" ? "ar-SA" : "en-US",
                                )
                              : "—"
                          }
                        />
                      </Card>

                      {/* Drift evidence */}
                      <Card title="Drift evidence" icon={<AlertTriangle className="w-4 h-4" />}>
                        <div>
                          <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                            Our value
                          </div>
                          <pre className="bg-[var(--color-surface-page)] p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(data.ourValue, null, 2) || "null"}
                          </pre>
                        </div>
                        <div className="mt-3">
                          <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                            Gateway value
                          </div>
                          <pre className="bg-[var(--color-surface-page)] p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(data.gatewayValue, null, 2) || "null"}
                          </pre>
                        </div>
                      </Card>
                    </div>

                    {/* Right column — escalation + actions */}
                    <div className="space-y-4">
                      <Card title="Finance's escalation">
                        <Row label="Escalated by" value={data.escalatedByName || "System (cron)"} />
                        <Row
                          label="At"
                          value={new Date(data.escalatedAt).toLocaleString(
                            locale === "ar" ? "ar-SA" : "en-US",
                          )}
                        />
                        <div className="mt-3">
                          <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                            Note
                          </div>
                          <div className="text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-page)] p-3 rounded whitespace-pre-wrap">
                            {data.escalationNote}
                          </div>
                        </div>
                      </Card>

                      {data.status !== "pending" && (
                        <Card title="Lifecycle">
                          {data.claimedByName && (
                            <>
                              <Row label="Claimed by" value={data.claimedByName} />
                              <Row
                                label="Claimed at"
                                value={
                                  data.claimedAt
                                    ? new Date(data.claimedAt).toLocaleString(
                                        locale === "ar" ? "ar-SA" : "en-US",
                                      )
                                    : "—"
                                }
                              />
                            </>
                          )}
                          {data.resolvedAt && (
                            <>
                              <Row label="Resolved by" value={data.resolvedByName || "—"} />
                              <Row
                                label="At"
                                value={new Date(data.resolvedAt).toLocaleString(
                                  locale === "ar" ? "ar-SA" : "en-US",
                                )}
                              />
                              <Row label="Action taken" value={data.actionTaken || "—"} />
                              {data.resolutionNote && (
                                <div className="mt-3">
                                  <div className="text-xs text-[var(--color-text-secondary)] font-medium mb-1">
                                    Resolution note
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
                        <Card title="Actions">
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
                              Claim this escalation
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
                            Enroll student
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
                                ? "No payment linked — use Enroll instead, or close as no-action."
                                : "Issue a refund through the gateway"
                            }
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-60 mb-2"
                          >
                            <Undo2 className="w-4 h-4" />
                            Issue refund
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
                            Send back to finance
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
                            Close without action
                          </button>
                        </Card>
                      )}

                      <Link
                        href={`/${locale}/dashboard/admin/finance`}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] block text-center"
                      >
                        Open admin finance dashboard →
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
          title="Send back to finance"
          subtitle="Tell finance what more info you need. The underlying finding will unlock so they can act again."
          icon={<RotateCcw className="w-5 h-5 text-violet-600" />}
          confirmLabel="Send back"
          confirmClass="bg-violet-600 hover:bg-violet-700"
          onClose={() => setSendBackOpen(false)}
          onConfirm={handleSendBack}
          note={note}
          setNote={setNote}
          notePlaceholder="Required (≥10 chars) — what's missing?"
          loading={acting === "send-back"}
        />
      )}

      {/* Close without action modal */}
      {closeOpen && (
        <ActionModal
          title="Close without action"
          subtitle="Use when this escalation truly needs no action — finance confirmed it's a duplicate, test data, or out of scope."
          icon={<X className="w-5 h-5 text-[var(--color-text-secondary)]" />}
          confirmLabel="Close"
          confirmClass="bg-[var(--color-text-secondary)] hover:opacity-90"
          onClose={() => setCloseOpen(false)}
          onConfirm={handleClose}
          note={note}
          setNote={setNote}
          notePlaceholder="Required (≥10 chars) — why this needs no action."
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
                <h3 className="text-base font-semibold">Enroll student</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Atomically creates the payment row (if missing), enrolls the student, sends them a confirmation email, and closes this escalation.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Student picker */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Student <span className="text-red-500">*</span>
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
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                      <input
                        type="text"
                        value={enrollStudentSearch}
                        onChange={(e) => setEnrollStudentSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full pl-9 pr-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                      />
                    </div>
                    {(enrollStudentSearching ||
                      enrollStudentResults.length > 0) && (
                      <div className="mt-1 border border-[var(--color-border)] rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                        {enrollStudentSearching ? (
                          <div className="p-2 text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Searching…
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
                              className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-page)] text-xs"
                            >
                              <div className="font-medium">
                                {`${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                                  "—"}
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
                  Course ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={enrollCourseId}
                  onChange={(e) => setEnrollCourseId(e.target.value)}
                  placeholder="Paste course UUID"
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--color-primary)]"
                />
                {!data?.courseId && (
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                    Tip: for missing_local findings, the courseId is usually in the gateway metadata — check the drift evidence panel.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Internal note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={enrollNote}
                  onChange={(e) => setEnrollNote(e.target.value)}
                  rows={3}
                  placeholder="Required (≥10 chars) — captured in the audit log."
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
                Cancel
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
                Enroll
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
                <h3 className="text-base font-semibold">Issue refund</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  Calls the gateway immediately. If the gateway succeeds, the escalation closes and the finding resolves. If the gateway fails, the refund row stays in APPROVED for retry from the Refunds page.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Amount ({data?.paymentCurrency || "SAR"})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={data?.paymentAmount || undefined}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={`Default: full payment (${data?.paymentAmount || "—"})`}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  Leave blank for a full refund of {data?.paymentAmount} {data?.paymentCurrency}.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. duplicate charge, customer dispute"
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Internal note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={refundNote}
                  onChange={(e) => setRefundNote(e.target.value)}
                  rows={3}
                  placeholder="Required (≥10 chars) — captured in the audit log."
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
                Cancel
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
                Issue refund
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <dt className="text-[var(--color-text-secondary)] font-medium shrink-0">{label}</dt>
      <dd
        className={`text-[var(--color-text-primary)] text-right break-all ${mono ? "font-mono text-xs" : ""}`}
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
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">{note.length}/10 minimum</div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] disabled:opacity-60"
          >
            Cancel
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
