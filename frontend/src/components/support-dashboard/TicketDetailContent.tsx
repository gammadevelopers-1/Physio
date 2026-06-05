"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { toast } from "sonner";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import {
  ArrowLeft,
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
} from "lucide-react";

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
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string | null;
  attachmentUrl: string | null;
  satisfactionRating: number | null;
  comments: {
    id: string;
    message: string;
    isStaffReply: boolean;
    isInternal: boolean;
    createdAt: string;
    userId: string;
    userFirstName: string | null;
    userLastName: string | null;
  }[];
  slaPolicy: {
    frtMinutes: number;
    ttrMinutes: number;
  } | null;
  frtDeadline: string | null;
  ttrDeadline: string | null;
  frtRemainingMinutes: number | null;
  ttrRemainingMinutes: number | null;
}

const TicketDetailContent = () => {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();

  const ticketId = params?.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [showReassign, setShowReassign] = useState(false);
  const [showHoldPicker, setShowHoldPicker] = useState(false);
  const [holdReason, setHoldReason] = useState<string>("waiting for student response");
  const [macros, setMacros] = useState<any[]>([]);
  const [showMacroDropdown, setShowMacroDropdown] = useState(false);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isApplyingMacro, setIsApplyingMacro] = useState(false);

  const isSupportOrAdmin =
    user?.roles?.includes("SUPPORT") ||
    user?.roles?.includes("ADMIN") ||
    user?.roles?.includes("SUPER_ADMIN");
  const isSupervisor = user?.supportSubRole === "supervisor";

  const profile = useSupportProfile();

  useEffect(() => {
    if (isSupervisor) {
      supportApi.getAgents().then(data => setAgents(data || [])).catch(() => {});
    }
  }, [isSupervisor]);

  useEffect(() => {
    if (isSupportOrAdmin) {
      supportApi.getMacros().then(data => setMacros(data || [])).catch(() => {});
    }
  }, [isSupportOrAdmin]);

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
    setIsSending(true);
    try {
      await supportApi.addComment(ticketId, {
        message: replyMessage.trim(),
        isInternal,
      });
      setReplyMessage("");
      setIsInternal(false);
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
    closed: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };

  return (
    <>
      <SupportNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar
                profile={profile}
                supportSubRole={user?.supportSubRole}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* Back Button */}
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4"
              >
                <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                {t("ticketDetail.backToTickets")}
              </button>

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
                    {/* Ticket Header */}
                    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                            {ticket.subject}
                          </h1>
                          <p className="text-sm text-[var(--color-text-secondary)] font-mono">
                            #{ticket.id.substring(0, 8)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
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
                        </div>
                      </div>
                      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                        {ticket.description}
                      </p>
                      {ticket.attachmentUrl && (
                        <a
                          href={ticket.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          {t("ticketDetail.openAttachment")}
                        </a>
                      )}
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
                            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                              {comment.message}
                            </p>
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
                                onClick={() => setShowMacroDropdown(!showMacroDropdown)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-primary)] bg-[#EFF6FF] rounded hover:bg-[#DBEAFE] transition-colors"
                              >
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                                {t("ticketDetail.applyMacro")}
                              </button>
                              {showMacroDropdown && (
                                <div className={`absolute top-full ${isRTL ? "right-0" : "left-0"} mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-20 min-w-[200px] py-1`}>
                                  {macros.map(macro => (
                                    <button
                                      key={macro.id}
                                      onClick={async () => {
                                        setIsApplyingMacro(true);
                                        try {
                                          const result = await supportApi.applyMacro(ticketId, macro.id);
                                          setMacroPreview(result.resolvedBody);
                                          setShowMacroDropdown(false);
                                        } catch { toast.error(t("ticketDetail.toasts.applyMacroFailed")); }
                                        finally { setIsApplyingMacro(false); }
                                      }}
                                      className={`w-full ${isRTL ? "text-right" : "text-left"} px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]`}
                                    >
                                      {macro.title}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {isSupportOrAdmin && (
                            <label className={`flex items-center gap-1.5 ${isRTL ? "mr-auto" : "ml-auto"} cursor-pointer`}>
                              <input
                                type="checkbox"
                                checked={isInternal}
                                onChange={(e) =>
                                  setIsInternal(e.target.checked)
                                }
                                className="w-4 h-4 rounded border-[var(--color-input-border)]"
                              />
                              <Lock className="w-3.5 h-3.5 text-[#D97706]" />
                              <span className="text-xs text-[var(--color-text-secondary)]">
                                {t("ticketDetail.internalNote")}
                              </span>
                            </label>
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
                          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {[ticket.studentFirstName, ticket.studentLastName]
                              .filter(Boolean)
                              .join(" ") || t("ticketDetail.unknownAuthor")}
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

                    {/* SLA Panel — Live Countdown */}
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
                            {/* FRT remaining time */}
                            {!ticket.firstResponseAt && !ticket.slaBreachedFrt && ticket.frtRemainingMinutes != null && (
                              <div>
                                <div className="flex justify-between items-center">
                                  <span className={`text-xs font-semibold ${
                                    ticket.frtRemainingMinutes > ticket.slaPolicy.frtMinutes * 0.5
                                      ? "text-[#22C55E]"
                                      : ticket.frtRemainingMinutes > ticket.slaPolicy.frtMinutes * 0.1
                                        ? "text-[#F59E0B]"
                                        : "text-[#EF4444]"
                                  }`}>
                                    {t("ticketDetail.sla.remaining", { value: formatDuration(ticket.frtRemainingMinutes) })}
                                  </span>
                                </div>
                                <div className="w-full bg-[var(--color-border-subtle)] rounded-full h-1.5 mt-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      ticket.frtRemainingMinutes > ticket.slaPolicy.frtMinutes * 0.5
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
                            )}
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
                            {/* TTR remaining time */}
                            {!ticket.resolvedAt && !ticket.slaBreachedTtr && ticket.ttrRemainingMinutes != null && (
                              <div>
                                <div className="flex justify-between items-center">
                                  <span className={`text-xs font-semibold ${
                                    ticket.ttrRemainingMinutes > ticket.slaPolicy.ttrMinutes * 0.5
                                      ? "text-[#22C55E]"
                                      : ticket.ttrRemainingMinutes > ticket.slaPolicy.ttrMinutes * 0.1
                                        ? "text-[#F59E0B]"
                                        : "text-[#EF4444]"
                                  }`}>
                                    {t("ticketDetail.sla.remaining", { value: formatDuration(ticket.ttrRemainingMinutes) })}
                                  </span>
                                </div>
                                <div className="w-full bg-[var(--color-border-subtle)] rounded-full h-1.5 mt-1.5">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      ticket.ttrRemainingMinutes > ticket.slaPolicy.ttrMinutes * 0.5
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
                            )}
                            {ticket.slaBreachedTtr && ticket.ttrRemainingMinutes != null && (
                              <span className="text-xs text-[#EF4444]">
                                {t("ticketDetail.sla.overdueBy", { value: formatDuration(Math.abs(ticket.ttrRemainingMinutes)) })}
                              </span>
                            )}
                            {ticket.status === "on_hold" && (
                              <span className="text-xs text-[#F59E0B] flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" /> {t("ticketDetail.sla.pausedOnHold")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

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
                              ticket.status !== "resolved" && (
                                <div>
                                  <button
                                    onClick={() => setShowHoldPicker(!showHoldPicker)}
                                    disabled={isUpdating}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                                  >
                                    <Clock className="w-4 h-4" />
                                    {t("ticketDetail.actions.onHold")}
                                  </button>
                                  {showHoldPicker && (
                                    <div className="mt-2 p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-page)] space-y-2">
                                      <label className="block text-xs text-[var(--color-text-secondary)]">
                                        {t("ticketDetail.onHold.selectReason")}
                                      </label>
                                      <select
                                        value={holdReason}
                                        onChange={(e) => setHoldReason(e.target.value)}
                                        className="w-full h-9 px-2 border border-[var(--color-border)] rounded-md text-sm bg-white"
                                      >
                                        {[
                                          "waiting for student response",
                                          "waiting for third party",
                                          "waiting for internal team",
                                          "pending investigation",
                                          "other",
                                        ].map((reason) => (
                                          <option key={reason} value={reason}>
                                            {t(`ticketDetail.onHold.reasons.${reason}` as any)}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={async () => {
                                            await handleStatusChange("on_hold", { onHoldReason: holdReason });
                                            setShowHoldPicker(false);
                                          }}
                                          disabled={isUpdating}
                                          className="flex-1 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50"
                                        >
                                          {t("ticketDetail.onHold.confirm")}
                                        </button>
                                        <button
                                          onClick={() => setShowHoldPicker(false)}
                                          className="px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium rounded-md hover:bg-white"
                                        >
                                          {t("ticketDetail.onHold.cancel")}
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
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
    </>
  );
};

export default TicketDetailContent;
