"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { supportApi, uploadFormData } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useSupportOnlineStatus } from "@/hooks/useSupportOnlineStatus";
import { AdminSidebar, AdminNavbar } from "@/components/admin-dashboard";
import AdminMobileSidebar from "./AdminMobileSidebar";
import Select from "./Select";
import StudentSnapshotCard from "@/components/support-dashboard/StudentSnapshotCard";
import CsatReviewCard from "@/components/support-dashboard/CsatReviewCard";
import AboutThisStudentCard from "@/components/support-shared/AboutThisStudentCard";
import StudentTimelineCard from "@/components/support-dashboard/StudentTimelineCard";
import CertificateDetailsCard from "@/components/support-dashboard/CertificateDetailsCard";
import TrainerApplicationCard from "@/components/support-dashboard/TrainerApplicationCard";
import AttachmentChip, {
  type Attachment as ChipAttachment,
} from "@/components/support-dashboard/AttachmentChip";
import LinkifiedText from "@/components/support/LinkifiedText";
import AttachmentPreviewModal, {
  type PreviewableAttachment,
} from "@/components/support-dashboard/AttachmentPreviewModal";
import AttachmentAuditPanel from "@/components/support-dashboard/AttachmentAuditPanel";
import TicketGovernanceToolbar from "@/components/support-dashboard/TicketGovernanceToolbar";
import {
  ArrowLeft,
  Lock,
  Loader2,
  Paperclip,
  Send,
  AlertTriangle,
  Clock,
  User as UserIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// Admin-scoped ticket detail page.
//
// Key differences from the supervisor TicketDetailContent:
//   - All comments rendered READ-ONLY (admin sees both public replies
//     and internal notes, but doesn't participate in customer-facing
//     conversation).
//   - The composer is INTERNAL NOTES ONLY — no isInternal toggle, no
//     "Send Reply" path. Admin's role here is org-internal oversight,
//     not customer comms.
//   - Reassign dropdown lists both agents AND supervisors (admin can
//     route to either).
//   - Actions (reassign, status, priority, resolve, close, internal
//     note) all flow through the same service endpoints supervisors
//     use; audit logs naturally pick up the admin's user.id from JWT.

type TicketDetail = {
  id: string;
  referenceNumber: string | null;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string | null;
  attachmentUrl: string | null;
  attachments?: {
    id: string;
    url: string;
    filename: string | null;
    scanStatus?: "clean" | "pending" | "quarantined" | "unknown";
  }[];
  comments: {
    id: string;
    message: string;
    isStaffReply: boolean;
    isInternal: boolean;
    createdAt: string;
    userFirstName: string | null;
    userLastName: string | null;
    userRole?: "super_admin" | "admin" | "supervisor" | "agent" | "student" | null;
    attachments?: {
      id: string;
      url: string;
      filename: string | null;
      scanStatus?: "clean" | "pending" | "quarantined" | "unknown";
    }[];
  }[];
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  frtRemainingMinutes: number | null;
  ttrRemainingMinutes: number | null;
  slaBreachedFrt: boolean;
  slaBreachedTtr: boolean;
  slaPaused?: boolean;
  slaPausedReason?: "on_hold" | "off_hours" | null;
  isGuestTicket?: boolean;
  csatReview?: {
    score: number | null;
    comment: string | null;
    submittedAt: string | null;
    channel?: string | null;
  } | null;
  source?: string | null;
  aboutUserId?: string | null;
  aboutUser?: import("@/components/support-shared/AboutThisStudentCard").AboutUserData | null;
};

export default function AdminTicketDetailContent() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("adminDashboard.supportPage.ticketDetail");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const admin = useAdminProfile();
  // Drives the SLA card's "Paused" state so the timer doesn't appear
  // to have reset to a full target while business hours are closed.
  const { isOnline: supportOnline } = useSupportOnlineStatus();
  const ticketId = params?.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  // Preview modal for any attachment chip across the page.
  const [previewAttachment, setPreviewAttachment] =
    useState<PreviewableAttachment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [noteMessage, setNoteMessage] = useState("");
  const [reassignTo, setReassignTo] = useState("");

  type PendingAttachment = {
    id: string;
    file: File;
    status: "queued" | "uploading" | "done" | "error";
    url?: string;
  };
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reassign pool = all support users + supervisors. The /tickets/agents
  // endpoint returns the support roster; supervisors are flagged via
  // supportSubRole so we can label them in the dropdown.
  type AssignableUser = {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    supportSubRole: string | null;
  };
  const [assignablePool, setAssignablePool] = useState<AssignableUser[]>([]);

  // Admins always have download-log + soft-delete permissions.
  // Setting the flag explicitly so the value flows through the same
  // way it does on the support side.
  const canManageAttachments = true;

  // Preview modal opener — also fires the download audit so we know
  // who actually accessed the file content, not just who clicked
  // download.
  const handlePreview = (att: ChipAttachment) => {
    if (!ticketId) return;
    supportApi
      .recordAttachmentDownload(ticketId, att.url)
      .catch(() => {});
    setPreviewAttachment(att);
  };
  // Same hook for the non-previewable fallback (the chip lets the
  // browser navigate the storage URL).
  const handleDownload = (att: ChipAttachment) => {
    if (!ticketId) return;
    supportApi
      .recordAttachmentDownload(ticketId, att.url)
      .catch(() => {});
  };
  // Soft-delete — confirms inside the chip, then writes the deletion
  // and reloads the ticket so the chip drops out of the active list.
  const handleRemoveAttachment = async (att: ChipAttachment) => {
    if (!ticketId || !att.id) return;
    try {
      await supportApi.softDeleteAttachment(ticketId, att.id);
      const fresh = await supportApi.getTicket(ticketId);
      setTicket(fresh as TicketDetail);
      toast.success(t("attachmentRemovedToast"));
    } catch {
      toast.error(t("attachmentRemoveFailed"));
    }
  };

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      const data = await supportApi.getTicket(ticketId);
      setTicket(data as TicketDetail);
    } catch {
      toast.error(t("toasts.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, t]);

  useEffect(() => {
    setIsLoading(true);
    void fetchTicket();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchTicket();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchTicket]);

  useEffect(() => {
    supportApi
      .getAgents()
      .then((data) => setAssignablePool((data || []) as AssignableUser[]))
      .catch(() => {});
  }, []);

  async function handleSendNote() {
    if (!noteMessage.trim() || !ticketId) return;
    const anyUploading = pendingAttachments.some(
      (a) => a.status === "queued" || a.status === "uploading",
    );
    if (anyUploading) {
      toast.error(t("toasts.waitForUploads"));
      return;
    }
    setIsSending(true);
    try {
      const attachmentUrls = pendingAttachments
        .filter((a) => a.status === "done" && a.url)
        .map((a) => a.url!) as string[];
      // Always isInternal = true. Admin doesn't comment publicly to
      // customers from this surface.
      await supportApi.addComment(ticketId, {
        message: noteMessage.trim(),
        isInternal: true,
        attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      });
      setNoteMessage("");
      setPendingAttachments([]);
      await fetchTicket();
      toast.success(t("toasts.internalAdded"));
    } catch {
      toast.error(t("toasts.replyFailed"));
    } finally {
      setIsSending(false);
    }
  }

  async function uploadOne(att: PendingAttachment) {
    setPendingAttachments((curr) =>
      curr.map((a) =>
        a.id === att.id ? { ...a, status: "uploading" as const } : a,
      ),
    );
    try {
      const fd = new FormData();
      fd.append("file", att.file);
      // Goes through the shared API wrapper so the Bearer token is
      // attached and the request hits the backend origin directly
      // instead of an unrouted /api/storage/upload on the FE host.
      const data = await uploadFormData<{ url: string; filename: string }>(
        "/storage/upload",
        fd,
      );
      setPendingAttachments((curr) =>
        curr.map((a) =>
          a.id === att.id
            ? { ...a, status: "done" as const, url: data.url }
            : a,
        ),
      );
    } catch {
      setPendingAttachments((curr) =>
        curr.map((a) =>
          a.id === att.id ? { ...a, status: "error" as const } : a,
        ),
      );
    }
  }

  function handleFilesAdded(files: File[]) {
    const allowed = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    const maxBytes = 5 * 1024 * 1024;
    const accepted: PendingAttachment[] = [];
    for (const file of files) {
      if (pendingAttachments.length + accepted.length >= 10) break;
      if (!allowed.has(file.type)) continue;
      if (file.size > maxBytes) continue;
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        status: "queued",
      });
    }
    if (!accepted.length) return;
    setPendingAttachments((curr) => [...curr, ...accepted]);
    for (const a of accepted) void uploadOne(a);
  }

  async function handleReassign() {
    if (!reassignTo || !ticketId) return;
    setIsUpdating(true);
    try {
      await supportApi.updateTicket(ticketId, { assigneeId: reassignTo });
      setReassignTo("");
      await fetchTicket();
      toast.success(t("toasts.reassigned"));
    } catch {
      toast.error(t("toasts.actionFailed"));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!ticketId) return;
    setIsUpdating(true);
    try {
      if (newStatus === "resolved") {
        await supportApi.resolveTicket(ticketId);
      } else if (newStatus === "closed") {
        await supportApi.closeTicket(ticketId);
      } else {
        await supportApi.updateTicket(ticketId, { status: newStatus });
      }
      await fetchTicket();
      toast.success(t("toasts.statusChanged"));
    } catch {
      toast.error(t("toasts.actionFailed"));
    } finally {
      setIsUpdating(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    if (!ticketId) return;
    setIsUpdating(true);
    try {
      await supportApi.updateTicket(ticketId, { priority: newPriority });
      await fetchTicket();
      toast.success(t("toasts.priorityChanged"));
    } catch {
      toast.error(t("toasts.actionFailed"));
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center text-[var(--color-text-secondary)]">
        {t("notFound")}
      </div>
    );
  }

  const customerName =
    [ticket.studentFirstName, ticket.studentLastName]
      .filter(Boolean)
      .join(" ") || t("unknownCustomer");

  return (
    <>
      {/* Phase 2 — fullscreen ticket detail (no AdminNavbar/Sidebar). */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col gap-6">

            <div className="flex-1 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
              <button
                onClick={() =>
                  router.push(
                    `/${locale}/dashboard/admin/support?tab=tickets`,
                  )
                }
                className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("backToList")}
              </button>

              {/* Header */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <span className="text-xs text-[var(--color-primary)] font-semibold">
                      {ticket.referenceNumber || `#${ticket.id.slice(0, 8)}`}
                    </span>
                    <h1 className="text-xl font-bold text-[var(--color-text-primary)] mt-1">
                      {ticket.subject}
                    </h1>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <PriorityBadge priority={ticket.priority} t={t} />
                    <StatusBadge status={ticket.status} t={t} />
                    {(ticket.slaBreachedFrt || ticket.slaBreachedTtr) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
                        <AlertTriangle className="w-3 h-3" />
                        {t("slaBreached")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
                  <InfoRow
                    label={t("customer")}
                    value={customerName}
                    sub={ticket.studentEmail || undefined}
                  />
                  <InfoRow
                    label={t("categoryLabel")}
                    value={t(`category.${ticket.category}`)}
                  />
                  <InfoRow
                    label={t("created")}
                    value={new Date(ticket.createdAt).toLocaleString()}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main column — description + thread + internal note composer */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Governance toolbar — merge / transfer ticket. Admin is
                      treated as supervisor-equivalent for policy actions. */}
                  <TicketGovernanceToolbar
                    ticketId={ticket.id}
                    ticketCategory={ticket.category}
                    basePath={(() => {
                      if (typeof window === "undefined") return "";
                      const m = window.location.pathname.match(
                        /(.*\/admin\/support)/,
                      );
                      return m ? m[1] : "";
                    })()}
                    isSupervisor
                    onChanged={() => void fetchTicket()}
                  />
                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      {t("description")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed break-words">
                      <LinkifiedText text={ticket.description} />
                    </p>
                    <AttachmentChips
                      attachments={ticket.attachments}
                      legacyUrl={ticket.attachmentUrl}
                      t={t}
                      inChat
                      onPreview={handlePreview}
                      onDownload={handleDownload}
                      onRemove={handleRemoveAttachment}
                    />
                  </div>

                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                      {t("thread", { count: ticket.comments.length })}
                    </h3>
                    {ticket.comments.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
                        {t("noComments")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {ticket.comments.map((c) => (
                          <CommentBubble
                            key={c.id}
                            comment={c}
                            t={t}
                            onPreview={handlePreview}
                            onDownload={handleDownload}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Internal note composer */}
                  <div className="bg-[#FFFBEB] rounded-2xl border border-[#FDE68A] p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-[#D97706]" />
                      <span className="text-sm font-semibold text-[#7C2D12]">
                        {t("internalNoteTitle")}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#7C2D12] mb-3">
                      {t("internalNoteHint")}
                    </p>
                    <textarea
                      value={noteMessage}
                      onChange={(e) => setNoteMessage(e.target.value)}
                      rows={3}
                      placeholder={t("internalNotePlaceholder")}
                      className="w-full px-3 py-2 border border-[#FDE68A] bg-white rounded-lg text-sm resize-none focus:outline-none focus:border-[#D97706]"
                    />

                    {/* Multi-file picker */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-dashed border-[#FDE68A] rounded-lg text-xs text-[#7C2D12] hover:bg-[#FEF3C7]"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {t("attachFiles")}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        handleFilesAdded(Array.from(e.target.files || []));
                        if (e.target) e.target.value = "";
                      }}
                    />

                    {pendingAttachments.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {pendingAttachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-2 px-2 py-1.5 border border-[#FDE68A] bg-white rounded text-[11px]"
                          >
                            <Paperclip className="w-3 h-3 text-[#92400E]" />
                            <span className="truncate flex-1">
                              {att.file.name}
                            </span>
                            <span
                              className={
                                att.status === "done"
                                  ? "text-[#15803D]"
                                  : att.status === "error"
                                    ? "text-[#991B1B]"
                                    : "text-[#92400E]"
                              }
                            >
                              {att.status === "uploading"
                                ? t("attachmentUploading")
                                : att.status === "done"
                                  ? t("attachmentUploaded")
                                  : att.status === "error"
                                    ? t("attachmentFailed")
                                    : t("attachmentQueued")}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingAttachments((curr) =>
                                  curr.filter((a) => a.id !== att.id),
                                )
                              }
                              className="text-[#92400E] hover:text-[#991B1B]"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end mt-3">
                      <button
                        type="button"
                        onClick={handleSendNote}
                        disabled={!noteMessage.trim() || isSending}
                        className="flex items-center gap-2 px-4 py-2 bg-[#D97706] hover:bg-[#B45309] text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {t("addNote")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sidebar — action panel */}
                <div className="space-y-4">
                  {/* SLA card — shows a meaningful state per target:
                       breached / fulfilled (terminal) / X left (active)
                       / waiting (no policy or pre-business-hours). */}
                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                      {t("sla")}
                    </h3>
                    <SlaRow
                      label={t("firstResponse")}
                      remaining={ticket.frtRemainingMinutes}
                      breached={ticket.slaBreachedFrt}
                      isTerminal={
                        ticket.status === "resolved" ||
                        ticket.status === "closed"
                      }
                      paused={
                        ticket.slaPaused ??
                        (ticket.status === "on_hold" || supportOnline === false)
                      }
                      t={t}
                    />
                    <SlaRow
                      label={t("resolution")}
                      remaining={ticket.ttrRemainingMinutes}
                      breached={ticket.slaBreachedTtr}
                      isTerminal={
                        ticket.status === "resolved" ||
                        ticket.status === "closed"
                      }
                      paused={
                        ticket.slaPaused ??
                        (ticket.status === "on_hold" || supportOnline === false)
                      }
                      t={t}
                    />
                  </div>

                  {/* Reassign */}
                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      {t("assignee")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-primary)] mb-3">
                      {ticket.assigneeName || (
                        <span className="text-[#991B1B]">
                          {t("unassigned")}
                        </span>
                      )}
                    </p>
                    <Select
                      value={reassignTo}
                      onChange={(v) => setReassignTo(v)}
                      options={[
                        { value: "", label: t("pickAgent") },
                        ...assignablePool.map((u) => ({
                          value: u.userId,
                          label:
                            ([u.firstName, u.lastName]
                              .filter(Boolean)
                              .join(" ") || "Agent") +
                            (u.supportSubRole === "supervisor"
                              ? ` · ${t("supervisorBadge")}`
                              : ""),
                        })),
                      ]}
                    />
                    <button
                      type="button"
                      onClick={handleReassign}
                      disabled={!reassignTo || isUpdating}
                      className="w-full mt-2 px-3 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      {t("reassign")}
                    </button>
                  </div>

                  {/* Status */}
                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      {t("changeStatus")}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {validTransitions(ticket.status).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStatusChange(s)}
                          disabled={isUpdating}
                          className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                        >
                          {t(`statusActions.${s}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      {t("changePriority")}
                    </h3>
                    <div className="flex gap-2">
                      {(["high", "medium", "low"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePriorityChange(p)}
                          disabled={isUpdating || ticket.priority === p}
                          className={`flex-1 px-2 py-1.5 text-xs rounded-lg border disabled:opacity-50 ${
                            ticket.priority === p
                              ? "border-[var(--color-primary)] bg-[#EFF6FF] text-[var(--color-primary)]"
                              : "border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                          }`}
                        >
                          {t(`filters.priority.${p}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CSAT review — surfaced at the top of the rail so
                      admins reviewing a ticket immediately see the
                      customer's score and comment. */}
                  {ticket.csatReview && (
                    <CsatReviewCard
                      review={ticket.csatReview}
                      locale={locale}
                    />
                  )}

                  {/* About this student — populated when the ticket was
                      filed about a third party (instructor → support
                      follow-up). Mirrors the structured context block
                      already prepended to the description. */}
                  {ticket.aboutUser && (
                    <AboutThisStudentCard data={ticket.aboutUser} />
                  )}

                  {/* Student context — snapshot + timeline + cert/CME.
                      Ported from support-dashboard so admins handling
                      escalations see the same per-student detail as
                      agents. Hidden for guest tickets (no linked
                      student). */}
                  <StudentSnapshotCard
                    ticketId={ticket.id}
                    isGuestTicket={!!ticket.isGuestTicket}
                  />
                  <StudentTimelineCard
                    ticketId={ticket.id}
                    isGuestTicket={!!ticket.isGuestTicket}
                  />
                  <CertificateDetailsCard
                    ticketId={ticket.id}
                    ticketCategory={ticket.category}
                    isGuestTicket={!!ticket.isGuestTicket}
                  />
                  <TrainerApplicationCard
                    ticketId={ticket.id}
                    ticketCategory={ticket.category}
                    detailHref={(id) =>
                      `/${locale}/dashboard/admin/role-requests/${id}`
                    }
                  />
                  {/* Attachment audit — upload + removal timeline plus
                      the per-attachment download log. Admins always
                      see both halves. */}
                  <AttachmentAuditPanel
                    ticketId={ticket.id}
                    canSeeDownloadLog={canManageAttachments}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview modal — opened from any chip across the page,
          including header chips and chat-thread message chips. */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        onDownload={(att) => handleDownload(att)}
      />
    </>
  );
}

/* ─── helpers + sub-components ─── */

function validTransitions(current: string): string[] {
  const map: Record<string, string[]> = {
    new: ["in_progress"],
    in_progress: ["on_hold", "resolved", "closed"],
    on_hold: ["in_progress"],
    resolved: ["closed", "in_progress"],
    closed: ["in_progress"],
  };
  return map[current] || [];
}

function InfoRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">
        {label}
      </p>
      <p className="text-sm text-[var(--color-text-primary)]">{value}</p>
      {sub && (
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
          {sub}
        </p>
      )}
    </div>
  );
}

function SlaRow({
  label,
  remaining,
  breached,
  isTerminal,
  paused,
  t,
}: {
  label: string;
  remaining: number | null;
  breached: boolean;
  isTerminal: boolean;
  paused: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  // Compute display state in order of specificity so terminal+breached
  // stays "breached" (the more actionable label) and not "fulfilled".
  // "Paused" comes after breach/terminal but before the live countdown
  // — a paused timer with a known remaining value shows "Paused — Xm".
  let display: {
    text: string;
    tone: "neutral" | "success" | "danger" | "warning";
  };
  if (breached) {
    display = { text: t("breached"), tone: "danger" };
  } else if (isTerminal) {
    display = { text: t("slaFulfilled"), tone: "success" };
  } else if (
    paused &&
    remaining !== null &&
    remaining !== undefined &&
    remaining >= 0
  ) {
    display = {
      text: `${t("slaPaused")} — ${t("minutesLeft", { count: remaining })}`,
      tone: "neutral",
    };
  } else if (remaining === null || remaining === undefined) {
    display = { text: t("slaWaiting"), tone: "neutral" };
  } else {
    display = {
      text: t("minutesLeft", { count: Math.max(0, remaining) }),
      tone: remaining <= 30 ? "warning" : "neutral",
    };
  }
  const toneCls =
    display.tone === "danger"
      ? "text-[#991B1B]"
      : display.tone === "success"
        ? "text-[#15803D]"
        : display.tone === "warning"
          ? "text-[#92400E]"
          : "text-[var(--color-text-primary)]";
  return (
    <div className="flex items-center justify-between mb-2 last:mb-0">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${toneCls}`}>
        {display.text}
      </span>
    </div>
  );
}

function PriorityBadge({
  priority,
  t,
}: {
  priority: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const styles: Record<string, string> = {
    high: "text-[#991B1B] bg-[#FEE2E2] border-[#FCA5A5]",
    medium: "text-[#92400E] bg-[#FEF3C7] border-[#FDE68A]",
    low: "text-[#15803D] bg-[#DCFCE7] border-[#86EFAC]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border ${styles[priority] || "border-[var(--color-border)]"}`}
    >
      {t(`filters.priority.${priority}`)}
    </span>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const styles: Record<string, string> = {
    new: "text-[#1E40AF] bg-[#DBEAFE]",
    in_progress: "text-[#92400E] bg-[#FEF3C7]",
    on_hold: "text-[#6D28D9] bg-[#EDE9FE]",
    resolved: "text-[#15803D] bg-[#DCFCE7]",
    closed: "text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded ${styles[status] || ""}`}
    >
      {t(`filters.status.${status}`)}
    </span>
  );
}

function CommentBubble({
  comment,
  t,
  onPreview,
  onDownload,
}: {
  comment: TicketDetail["comments"][number];
  t: ReturnType<typeof useTranslations>;
  onPreview?: (att: ChipAttachment) => void;
  onDownload?: (att: ChipAttachment) => void;
}) {
  const authorName =
    [comment.userFirstName, comment.userLastName].filter(Boolean).join(" ") ||
    t("unknownAuthor");
  return (
    <div
      className={`rounded-xl border p-4 ${
        comment.isInternal
          ? "border-[#FDE68A] bg-[#FFFBEB]"
          : "border-[var(--color-border)] bg-[var(--color-surface-card)]"
      }`}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <UserIcon className="w-3 h-3 text-[var(--color-text-secondary)]" />
        <span className="text-xs font-medium text-[var(--color-text-primary)]">
          {authorName}
        </span>
        {comment.isStaffReply && !comment.isInternal && (
          <span className="text-[10px] text-[var(--color-primary)] bg-[#EFF6FF] px-1.5 py-0.5 rounded">
            {t("staffBadge")}
          </span>
        )}
        {comment.userRole && comment.userRole !== "student" && (
          <span className="text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-1.5 py-0.5 rounded uppercase tracking-wide">
            {t(`roleBadge.${comment.userRole}`)}
          </span>
        )}
        {comment.isInternal && (
          <span className="text-[10px] text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.5 rounded inline-flex items-center gap-1">
            <Lock className="w-3 h-3" />
            {t("internalBadge")}
          </span>
        )}
        <span className="ms-auto text-[10px] text-[var(--color-text-secondary)]">
          {new Date(comment.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
        <LinkifiedText text={comment.message} />
      </p>
      <AttachmentChips
        attachments={comment.attachments}
        t={t}
        inChat
        onPreview={onPreview}
        onDownload={onDownload}
      />
    </div>
  );
}

function AttachmentChips({
  attachments,
  legacyUrl,
  t,
  inChat = false,
  onPreview,
  onDownload,
  onRemove,
}: {
  attachments?: {
    id: string;
    url: string;
    filename: string | null;
    scanStatus?: "clean" | "pending" | "quarantined" | "unknown";
  }[];
  legacyUrl?: string | null;
  t: ReturnType<typeof useTranslations>;
  inChat?: boolean;
  onPreview?: (att: ChipAttachment) => void;
  onDownload?: (att: ChipAttachment) => void;
  onRemove?: (att: ChipAttachment) => void;
}) {
  const chips: ChipAttachment[] =
    attachments && attachments.length > 0
      ? attachments.map((a) => ({
          id: a.id,
          url: a.url,
          filename: a.filename ?? t("attachment"),
          mimeType: (a as { mimeType?: string | null }).mimeType ?? null,
          sizeBytes: (a as { sizeBytes?: number | null }).sizeBytes ?? null,
          scanStatus: a.scanStatus,
        }))
      : legacyUrl
        ? [
            {
              url: legacyUrl,
              filename: t("attachment"),
              scanStatus: "unknown" as const,
            },
          ]
        : [];
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((c) => (
        <AttachmentChip
          key={c.id ?? c.url}
          attachment={c}
          inChat={inChat}
          onPreview={onPreview}
          onDownload={onDownload}
          onRemove={onRemove && c.id ? onRemove : undefined}
        />
      ))}
    </div>
  );
}
