"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi, uploadFormData } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { useSupportOnlineStatus } from "@/hooks/useSupportOnlineStatus";
import { toast } from "sonner";
import TicketTagPanel from "./TicketTagPanel";
import HoldRequestModal from "./HoldRequestModal";
import EscalateTicketModal from "./EscalateTicketModal";
import TicketGovernanceToolbar from "./TicketGovernanceToolbar";
import StudentSnapshotCard from "./StudentSnapshotCard";
import CertificateDetailsCard from "./CertificateDetailsCard";
import TrainerApplicationCard from "./TrainerApplicationCard";
import CsatReviewCard from "./CsatReviewCard";
import AboutThisStudentCard from "@/components/support-shared/AboutThisStudentCard";
import AttachmentChip, { type Attachment as ChipAttachment } from "./AttachmentChip";
import LinkifiedText from "@/components/support/LinkifiedText";
import AttachmentPreviewModal, {
  type PreviewableAttachment,
} from "./AttachmentPreviewModal";
import AttachmentAuditPanel from "./AttachmentAuditPanel";
import StudentTimelineCard from "./StudentTimelineCard";
import CollaboratorsPanel from "./CollaboratorsPanel";
import CollaboratorChatPanel from "./CollaboratorChatPanel";
import TransferTicketModal from "./TransferTicketModal";
import TicketIncidentLinker from "./TicketIncidentLinker";
import {
  ArrowLeft,
  ArrowRightLeft,
  Send,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  UserPlus,
  Paperclip,
  RotateCcw,
  Star,
  Mail,
  BookOpen,
  Download,
  Merge,
  X,
} from "lucide-react";

interface TicketCategoryDef {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  requiresCourse: boolean;
  suggestedDepartment: string | null;
  applicableRoles: string[];
}

interface TicketDetail {
  id: string;
  studentId: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  courseName: string | null;
  firstResponseAt: string | null;
  slaBreachedFrt: boolean;
  slaBreachedTtr: boolean;
  onHoldReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  isGuestTicket?: boolean;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string | null;
  attachmentUrl: string | null;
  attachments?: {
    id: string;
    url: string;
    filename: string | null;
    sizeBytes: number | null;
    mimeType: string | null;
    uploadedAt: string;
    scanStatus?: "clean" | "pending" | "quarantined" | "unknown";
    scannedAt?: string | null;
  }[];
  satisfactionRating: number | null;
  comments: {
    id: string;
    message: string;
    isStaffReply: boolean;
    isInternal: boolean;
    /** Phase 2 — system-emitted message (e.g. transfer notice). FE
     *  renders these greyed-out without a Support attribution. */
    isSystem?: boolean;
    createdAt: string;
    userId: string;
    userFirstName: string | null;
    userLastName: string | null;
    userRole?: "super_admin" | "admin" | "supervisor" | "agent" | "student" | null;
    attachments?: {
      id: string;
      url: string;
      filename: string | null;
      sizeBytes: number | null;
      mimeType: string | null;
      scanStatus?: "clean" | "pending" | "quarantined" | "unknown";
      scannedAt?: string | null;
    }[];
  }[];
  /** Phase 2 — looped-in departments on this ticket. Empty array
   *  when the viewer is the requester. */
  collaborators?: {
    id: string;
    userId: string;
    department: string;
    addedAt: string;
    userName: string | null;
    userEmail: string | null;
    addedBy: { id: string; name: string | null } | null;
  }[];
  /** Phase 2 — viewer's role on THIS ticket (not their global role). */
  viewerRole?: "support" | "collaborator" | "requester" | "none";
  courseId?: string | null;
  slaPolicy: {
    frtMinutes: number;
    ttrMinutes: number;
  } | null;
  frtDeadline: string | null;
  ttrDeadline: string | null;
  frtRemainingMinutes: number | null;
  ttrRemainingMinutes: number | null;
  referenceNumber?: string | null;
  tags?: { id: string; name: string; color: string }[];
  pendingHoldRequest?: {
    id: string;
    reason: string;
    description: string | null;
    createdAt: string;
    requestedBy: string;
    requesterFirstName: string | null;
    requesterLastName: string | null;
  } | null;
  mergedIntoTicketId?: string | null;
  mergedInto?: {
    ticketId: string;
    referenceNumber: string;
    subject: string;
  } | null;
  mergedFrom?: {
    ticketId: string;
    referenceNumber: string;
    subject: string;
    closedAt: string | null;
  }[];
  slaPaused?: boolean;
  slaPausedReason?: "on_hold" | "off_hours" | null;
  csatReview?: {
    score: number | null;
    comment: string | null;
    submittedAt: string | null;
    channel?: string | null;
  } | null;
  source?: string | null;
  aboutUserId?: string | null;
  aboutUser?: import("@/components/support-shared/AboutThisStudentCard").AboutUserData | null;
  escalatedAt?: string | null;
  escalatedBy?: string | null;
  escalationReason?: string | null;
}

// Maps ticket.source → role chip slug + Tailwind class. Lets
// the agent see at a glance which dashboard the requester used
// to raise the ticket, so a multi-role user doesn't get treated
// as the wrong role.
function sourceRoleChip(source?: string | null): {
  key: "instructor" | "manager" | "ta" | "student" | "finance";
  cls: string;
} {
  switch (source) {
    case "instructor":
    case "intervention":
      return {
        key: "instructor",
        cls: "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]",
      };
    case "course_manager":
      return {
        key: "manager",
        cls: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
      };
    case "ta":
      return {
        key: "ta",
        cls: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]",
      };
    case "finance":
      return {
        key: "finance",
        cls: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
      };
    default:
      return {
        key: "student",
        cls: "bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]",
      };
  }
}

const TicketDetailContent = () => {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  // True when the support team is outside business hours. SLA math on
  // the BE already stops accruing minutes during these windows; we
  // render the FE timer as "Paused at X" so it matches the math and
  // the agent doesn't think the clock is moving.
  const { isOnline: supportOnline } = useSupportOnlineStatus();

  const ticketId = params?.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Preview modal — opened by clicking any preview-able attachment
  // anywhere in this view (header chips or chat thread).
  const [previewAttachment, setPreviewAttachment] =
    useState<PreviewableAttachment | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  type PendingAttachment = {
    id: string;
    file: File;
    status: "queued" | "uploading" | "done" | "error";
    url?: string;
    errorMessage?: string;
  };
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [isDraggingReply, setIsDraggingReply] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const REPLY_ATTACHMENT_MAX = 10;
  const REPLY_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
  const REPLY_ATTACHMENT_ALLOWED = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  async function uploadReplyFile(att: PendingAttachment) {
    setPendingAttachments((curr) =>
      curr.map((a) =>
        a.id === att.id ? { ...a, status: "uploading" as const } : a,
      ),
    );
    try {
      const fd = new FormData();
      fd.append("file", att.file);
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
    } catch (err) {
      setPendingAttachments((curr) =>
        curr.map((a) =>
          a.id === att.id
            ? {
                ...a,
                status: "error" as const,
                errorMessage: String(err),
              }
            : a,
        ),
      );
    }
  }

  function handleReplyFilesAdded(files: File[]) {
    const accepted: PendingAttachment[] = [];
    for (const file of files) {
      if (pendingAttachments.length + accepted.length >= REPLY_ATTACHMENT_MAX)
        break;
      if (!REPLY_ATTACHMENT_ALLOWED.has(file.type)) continue;
      if (file.size > REPLY_ATTACHMENT_MAX_BYTES) continue;
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        status: "queued",
      });
    }
    if (accepted.length === 0) return;
    setPendingAttachments((curr) => [...curr, ...accepted]);
    for (const att of accepted) {
      void uploadReplyFile(att);
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((curr) => curr.filter((a) => a.id !== id));
  }
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [showReassign, setShowReassign] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  // Phase 2 — channel toggle (Public ⇄ Internal), Transfer modal,
  // category catalog for Transfer's category picker.
  const [activeLane, setActiveLane] = useState<"public" | "internal">("public");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [categoryCatalog, setCategoryCatalog] = useState<TicketCategoryDef[]>([]);
  const [isSubmittingHold, setIsSubmittingHold] = useState(false);
  const [isDecidingHold, setIsDecidingHold] = useState(false);
  const [macros, setMacros] = useState<any[]>([]);
  const [showMacroDropdown, setShowMacroDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExportingArchive, setIsExportingArchive] = useState(false);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isApplyingMacro, setIsApplyingMacro] = useState(false);
  const [macroSearchQuery, setMacroSearchQuery] = useState("");

  const isSupportOrAdmin =
    user?.roles?.includes("SUPPORT") ||
    user?.roles?.includes("ADMIN") ||
    user?.roles?.includes("SUPER_ADMIN");
  const isSupervisor = user?.supportSubRole === "supervisor";
  const isAdmin =
    user?.roles?.includes("ADMIN") || user?.roles?.includes("SUPER_ADMIN");
  // Download log + soft-delete UI are limited to supervisors + admins.
  const canManageAttachments = !!(isSupervisor || isAdmin);

  // Shared handler — opens the preview modal AND fires the download
  // audit (counts as access either way).
  const handlePreview = (att: ChipAttachment) => {
    if (!ticket) return;
    if (isSupportOrAdmin) {
      supportApi
        .recordAttachmentDownload(ticket.id, att.url)
        .catch(() => {});
    }
    setPreviewAttachment(att);
  };
  // Same hook fires when staff actually downloads via the chip link
  // (non-previewable files) — keeps the audit unified.
  const handleDownload = (att: ChipAttachment) => {
    if (!ticket) return;
    if (isSupportOrAdmin) {
      supportApi
        .recordAttachmentDownload(ticket.id, att.url)
        .catch(() => {});
    }
  };
  // Soft-delete handler — confirms in the chip, then calls the API
  // and reloads the ticket so the chip drops out of the active row.
  const handleRemoveAttachment = async (att: ChipAttachment) => {
    if (!ticket || !att.id) return;
    try {
      await supportApi.softDeleteAttachment(ticket.id, att.id);
      // Refresh the ticket so the chip disappears AND the history
      // section (when expanded) reflects the new removal.
      const fresh = await supportApi.getTicket(ticket.id);
      setTicket(fresh);
      toast.success(t("ticketDetail.attachmentRemovedToast"));
    } catch {
      toast.error(t("ticketDetail.attachmentRemoveFailed"));
    }
  };

  const profile = useSupportProfile();

  useEffect(() => {
    if (isSupervisor) {
      supportApi.getAgents().then(data => setAgents(data || [])).catch(() => {});
    }
  }, [isSupervisor]);

  useEffect(() => {
    // Pull every active macro and sort client-side. We previously
    // passed `categoryKey: ticket.category` which made the backend
    // return only macros tagged for THAT category + general ones —
    // tickets whose category had no tagged macros saw a near-empty
    // dropdown. Fetching the full active set + grouping locally lets
    // agents apply any macro on any ticket, with the matching-category
    // ones still surfaced under a "Recommended" subhead.
    if (isSupportOrAdmin && ticket?.category) {
      supportApi
        .getMacros()
        .then((data) => setMacros(data || []))
        .catch(() => {});
    }
  }, [isSupportOrAdmin, ticket?.category]);

  useEffect(() => {
    if (!ticketId) return;
    async function fetchTicket() {
      setIsLoading(true);
      try {
        const data = await supportApi.getTicket(ticketId);
        setTicket(data);
      } catch {
        toast.error(t("ticketDetail.toasts.loadFailed"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchTicket();

    // Phase 2 — pull category catalog once for the Transfer modal.
    // Best-effort: an empty list just disables transfer.
    supportApi
      .listTicketCategories()
      .then((rows) =>
        setCategoryCatalog(
          rows.map((r) => ({
            slug: r.slug,
            nameEn: r.nameEn,
            nameAr: r.nameAr,
            requiresCourse: !!r.requiresCourse,
            suggestedDepartment: r.suggestedDepartment ?? null,
            applicableRoles: Array.isArray(r.applicableRoles)
              ? r.applicableRoles
              : [],
          })),
        ),
      )
      .catch(() => undefined);

    // Auto-refresh every 60 seconds for live SLA updates
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        supportApi
          .getTicket(ticketId)
          .then((data) => setTicket(data))
          .catch(() => {});
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [ticketId]);

  async function handleSendReply() {
    if (!replyMessage.trim() || !ticketId) return;
    // Block while any upload is still in flight so the reply doesn't
    // race the storage write and arrive with a half-attached file.
    const anyUploading = pendingAttachments.some(
      (a) => a.status === "queued" || a.status === "uploading",
    );
    if (anyUploading) {
      toast.error(t("ticketDetail.toasts.waitForUploads"));
      return;
    }
    setIsSending(true);
    try {
      const attachmentUrls = pendingAttachments
        .filter((a) => a.status === "done" && a.url)
        .map((a) => a.url!) as string[];
      await supportApi.addComment(ticketId, {
        message: replyMessage.trim(),
        isInternal,
        attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      });
      setReplyMessage("");
      setIsInternal(false);
      setPendingAttachments([]);
      // Refresh ticket
      const data = await supportApi.getTicket(ticketId);
      setTicket(data);
      toast.success(isInternal ? t("ticketDetail.toasts.internalAdded") : t("ticketDetail.toasts.replySent"));
    } catch {
      toast.error(t("ticketDetail.toasts.replyFailed"));
    } finally {
      setIsSending(false);
    }
  }

  async function handleStatusChange(newStatus: string, opts?: { onHoldReason?: string }) {
    if (!ticketId) return;
    setIsUpdating(true);
    try {
      if (newStatus === "resolved") {
        await supportApi.resolveTicket(ticketId);
      } else if (newStatus === "closed") {
        await supportApi.closeTicket(ticketId);
      } else if (newStatus === "on_hold") {
        // Backend requires a reason from a whitelisted enum when going on_hold.
        await supportApi.updateTicket(ticketId, {
          status: newStatus,
          onHoldReason: opts?.onHoldReason,
        });
      } else {
        await supportApi.updateTicket(ticketId, { status: newStatus });
      }
      const data = await supportApi.getTicket(ticketId);
      setTicket(data);
      toast.success(t("ticketDetail.toasts.statusChanged", { status: newStatus }));
    } catch {
      toast.error(t("ticketDetail.toasts.statusFailed"));
    } finally {
      setIsUpdating(false);
    }
  }

  // Hold-approval flow. Agents go through here (request → wait →
  // approved/rejected); supervisors / admins bypass and call the
  // direct on-hold path via handleStatusChange.
  async function handleHoldSubmit({
    reason,
    description,
  }: {
    reason: string;
    description?: string;
  }) {
    if (!ticketId) return;
    setIsSubmittingHold(true);
    try {
      if (isSupervisor) {
        // Supervisor self-holds directly — no approval needed.
        await supportApi.updateTicket(ticketId, {
          status: "on_hold",
          onHoldReason: reason,
        });
        toast.success(t("ticketDetail.toasts.holdApplied"));
      } else {
        await supportApi.createHoldRequest(ticketId, {
          reason,
          description: description || null,
        });
        toast.success(t("ticketDetail.toasts.holdRequested"));
      }
      const data = await supportApi.getTicket(ticketId);
      setTicket(data);
      setShowHoldModal(false);
    } catch {
      toast.error(t("ticketDetail.toasts.holdFailed"));
    } finally {
      setIsSubmittingHold(false);
    }
  }

  async function handleHoldDecision(
    requestId: string,
    decision: "approved" | "rejected",
    note?: string,
  ) {
    if (!ticketId) return;
    setIsDecidingHold(true);
    try {
      await supportApi.decideHoldRequest(ticketId, requestId, {
        decision,
        note: note || null,
      });
      const data = await supportApi.getTicket(ticketId);
      setTicket(data);
      toast.success(
        decision === "approved"
          ? t("ticketDetail.toasts.holdApprovedToast")
          : t("ticketDetail.toasts.holdRejectedToast"),
      );
    } catch {
      toast.error(t("ticketDetail.toasts.holdDecisionFailed"));
    } finally {
      setIsDecidingHold(false);
    }
  }

  // Format a positive minute count as a human-readable duration.
  // < 60m   → "45m"
  // < 24h   → "2h 15m" (omits "0m")
  // >= 24h  → "3d 4h"  (omits "0h")
  function formatDuration(totalMinutes: number): string {
    const mins = Math.max(0, Math.round(totalMinutes));
    if (mins < 60) return `${mins}m`;
    if (mins < 60 * 24) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(mins / (60 * 24));
    const h = Math.floor((mins % (60 * 24)) / 60);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }

  const priorityStyles: Record<string, string> = {
    high: "bg-[#FEE2E2] text-[#EF4444]",
    medium: "bg-[#FFEDD5] text-[#F97316]",
    low: "bg-[#DCFCE7] text-[#22C55E]",
  };

  const statusStyles: Record<string, string> = {
    new: "bg-[#DBEAFE] text-[#2563EB]",
    in_progress: "bg-[#FEF9C3] text-[#CA8A04]",
    on_hold: "bg-[#FFEDD5] text-[#EA580C]",
    resolved: "bg-[#DCFCE7] text-[#16A34A]",
    closed: "bg-[#F3F4F6] text-[#4B5563]",
  };

  return (
    <>
      {/* Phase 2 — fullscreen ticket detail. No SupportNavbar, no
          SupportSidebar — this view treats the ticket as a focused
          conversation surface. The ✕ Close button in the top bar
          returns to the previous list. */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col gap-6">

            <div className="flex-1 min-w-0">
              {/* Top bar — Back + Close */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                  {t("ticketDetail.backToTickets")}
                </button>
                <button
                  onClick={() => router.back()}
                  className="w-9 h-9 rounded-lg border border-[var(--color-border)] bg-white hover:bg-[var(--color-bg-secondary)] flex items-center justify-center"
                  title={t("ticketDetail.close")}
                  aria-label={t("ticketDetail.close")}
                >
                  <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </button>
              </div>

              {/* Cross-role banner — Phase 2. Tells the viewer which
                  hat they're wearing on this ticket so a multi-role
                  user (e.g. instructor who's also a course assistant
                  on someone else's ticket) understands the implied
                  composer-lock + visibility. */}
              {ticket?.viewerRole === "requester" && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {t("ticketDetail.banner.requester")}
                </div>
              )}
              {ticket?.viewerRole === "collaborator" && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  {t("ticketDetail.banner.collaborator")}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
              ) : !ticket ? (
                <div className="text-center py-20 text-[var(--color-text-secondary)]">
                  {t("ticketDetail.notFound")}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content — Thread */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Merge breadcrumbs — only render when this ticket
                        is on one side of a merge. Banner on the SOURCE
                        (closed shell) tells the viewer where the live
                        conversation went; the TARGET shows which old
                        references were folded in. */}
                    {ticket.mergedInto && (
                      <div className="flex items-start gap-3 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3">
                        <Merge className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#92400E]">
                            {t("ticketDetail.mergedIntoTitle")}
                          </p>
                          <p className="text-xs text-[#92400E]/90 mt-0.5">
                            {t("ticketDetail.mergedIntoDescription")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `${(() => {
                                if (typeof window === "undefined") return "";
                                const m = window.location.pathname.match(
                                  /(.*\/support(?:\/agent|\/supervisor)?)/,
                                );
                                return m ? m[1] : "";
                              })()}/tickets/${ticket.mergedInto!.ticketId}`,
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#B45309] text-white hover:bg-[#92400E] shrink-0"
                        >
                          {t("ticketDetail.openTarget", {
                            ref: ticket.mergedInto.referenceNumber,
                          })}
                          <ArrowLeft
                            className={`w-3 h-3 ${isRTL ? "" : "rotate-180"}`}
                          />
                        </button>
                      </div>
                    )}
                    {ticket.mergedFrom && ticket.mergedFrom.length > 0 && (
                      <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
                        <div className="flex items-start gap-3">
                          <Merge className="w-4 h-4 text-[#1D4ED8] shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1E3A8A]">
                              {t("ticketDetail.mergedFromTitle", {
                                count: ticket.mergedFrom.length,
                              })}
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {ticket.mergedFrom.map((m) => (
                                <li
                                  key={m.ticketId}
                                  className="text-xs text-[#1E3A8A]/90 flex items-center gap-1.5"
                                >
                                  <span className="font-mono font-semibold">
                                    {m.referenceNumber}
                                  </span>
                                  <span className="opacity-75 truncate">
                                    — {m.subject}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Ticket Header */}
                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                            {ticket.subject}
                          </h1>
                          <p className="text-sm text-[var(--color-text-secondary)] font-mono">
                            {ticket.referenceNumber || `#${ticket.id.substring(0, 8)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {ticket.escalatedAt && (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
                              title={
                                ticket.escalationReason ||
                                t("ticketDetail.actions.escalated")
                              }
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {t("ticketDetail.actions.escalated")}
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                              priorityStyles[ticket.priority] || ""
                            }`}
                          >
                            {ticket.priority}
                          </span>
                          <span
                            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                              statusStyles[ticket.status] || ""
                            }`}
                          >
                            {ticket.status.replace("_", " ")}
                          </span>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowExportDropdown((p) => !p)}
                              disabled={isExportingArchive}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] disabled:opacity-50"
                              title={t("ticketDetail.export.title")}
                            >
                              {isExportingArchive ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Download className="w-3 h-3" />
                              )}
                              {t("ticketDetail.export.button")}
                            </button>
                            {showExportDropdown && (
                              <div
                                className={`absolute top-full ${isRTL ? "right-0" : "left-0"} mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-20 w-[260px] py-1`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowExportDropdown(false);
                                    supportApi
                                      .exportTicketHistory(
                                        ticket.id,
                                        ticket.referenceNumber,
                                      )
                                      .catch(() =>
                                        toast.error(
                                          t("ticketDetail.export.csvFailed"),
                                        ),
                                      );
                                  }}
                                  className={`w-full ${isRTL ? "text-right" : "text-left"} px-3 py-2 hover:bg-[var(--color-border-subtle)]`}
                                >
                                  <div className="text-xs font-medium text-[var(--color-text-primary)]">
                                    {t("ticketDetail.export.csvLabel")}
                                  </div>
                                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                                    {t("ticketDetail.export.csvHint")}
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setShowExportDropdown(false);
                                    setIsExportingArchive(true);
                                    try {
                                      await supportApi.exportTicketArchive(
                                        ticket.id,
                                        ticket.referenceNumber,
                                      );
                                      toast.success(
                                        t("ticketDetail.export.archiveReady"),
                                      );
                                    } catch {
                                      toast.error(
                                        t("ticketDetail.export.archiveFailed"),
                                      );
                                    } finally {
                                      setIsExportingArchive(false);
                                    }
                                  }}
                                  className={`w-full ${isRTL ? "text-right" : "text-left"} px-3 py-2 hover:bg-[var(--color-border-subtle)] border-t border-[var(--color-border)]`}
                                >
                                  <div className="text-xs font-medium text-[var(--color-text-primary)]">
                                    {t("ticketDetail.export.archiveLabel")}
                                  </div>
                                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                                    {t("ticketDetail.export.archiveHint")}
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Tag panel — applied chips + inline picker. Only
                          renders for staff (students can't see tags). */}
                      {user?.roles?.some((r) =>
                        ["SUPPORT", "ADMIN", "SUPER_ADMIN"].includes(r),
                      ) && (
                        <div className="mb-3">
                          <TicketTagPanel
                            ticketId={ticket.id}
                            initialTags={ticket.tags || []}
                            disabled={ticket.status === "closed"}
                          />
                        </div>
                      )}
                      {/* Governance toolbar — supervisor-only actions
                          (merge / transfer). Hidden for plain agents. */}
                      <TicketGovernanceToolbar
                        ticketId={ticket.id}
                        ticketCategory={ticket.category}
                        courseId={ticket.courseId ?? null}
                        basePath={(() => {
                          // Re-derive basePath the same way the rest of this
                          // file does — keep behaviour identical to the
                          // sibling links above. Defaults to the supervisor
                          // path when in doubt.
                          if (typeof window === "undefined") return "";
                          const m = window.location.pathname.match(
                            /(.*\/support(?:\/agent|\/supervisor)?)/,
                          );
                          return m ? m[1] : "";
                        })()}
                        isSupervisor={Boolean(
                          user?.supportSubRole === "supervisor" ||
                            user?.roles?.includes("ADMIN") ||
                            user?.roles?.includes("SUPER_ADMIN"),
                        )}
                        onChanged={async () => {
                          const data = await supportApi.getTicket(ticketId);
                          setTicket(data);
                        }}
                      />
                      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap break-words">
                        <LinkifiedText text={ticket.description} />
                      </p>
                      {(() => {
                        // Header-level attachments: ticket.attachments
                        // (post-0054 multi-row table) + legacy single
                        // `attachmentUrl` for older tickets. Renders
                        // through the shared AttachmentChip so behaviour
                        // is consistent with the chat-thread chips —
                        // preview-able files open the modal, others
                        // direct-download.
                        const multi = ticket.attachments;
                        const chips: ChipAttachment[] =
                          multi && multi.length > 0
                            ? multi.map((a) => ({
                                id: a.id,
                                url: a.url,
                                filename:
                                  a.filename ??
                                  t("ticketDetail.openAttachment"),
                                mimeType:
                                  (a as { mimeType?: string | null }).mimeType ??
                                  null,
                                sizeBytes:
                                  (a as { sizeBytes?: number | null }).sizeBytes ??
                                  null,
                                scanStatus: a.scanStatus,
                              }))
                            : ticket.attachmentUrl
                              ? [
                                  {
                                    url: ticket.attachmentUrl,
                                    filename: t(
                                      "ticketDetail.openAttachment",
                                    ),
                                    scanStatus: "unknown" as const,
                                  },
                                ]
                              : [];
                        if (chips.length === 0) return null;
                        return (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {chips.map((c) => (
                              <AttachmentChip
                                key={c.id ?? c.url}
                                attachment={c}
                                inChat
                                onPreview={handlePreview}
                                onDownload={handleDownload}
                                onRemove={
                                  canManageAttachments && c.id
                                    ? handleRemoveAttachment
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        );
                      })()}
                      <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
                        {new Date(ticket.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Comments Thread */}
                    <div className="space-y-3">
                      {ticket.comments.map((comment) => {
                        const authorName = [
                          comment.userFirstName,
                          comment.userLastName,
                        ]
                          .filter(Boolean)
                          .join(" ");
                        // Phase 2 — system messages (e.g. transfer
                        // notices) render as a centered pill, not as a
                        // chat bubble, so the requester reads them as
                        // "platform talking" not "Support saying".
                        if (comment.isSystem) {
                          return (
                            <div
                              key={comment.id}
                              className="flex items-center justify-center"
                            >
                              <div className="max-w-xl px-3 py-2 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] text-center">
                                {comment.message}
                                <span className="ms-2 opacity-60">
                                  · {new Date(comment.createdAt).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={comment.id}
                            className={`bg-white rounded-2xl border p-5 ${
                              comment.isInternal
                                ? "border-[#FDE68A] bg-[#FFFBEB]"
                                : "border-[var(--color-border)]"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                  comment.isStaffReply
                                    ? "bg-[var(--color-primary)]"
                                    : "bg-[#8B5CF6]"
                                }`}
                              >
                                {authorName
                                  ? authorName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .substring(0, 2)
                                  : "?"}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {authorName || t("ticketDetail.unknownAuthor")}
                                </span>
                                {comment.isStaffReply && (
                                  <span className="ml-1.5 text-xs text-[var(--color-primary)] bg-[#EFF6FF] px-1.5 py-0.5 rounded">
                                    {t("ticketDetail.staffBadge")}
                                  </span>
                                )}
                                {comment.userRole &&
                                  comment.userRole !== "student" && (
                                    <span className="ml-1.5 text-[10px] text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-1.5 py-0.5 rounded uppercase tracking-wide">
                                      {t(`ticketDetail.roleBadge.${comment.userRole}`)}
                                    </span>
                                  )}
                                {comment.isInternal && (
                                  <span className="ml-1.5 text-xs text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.5 rounded flex items-center gap-1 inline-flex">
                                    <Lock className="w-3 h-3" />
                                    {t("ticketDetail.internalBadge")}
                                  </span>
                                )}
                              </div>
                              <span className="ml-auto text-xs text-[var(--color-text-secondary)]">
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap break-words">
                              <LinkifiedText text={comment.message} />
                            </p>
                            {comment.attachments && comment.attachments.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {comment.attachments.map((a) => (
                                  <AttachmentChip
                                    key={a.id}
                                    attachment={{
                                      id: a.id,
                                      url: a.url,
                                      filename: a.filename ?? null,
                                      mimeType:
                                        (a as { mimeType?: string | null }).mimeType ?? null,
                                      sizeBytes:
                                        (a as { sizeBytes?: number | null }).sizeBytes ?? null,
                                      scanStatus: a.scanStatus,
                                    }}
                                    inChat
                                    onPreview={handlePreview}
                                    onDownload={handleDownload}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply Composer */}
                    {ticket.status !== "closed" && (
                      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <MessageSquare className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {t("ticketDetail.reply")}
                          </span>
                          {isSupportOrAdmin && macros.length > 0 && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => { setShowMacroDropdown(!showMacroDropdown); setMacroSearchQuery(""); }}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-primary)] bg-[#EFF6FF] rounded hover:bg-[#DBEAFE] transition-colors"
                              >
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                                {t("ticketDetail.applyMacro")}
                              </button>
                              {showMacroDropdown && (() => {
                                const q = macroSearchQuery.trim().toLowerCase();
                                const matchesSearch = (m: any) =>
                                  !q || m.title.toLowerCase().includes(q);
                                const recommended = macros.filter(
                                  (m) => m.categoryKey === ticket.category && matchesSearch(m),
                                );
                                const others = macros.filter(
                                  (m) => m.categoryKey !== ticket.category && matchesSearch(m),
                                );
                                const renderItem = (macro: any) => (
                                  <button
                                    key={macro.id}
                                    disabled={isApplyingMacro}
                                    onClick={async () => {
                                      setIsApplyingMacro(true);
                                      try {
                                        const result = await supportApi.applyMacro(ticketId, macro.id, locale);
                                        setMacroPreview(result.resolvedBody);
                                        setShowMacroDropdown(false);
                                        setMacroSearchQuery("");
                                      } catch { toast.error(t("ticketDetail.toasts.applyMacroFailed")); }
                                      finally { setIsApplyingMacro(false); }
                                    }}
                                    className={`w-full ${isRTL ? "text-right" : "text-left"} px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] flex items-center justify-between gap-2 disabled:opacity-50`}
                                  >
                                    <span className="truncate flex-1">{macro.title}</span>
                                    {macro.bodyAr && locale === "ar" && (
                                      <span className="text-[9px] font-semibold uppercase tracking-wide text-[#047857] flex-shrink-0">AR</span>
                                    )}
                                  </button>
                                );
                                return (
                                  <div className={`absolute top-full ${isRTL ? "right-0" : "left-0"} mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-20 w-[280px] py-1 max-h-[360px] overflow-y-auto`}>
                                    <div className="px-2 py-1.5 border-b border-[var(--color-border)] sticky top-0 bg-white">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={macroSearchQuery}
                                        onChange={(e) => setMacroSearchQuery(e.target.value)}
                                        placeholder={t("ticketDetail.macroSearchPlaceholder")}
                                        className="w-full h-7 px-2 border border-[var(--color-border)] rounded text-xs focus:outline-none focus:border-[var(--color-primary)]"
                                      />
                                    </div>
                                    {recommended.length === 0 && others.length === 0 && (
                                      <p className="px-3 py-3 text-xs text-[var(--color-text-secondary)] text-center">
                                        {t("ticketDetail.macroSearchEmpty")}
                                      </p>
                                    )}
                                    {recommended.length > 0 && (
                                      <>
                                        <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)] bg-[#F0F4FF]">
                                          {t("ticketDetail.macroRecommended")}
                                        </div>
                                        {recommended.map(renderItem)}
                                      </>
                                    )}
                                    {others.length > 0 && (
                                      <>
                                        {recommended.length > 0 && (
                                          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] bg-[var(--color-surface-page)] border-t border-[var(--color-border)]">
                                            {t("ticketDetail.macroOthers")}
                                          </div>
                                        )}
                                        {others.map(renderItem)}
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          {isSupportOrAdmin && (
                            <div
                              className={`inline-flex items-center gap-0 p-0.5 rounded-lg border ${
                                isInternal
                                  ? "border-amber-300 bg-amber-50"
                                  : "border-[var(--color-border)] bg-white"
                              } ${isRTL ? "mr-auto" : "ml-auto"}`}
                              role="tablist"
                              aria-label={t("ticketDetail.composer.lane")}
                            >
                              <button
                                type="button"
                                role="tab"
                                aria-selected={!isInternal}
                                onClick={() => setIsInternal(false)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                  !isInternal
                                    ? "bg-sky-600 text-white"
                                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                }`}
                              >
                                {t("ticketDetail.composer.public")}
                              </button>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={isInternal}
                                onClick={() => setIsInternal(true)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                                  isInternal
                                    ? "bg-amber-500 text-white"
                                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                }`}
                              >
                                <Lock className="w-3 h-3" />
                                {t("ticketDetail.composer.internal")}
                              </button>
                            </div>
                          )}
                        </div>
                        {macroPreview && (
                          <div className="mb-3 p-3 bg-[#F0F4FF] border border-[#C7D5F0] rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-[var(--color-primary)]">{t("ticketDetail.macroPreview")}</span>
                              <div className="flex gap-2">
                                <button onClick={() => { setReplyMessage(prev => prev ? prev + '\n\n' + macroPreview : macroPreview); setMacroPreview(null); }}
                                  className="px-2 py-1 text-xs bg-[var(--color-primary)] text-white rounded hover:opacity-90">{t("ticketDetail.insertMacro")}</button>
                                <button onClick={() => setMacroPreview(null)}
                                  className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:underline">{t("ticketDetail.cancelMacro")}</button>
                              </div>
                            </div>
                            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{macroPreview}</p>
                          </div>
                        )}
                        <textarea
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder={
                            isInternal
                              ? t("ticketDetail.internalNotePlaceholder")
                              : t("ticketDetail.replyPlaceholder")
                          }
                          rows={3}
                          className={`w-full px-3.5 py-2.5 border rounded-lg text-sm resize-none outline-none transition-colors ${
                            isInternal
                              ? "border-[#FDE68A] bg-[#FFFBEB] focus:border-[#D97706]"
                              : "border-[var(--color-border)] focus:border-[var(--color-primary)]"
                          }`}
                          dir={isRTL ? "rtl" : "ltr"}
                        />

                        {/* Multi-file picker — drag-and-drop or click. Each file
                            uploads in parallel; the send button waits for all
                            of them to either finish or fail. Per-file scan
                            verdict shows up on the reply chip once it lands. */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingReply(true);
                          }}
                          onDragLeave={() => setIsDraggingReply(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingReply(false);
                            handleReplyFilesAdded(Array.from(e.dataTransfer.files));
                          }}
                          onClick={() => replyFileInputRef.current?.click()}
                          className={`mt-3 px-3 py-3 border border-dashed rounded-lg cursor-pointer text-xs transition-colors ${
                            isDraggingReply
                              ? "border-[var(--color-primary)] bg-[#EFF6FF]"
                              : "border-[var(--color-border)] hover:border-[var(--color-primary)]"
                          }`}
                        >
                          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{t("ticketDetail.attachFiles")}</span>
                          </div>
                          <input
                            ref={replyFileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={(e) => {
                              handleReplyFilesAdded(
                                Array.from(e.target.files || []),
                              );
                              if (e.target) e.target.value = "";
                            }}
                          />
                        </div>

                        {pendingAttachments.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {pendingAttachments.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center gap-2 px-2 py-1.5 border border-[var(--color-border)] rounded text-xs"
                              >
                                <Paperclip className="w-3 h-3 text-[var(--color-text-secondary)]" />
                                <span className="truncate flex-1">
                                  {att.file.name}
                                </span>
                                <span
                                  className={
                                    att.status === "done"
                                      ? "text-[#15803D]"
                                      : att.status === "error"
                                        ? "text-[#991B1B]"
                                        : "text-[var(--color-text-secondary)]"
                                  }
                                >
                                  {att.status === "uploading"
                                    ? t("ticketDetail.attachmentUploading")
                                    : att.status === "done"
                                      ? t("ticketDetail.attachmentUploaded")
                                      : att.status === "error"
                                        ? t("ticketDetail.attachmentFailed")
                                        : t("ticketDetail.attachmentQueued")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removePendingAttachment(att.id)}
                                  className="text-[var(--color-text-secondary)] hover:text-[#991B1B]"
                                  aria-label={t(
                                    "ticketDetail.removeAttachment",
                                  )}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end mt-3">
                          <button
                            onClick={handleSendReply}
                            disabled={!replyMessage.trim() || isSending}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {isInternal ? t("ticketDetail.addNote") : t("ticketDetail.sendReply")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Panel — Details & Actions */}
                  <div className="space-y-4">
                    {/* Customer Card — name, email, course at a glance */}
                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                        {t("ticketDetail.customer")}
                      </h3>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-semibold text-sm">
                          {[ticket.studentFirstName?.[0], ticket.studentLastName?.[0]]
                            .filter(Boolean)
                            .join("")
                            .toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {[ticket.studentFirstName, ticket.studentLastName]
                                .filter(Boolean)
                                .join(" ") || t("ticketDetail.unknownAuthor")}
                            </div>
                            {ticket.isGuestTicket && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                                title={t("ticketDetail.guestTicketHint")}
                              >
                                {t("ticketDetail.guestBadge")}
                              </span>
                            )}
                            {!ticket.isGuestTicket && (() => {
                              const chip = sourceRoleChip(ticket.source);
                              return (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded border ${chip.cls}`}
                                  title={t(`ticketDetail.requesterRoleHint.${chip.key}`)}
                                >
                                  {t(`ticketDetail.requesterRole.${chip.key}`)}
                                </span>
                              );
                            })()}
                          </div>
                          {ticket.studentEmail && (
                            <a
                              href={`mailto:${ticket.studentEmail}`}
                              className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] inline-flex items-center gap-1 truncate"
                              title={ticket.studentEmail}
                            >
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{ticket.studentEmail}</span>
                            </a>
                          )}
                          {ticket.isGuestTicket && (
                            <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 italic">
                              {t("ticketDetail.guestTicketHint")}
                            </p>
                          )}
                        </div>
                      </div>
                      {ticket.courseName && (
                        <div className="flex items-start gap-2 pt-3 border-t border-[var(--color-border)]">
                          <BookOpen className="w-3.5 h-3.5 text-[var(--color-text-secondary)] mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            <div>{t("ticketDetail.detailsLabels.course")}</div>
                            <div className="text-[var(--color-text-primary)] font-medium">
                              {ticket.courseName}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SLA Panel — Live Countdown.
                        Pinned to the top of the right rail so agents
                        see the most time-critical signal first. */}
                    {ticket.slaPolicy && (
                      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                          {t("ticketDetail.sla.title")}
                        </h3>
                        <div className="space-y-4 text-sm">
                          {/* FRT */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[var(--color-text-secondary)]">{t("ticketDetail.sla.firstResponse")}</span>
                              {ticket.slaBreachedFrt ? (
                                <span className="flex items-center gap-1 text-[#EF4444] font-semibold text-xs">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {t("ticketDetail.sla.breached")}
                                </span>
                              ) : ticket.firstResponseAt ? (
                                <span className="flex items-center gap-1 text-[#22C55E] font-semibold text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("ticketDetail.sla.met")}
                                </span>
                              ) : (
                                <span className="text-[var(--color-text-secondary)] text-xs">
                                  {t("ticketDetail.sla.target", { value: `${ticket.slaPolicy.frtMinutes}m` })}
                                </span>
                              )}
                            </div>
                            {!ticket.firstResponseAt && !ticket.slaBreachedFrt && ticket.frtRemainingMinutes != null && (() => {
                              const isPaused =
                                ticket.slaPaused ??
                                (ticket.status === "on_hold" ||
                                  supportOnline === false);
                              return (
                              <div>
                                <div className="flex justify-between items-center">
                                  {isPaused ? (
                                    <span className="text-xs font-semibold text-[#F59E0B]">
                                      {t("ticketDetail.sla.pausedAt", {
                                        value: formatDuration(ticket.frtRemainingMinutes),
                                      })}
                                    </span>
                                  ) : (
                                    <span className={`text-xs font-semibold ${
                                      ticket.frtRemainingMinutes > ticket.slaPolicy.frtMinutes * 0.5
                                        ? "text-[#22C55E]"
                                        : ticket.frtRemainingMinutes > ticket.slaPolicy.frtMinutes * 0.1
                                          ? "text-[#F59E0B]"
                                          : "text-[#EF4444]"
                                    }`}>
                                      {t("ticketDetail.sla.remaining", { value: formatDuration(ticket.frtRemainingMinutes) })}
                                    </span>
                                  )}
                                </div>
                                <div className="w-full bg-[var(--color-border-subtle)] rounded-full h-1.5 mt-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      isPaused
                                        ? "bg-[#F59E0B]"
                                        : ticket.frtRemainingMinutes > ticket.slaPolicy.frtMinutes * 0.5
                                          ? "bg-[#22C55E]"
                                          : ticket.frtRemainingMinutes > ticket.slaPolicy.frtMinutes * 0.1
                                            ? "bg-[#F59E0B]"
                                            : "bg-[#EF4444]"
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (ticket.frtRemainingMinutes / ticket.slaPolicy.frtMinutes) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              );
                            })()}
                            {ticket.slaBreachedFrt && ticket.frtRemainingMinutes != null && (
                              <span className="text-xs text-[#EF4444]">
                                {t("ticketDetail.sla.overdueBy", { value: formatDuration(Math.abs(ticket.frtRemainingMinutes)) })}
                              </span>
                            )}
                          </div>

                          {/* TTR */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[var(--color-text-secondary)]">{t("ticketDetail.sla.resolution")}</span>
                              {ticket.slaBreachedTtr ? (
                                <span className="flex items-center gap-1 text-[#EF4444] font-semibold text-xs">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {t("ticketDetail.sla.breached")}
                                </span>
                              ) : ticket.resolvedAt ? (
                                <span className="flex items-center gap-1 text-[#22C55E] font-semibold text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("ticketDetail.sla.met")}
                                </span>
                              ) : (
                                <span className="text-[var(--color-text-secondary)] text-xs">
                                  {t("ticketDetail.sla.target", {
                                    value: ticket.slaPolicy.ttrMinutes > 60
                                      ? `${(ticket.slaPolicy.ttrMinutes / 60).toFixed(0)}h`
                                      : `${ticket.slaPolicy.ttrMinutes}m`
                                  })}
                                </span>
                              )}
                            </div>
                            {!ticket.resolvedAt && !ticket.slaBreachedTtr && ticket.ttrRemainingMinutes != null && (() => {
                              const isPaused =
                                ticket.slaPaused ??
                                (ticket.status === "on_hold" ||
                                  supportOnline === false);
                              return (
                              <div>
                                <div className="flex justify-between items-center">
                                  {isPaused ? (
                                    <span className="text-xs font-semibold text-[#F59E0B]">
                                      {t("ticketDetail.sla.pausedAt", {
                                        value: formatDuration(ticket.ttrRemainingMinutes),
                                      })}
                                    </span>
                                  ) : (
                                    <span className={`text-xs font-semibold ${
                                      ticket.ttrRemainingMinutes > ticket.slaPolicy.ttrMinutes * 0.5
                                        ? "text-[#22C55E]"
                                        : ticket.ttrRemainingMinutes > ticket.slaPolicy.ttrMinutes * 0.1
                                          ? "text-[#F59E0B]"
                                          : "text-[#EF4444]"
                                    }`}>
                                      {t("ticketDetail.sla.remaining", { value: formatDuration(ticket.ttrRemainingMinutes) })}
                                    </span>
                                  )}
                                </div>
                                <div className="w-full bg-[var(--color-border-subtle)] rounded-full h-1.5 mt-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      isPaused
                                        ? "bg-[#F59E0B]"
                                        : ticket.ttrRemainingMinutes > ticket.slaPolicy.ttrMinutes * 0.5
                                          ? "bg-[#22C55E]"
                                          : ticket.ttrRemainingMinutes > ticket.slaPolicy.ttrMinutes * 0.1
                                            ? "bg-[#F59E0B]"
                                            : "bg-[#EF4444]"
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (ticket.ttrRemainingMinutes / ticket.slaPolicy.ttrMinutes) * 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              );
                            })()}
                            {ticket.slaBreachedTtr && ticket.ttrRemainingMinutes != null && (
                              <span className="text-xs text-[#EF4444]">
                                {t("ticketDetail.sla.overdueBy", { value: formatDuration(Math.abs(ticket.ttrRemainingMinutes)) })}
                              </span>
                            )}
                            {(ticket.slaPaused ?? (ticket.status === "on_hold" || supportOnline === false)) && (
                              <span className="text-xs text-[#F59E0B] flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {(ticket.slaPausedReason ?? (ticket.status === "on_hold" ? "on_hold" : "off_hours")) === "on_hold"
                                  ? t("ticketDetail.sla.pausedOnHold")
                                  : t("ticketDetail.sla.pausedOffHours")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CSAT review — surface the customer's rating
                        + comment at the top of the rail when present,
                        so the team sees feedback inline. */}
                    {ticket.csatReview && (
                      <CsatReviewCard
                        review={ticket.csatReview}
                        locale={locale}
                      />
                    )}

                    {/* Phase 2 — Collaborators panel. Hidden for the
                        requester so they keep their "Support is helping
                        you" mental model. Collaborators see the panel
                        but read-only (no remove, no loop-in). */}
                    {ticket.viewerRole !== "requester" && (
                      <CollaboratorsPanel
                        ticketId={ticket.id}
                        courseId={ticket.courseId ?? null}
                        collaborators={ticket.collaborators ?? []}
                        readOnly={ticket.viewerRole === "collaborator"}
                        canManage={ticket.viewerRole === "support"}
                        suggestedDepartment={
                          categoryCatalog.find(
                            (c) => c.slug === ticket.category,
                          )?.suggestedDepartment ?? null
                        }
                        onChange={() => {
                          supportApi
                            .getTicket(ticket.id)
                            .then((d) => setTicket(d))
                            .catch(() => undefined);
                        }}
                      />
                    )}

                    {/* Phase 2 — Dedicated collaborator chat for support.
                        Shows the internal channel as a chat-style surface
                        so the agent has a focused place to talk with the
                        looped-in dept without scanning the main thread.
                        Only renders when there are collaborators to talk
                        to and the viewer is support. */}
                    {ticket.viewerRole === "support" &&
                      (ticket.collaborators?.length ?? 0) > 0 &&
                      user?.id && (
                        <CollaboratorChatPanel
                          ticketId={ticket.id}
                          comments={ticket.comments as any}
                          currentUserId={user.id}
                          composerEnabled={
                            ticket.status !== "closed" &&
                            ticket.status !== "resolved"
                          }
                          onSent={() => {
                            supportApi
                              .getTicket(ticket.id)
                              .then((d) => setTicket(d))
                              .catch(() => undefined);
                          }}
                        />
                      )}

                    {/* Phase 3 — Ticket↔Incident link. Lets the agent
                        attach this ticket to an active service-status
                        incident so the requester gets a system reply
                        (and optionally auto-resolve) when the admin
                        marks the incident resolved. */}
                    {ticket.viewerRole === "support" && (
                      <TicketIncidentLinker ticketId={ticket.id} />
                    )}

                    {/* Phase 2 — Transfer button (support/admin only).
                        Opens a modal that re-categorises + loops in the
                        target dept + posts a system message in the
                        public thread. */}
                    {ticket.viewerRole === "support" && (
                      <button
                        type="button"
                        onClick={() => setShowTransferModal(true)}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        {t("ticketDetail.actions.transfer")}
                      </button>
                    )}

                    {/* About this student — populated when the ticket
                        was filed about a third party (instructor →
                        support follow-up). Same data the BE prepends
                        inline to the description, in card form. */}
                    {ticket.aboutUser && (
                      <AboutThisStudentCard data={ticket.aboutUser} />
                    )}

                    {/* Student snapshot — at-a-glance profile so agents
                        don't ping-pong dashboards. Hidden for guest
                        tickets (nothing to look up). */}
                    <StudentSnapshotCard
                      ticketId={ticket.id}
                      isGuestTicket={!!ticket.isGuestTicket}
                    />

                    {/* Student timeline — chronological history of
                        every meaningful event for this student.
                        Collapsed-by-default so it doesn't dominate
                        the rail; lazy-fetched on first expand. */}
                    <StudentTimelineCard
                      ticketId={ticket.id}
                      isGuestTicket={!!ticket.isGuestTicket}
                    />

                    {/* Per-course certificate & CME panel — auto-expands
                        for cert/CME tickets so agents see the eligibility
                        breakdown without an extra click. */}
                    <CertificateDetailsCard
                      ticketId={ticket.id}
                      ticketCategory={ticket.category}
                      isGuestTicket={!!ticket.isGuestTicket}
                    />

                    {/* Trainer application panel — matched by email
                        (logged-in OR guest). Visible only when the
                        applicant has a role_request. Auto-expanded for
                        category='trainer'. View link goes to the
                        support read-only detail page. */}
                    <TrainerApplicationCard
                      ticketId={ticket.id}
                      ticketCategory={ticket.category}
                      detailHref={(id) =>
                        `/${locale}/dashboard/support/trainer-applications/${id}`
                      }
                    />

                    {/* Attachment audit panel — upload + removal
                        timeline (staff-visible) plus the per-attachment
                        download log (supervisor + admin only inside
                        the panel). Lazy-loaded on expand. */}
                    {isSupportOrAdmin && (
                      <AttachmentAuditPanel
                        ticketId={ticket.id}
                        canSeeDownloadLog={canManageAttachments}
                      />
                    )}

                    {/* CSAT — show only when student has rated */}
                    {ticket.satisfactionRating != null && (
                      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                          {t("ticketDetail.customerRating")}
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-5 h-5 ${
                                  star <= (ticket.satisfactionRating ?? 0)
                                    ? "text-[#EAB308] fill-[#EAB308]"
                                    : "text-[var(--color-icon)]"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {ticket.satisfactionRating} / 5
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Ticket Info */}
                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("ticketDetail.details")}
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">{t("ticketDetail.detailsLabels.category")}</span>
                          <span className="font-medium text-[var(--color-text-primary)] capitalize">
                            {ticket.category}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">{t("ticketDetail.detailsLabels.assignee")}</span>
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {ticket.assigneeName || t("ticketDetail.detailsLabels.unassigned")}
                          </span>
                        </div>
                        {ticket.courseName && (
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">{t("ticketDetail.detailsLabels.course")}</span>
                            <span className="font-medium text-[var(--color-text-primary)] text-right max-w-[150px] truncate">
                              {ticket.courseName}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">{t("ticketDetail.detailsLabels.created")}</span>
                          <span className="text-[var(--color-text-primary)]">
                            {new Date(ticket.createdAt).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                          </span>
                        </div>
                        {ticket.resolvedAt && (
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-secondary)]">{t("ticketDetail.detailsLabels.resolved")}</span>
                            <span className="text-[var(--color-text-primary)]">
                              {new Date(
                                ticket.resolvedAt,
                              ).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {isSupportOrAdmin &&
                      ticket.status !== "closed" && (
                        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                            {t("ticketDetail.actions.title")}
                          </h3>
                          <div className="space-y-2">
                            {isSupervisor && (
                              <div className="mb-2">
                                <button
                                  onClick={() => setShowReassign(!showReassign)}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-primary)] text-sm font-medium rounded-lg hover:bg-[#F0F4FF] disabled:opacity-50"
                                >
                                  <UserPlus className="w-4 h-4" />
                                  {t("ticketDetail.actions.reassign")}
                                </button>
                                {showReassign && (
                                  <div className="mt-2 space-y-1">
                                    {agents.filter(a => a.userId !== ticket.assigneeId).map(agent => (
                                      <button
                                        key={agent.userId}
                                        onClick={async () => {
                                          try {
                                            await supportApi.updateTicket(ticketId, { assigneeId: agent.userId });
                                            const data = await supportApi.getTicket(ticketId);
                                            setTicket(data);
                                            setShowReassign(false);
                                            toast.success(t("ticketDetail.toasts.reassigned", { name: [agent.firstName, agent.lastName].filter(Boolean).join(' ') }));
                                          } catch { toast.error(t("ticketDetail.toasts.reassignFailed")); }
                                        }}
                                        className={`w-full ${isRTL ? "text-right" : "text-left"} px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg flex items-center gap-2`}
                                      >
                                        <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[10px] text-white font-bold">
                                          {[agent.firstName?.[0], agent.lastName?.[0]].filter(Boolean).join('')}
                                        </div>
                                        {[agent.firstName, agent.lastName].filter(Boolean).join(' ') || agent.email}
                                        {agent.supportSubRole === 'supervisor' && <span className="text-xs text-[#8B5CF6]">{t("ticketDetail.actions.supervisorBadge")}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {isSupervisor && ticket.status !== "resolved" && (
                              <button
                                onClick={() => setShowEscalateModal(true)}
                                disabled={isUpdating}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                                  ticket.escalatedAt
                                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                                    : "border-[var(--color-border)] text-red-700 hover:bg-red-50"
                                }`}
                              >
                                <AlertTriangle className="w-4 h-4" />
                                {ticket.escalatedAt
                                  ? t("ticketDetail.actions.updateEscalation")
                                  : t("ticketDetail.actions.escalate")}
                              </button>
                            )}
                            {ticket.status !== "resolved" && (
                              <button
                                onClick={() => handleStatusChange("resolved")}
                                disabled={isUpdating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#22C55E] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                {t("ticketDetail.actions.resolve")}
                              </button>
                            )}
                            {ticket.status === "resolved" && (
                              <>
                                <button
                                  onClick={() => handleStatusChange("in_progress")}
                                  disabled={isUpdating}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  {t("ticketDetail.actions.reopen")}
                                </button>
                                <button
                                  onClick={() => handleStatusChange("closed")}
                                  disabled={isUpdating}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-text-secondary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                                >
                                  <XCircle className="w-4 h-4" />
                                  {t("ticketDetail.actions.close")}
                                </button>
                              </>
                            )}
                            {ticket.status !== "on_hold" &&
                              ticket.status !== "resolved" &&
                              !ticket.pendingHoldRequest && (
                                <button
                                  type="button"
                                  onClick={() => setShowHoldModal(true)}
                                  disabled={isUpdating}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                                >
                                  <Clock className="w-4 h-4" />
                                  {isSupervisor
                                    ? t("ticketDetail.actions.onHold")
                                    : t("ticketDetail.actions.requestOnHold")}
                                </button>
                              )}
                            {ticket.pendingHoldRequest && (
                              <PendingHoldBanner
                                request={ticket.pendingHoldRequest}
                                isSupervisor={isSupervisor}
                                isMyRequest={
                                  ticket.pendingHoldRequest.requestedBy === user?.id
                                }
                                isDeciding={isDecidingHold}
                                onDecide={handleHoldDecision}
                                t={t}
                              />
                            )}
                            {ticket.status === "on_hold" && (
                              <button
                                onClick={() =>
                                  handleStatusChange("in_progress")
                                }
                                disabled={isUpdating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                              >
                                {t("ticketDetail.actions.resume")}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* On-hold request modal — opened from the sidebar Status panel.
           Agent: submits hold request; Supervisor: self-holds directly. */}
      <HoldRequestModal
        isOpen={showHoldModal}
        onClose={() => setShowHoldModal(false)}
        onSubmit={handleHoldSubmit}
        isSubmitting={isSubmittingHold}
      />

      {/* In-app PDF / image preview modal — opened from any
          AttachmentChip whose file is preview-able. Download audit
          fires both when opening AND from the modal's download
          button. */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        onDownload={(att) => handleDownload(att)}
      />

      {/* Manual escalate modal — supervisor / admin only. Captures
          a free-text reason and an optional priority bump, then
          fans the notification out to assignee + supervisor + all
          admins. */}
      {showEscalateModal && ticket && (
        <EscalateTicketModal
          ticketId={ticket.id}
          ticketReference={ticket.referenceNumber || `#${ticket.id.substring(0, 8)}`}
          currentPriority={ticket.priority}
          alreadyEscalated={!!ticket.escalatedAt}
          onClose={() => setShowEscalateModal(false)}
          onEscalated={async () => {
            const data = await supportApi.getTicket(ticketId);
            setTicket(data);
          }}
        />
      )}

      {/* Phase 2 — Transfer ticket modal. Support reassigns the
          category + loops in the target department. The system
          message lands in the public thread so the requester sees
          they've been routed without seeing the dept user's name. */}
      {ticket && (
        <TransferTicketModal
          open={showTransferModal}
          onOpenChange={setShowTransferModal}
          ticketId={ticket.id}
          currentCategory={ticket.category}
          courseId={ticket.courseId ?? null}
          categories={categoryCatalog}
          onTransferred={async () => {
            const data = await supportApi.getTicket(ticketId);
            setTicket(data);
          }}
        />
      )}
    </>
  );
};

// Pending-hold banner shown in the sidebar Status panel. Renders
// different bodies depending on viewer role:
//   - Requester (agent): "Waiting for supervisor approval"
//   - Decider (supervisor / admin): two buttons (approve / reject)
//   - Anyone else with access: read-only info
function PendingHoldBanner({
  request,
  isSupervisor,
  isMyRequest,
  isDeciding,
  onDecide,
  t,
}: {
  request: NonNullable<TicketDetail["pendingHoldRequest"]>;
  isSupervisor: boolean;
  isMyRequest: boolean;
  isDeciding: boolean;
  onDecide: (
    requestId: string,
    decision: "approved" | "rejected",
    note?: string,
  ) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [note, setNote] = useState("");
  const requesterName =
    [request.requesterFirstName, request.requesterLastName]
      .filter(Boolean)
      .join(" ") || t("ticketDetail.holdBanner.unknownRequester");

  return (
    <div className="mt-2 p-3 border border-[#FDE68A] bg-[#FFFBEB] rounded-lg space-y-2">
      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 text-[#92400E] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#7C2D12]">
            {t("ticketDetail.holdBanner.pendingTitle")}
          </p>
          <p className="text-[11px] text-[#92400E] mt-0.5">
            {t("ticketDetail.holdBanner.requestedBy", { name: requesterName })}
          </p>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
            <span className="font-medium">
              {t("ticketDetail.holdBanner.reasonLabel")}:
            </span>{" "}
            {t(`ticketDetail.onHold.reasons.${request.reason}` as any)}
          </p>
          {request.description && (
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              <span className="font-medium">
                {t("ticketDetail.holdBanner.descriptionLabel")}:
              </span>{" "}
              {request.description}
            </p>
          )}
        </div>
      </div>

      {isSupervisor && !isMyRequest && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("ticketDetail.holdBanner.notePlaceholder")}
            maxLength={500}
            rows={2}
            disabled={isDeciding}
            className="w-full px-2 py-1.5 bg-white border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDecide(request.id, "approved", note.trim())}
              disabled={isDeciding}
              className="flex-1 px-3 py-1.5 bg-[#22C55E] text-white text-xs font-medium rounded hover:opacity-90 disabled:opacity-50"
            >
              {t("ticketDetail.holdBanner.approve")}
            </button>
            <button
              type="button"
              onClick={() => onDecide(request.id, "rejected", note.trim())}
              disabled={isDeciding}
              className="flex-1 px-3 py-1.5 bg-[#DC2626] text-white text-xs font-medium rounded hover:opacity-90 disabled:opacity-50"
            >
              {t("ticketDetail.holdBanner.reject")}
            </button>
          </div>
        </>
      )}

      {isMyRequest && (
        <p className="text-[11px] text-[var(--color-text-secondary)] italic">
          {t("ticketDetail.holdBanner.waitingForApproval")}
        </p>
      )}
    </div>
  );
}

export default TicketDetailContent;
