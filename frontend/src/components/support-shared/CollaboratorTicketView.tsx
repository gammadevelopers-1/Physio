"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  Send,
  User as UserIcon,
  BookOpen,
  Tag as TagIcon,
} from "lucide-react";
import Link from "next/link";
import { supportApi } from "@/lib/api";
import AttachmentChip, {
  type Attachment as ChipAttachment,
} from "@/components/support-dashboard/AttachmentChip";
import LinkifiedText from "@/components/support/LinkifiedText";
import StudentSnapshotCard from "@/components/support-dashboard/StudentSnapshotCard";
import CertificateDetailsCard from "@/components/support-dashboard/CertificateDetailsCard";
import AboutThisStudentCard from "@/components/support-shared/AboutThisStudentCard";

/**
 * Dedicated ticket view for collaborators (looped-in roles).
 *
 * Two-pane mental model — distinct from the support agent's view:
 *   • Top "Requester context" card — the original ticket + the
 *     requester's public messages, read-only. Lets the collaborator
 *     see what the customer actually said without participating in
 *     that conversation.
 *   • Main "Talk with Support" chat — internal-only thread between
 *     support and every looped-in collaborator. Composer below.
 *
 * No reply-to-requester composer here; collaborators never speak to
 * the customer directly (hub-and-spoke model). The BE's visibility
 * matrix already enforces this, but giving them a separate UI makes
 * it impossible to be confused about which channel they're posting in.
 */

type Comment = {
  id: string;
  message: string;
  isStaffReply: boolean;
  isInternal: boolean;
  isSystem?: boolean;
  createdAt: string;
  userId: string;
  userFirstName: string | null;
  userLastName: string | null;
  userRole?: "super_admin" | "admin" | "supervisor" | "agent" | "student" | null;
  attachments?: ChipAttachment[];
};

type Ticket = {
  id: string;
  referenceNumber?: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string | null;
  courseId?: string | null;
  courseTitle?: string | null;
  attachments?: ChipAttachment[];
  comments: Comment[];
  viewerRole?: "support" | "collaborator" | "requester" | "none";
  isGuestTicket?: boolean;
  aboutUser?: import("@/components/support-shared/AboutThisStudentCard").AboutUserData | null;
};

interface Props {
  /** Where the back link should point — usually the dashboard's
   *  "Assisting Support" inbox, e.g. /en/dashboard/manager/support/looped-in */
  backHref: string;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-[#DBEAFE] text-[#1E40AF] ring-[#93C5FD]",
  in_progress: "bg-[#FEF3C7] text-[#92400E] ring-[#FBBF24]",
  on_hold: "bg-[#F1F5F9] text-[#475569] ring-[#CBD5E1]",
  resolved: "bg-[#DCFCE7] text-[#166534] ring-[#86EFAC]",
  closed: "bg-[#F3F4F6] text-[#4B5563] ring-[#D1D5DB]",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-[#FEE2E2] text-[#B91C1C]",
  medium: "bg-[#FFEDD5] text-[#9A3412]",
  low: "bg-[#DCFCE7] text-[#166534]",
};

export default function CollaboratorTicketView({ backHref }: Props) {
  const params = useParams();
  const ticketId = (params?.id as string) || "";
  const t = useTranslations("supportDashboard.ticketDetail");
  const tStatus = useTranslations(
    "supportDashboard.ticketDetail.timeline.status.ticket",
  );
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    setIsLoading(true);
    supportApi
      .getTicket(ticketId)
      .then((data: any) => {
        if (cancelled) return;
        setTicket(data as Ticket);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || "Failed to load ticket");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.comments?.length]);

  const handleSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      // Always internal — collaborators never reach the requester.
      await supportApi.addComment(ticketId, {
        message: reply.trim(),
        isInternal: true,
      });
      setReply("");
      const refreshed = await supportApi.getTicket(ticketId);
      setTicket(refreshed as Ticket);
    } catch (e: any) {
      toast.error(e?.message || t("toasts.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </main>
    );
  }

  if (error || !ticket) {
    return (
      <main className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
            {t("loadError")}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">
            {error || ""}
          </p>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("backToInbox")}
          </Link>
        </div>
      </main>
    );
  }

  const publicComments = ticket.comments.filter((c) => !c.isInternal);
  const internalComments = ticket.comments.filter((c) => c.isInternal);
  const customerName =
    [ticket.studentFirstName, ticket.studentLastName]
      .filter(Boolean)
      .join(" ") || t("anonymousRequester");
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="min-h-screen bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-[1280px] mx-auto px-4 py-5">
        {/* Back link — sticks to the very top so the agent can always
            get out of the chat with one click, regardless of how far
            they've scrolled through the conversation. */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-4"
        >
          <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
          {t("backToInbox")}
        </Link>

        {/* Ticket header — full-width banner. */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] font-mono">
              {ticket.referenceNumber || ticket.id.slice(0, 8)}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase font-bold tracking-wide rounded-full ring-1 ring-inset ${
                STATUS_STYLES[ticket.status] || ""
              }`}
            >
              {tStatus(ticket.status as any)}
            </span>
            {ticket.priority && (
              <span
                className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase font-bold tracking-wide rounded-full ${
                  PRIORITY_STYLES[ticket.priority] || ""
                }`}
              >
                {ticket.priority}
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-[var(--color-text-primary)] mb-3">
            {ticket.subject}
          </h1>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <MetaItem
              icon={<UserIcon className="w-3.5 h-3.5" />}
              label={t("requesterLabel")}
              value={customerName}
            />
            {ticket.courseTitle && (
              <MetaItem
                icon={<BookOpen className="w-3.5 h-3.5" />}
                label={t("courseLabel")}
                value={ticket.courseTitle}
              />
            )}
            <MetaItem
              icon={<TagIcon className="w-3.5 h-3.5" />}
              label={t("categoryLabel")}
              value={ticket.category}
            />
          </div>
        </div>

        {/* Two-column layout from here down. Chat + requester context
            on the left, requester info rail on the right. Stacks on
            mobile so nothing fights for space. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">

        {/* Requester's context (collapsible) */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setContextOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-[var(--color-surface-page)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t("collab.requesterContextTitle")}
              </span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                {t("collab.readOnly")}
              </span>
            </div>
            {contextOpen ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
          </button>
          {contextOpen && (
            <div className="px-5 pb-5 border-t border-[var(--color-border-subtle)] pt-4 space-y-4">
              {/* Original description */}
              <div className="rounded-xl bg-[var(--color-surface-page)] p-4 border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={customerName} />
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {customerName}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] ms-auto">
                    {fmt.format(new Date(ticket.createdAt))}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                  <LinkifiedText text={ticket.description} />
                </p>
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {ticket.attachments.map((a) => (
                      <AttachmentChip key={a.id} attachment={a} />
                    ))}
                  </div>
                )}
              </div>

              {/* Public replies from the requester */}
              {publicComments
                .filter((c) => !c.isStaffReply)
                .map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl bg-[var(--color-surface-page)] p-4 border border-[var(--color-border-subtle)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar name={customerName} />
                      <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {customerName}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)] ms-auto">
                        {fmt.format(new Date(c.createdAt))}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                      <LinkifiedText text={c.message} />
                    </p>
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {c.attachments.map((a) => (
                          <AttachmentChip key={a.id} attachment={a} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

              {publicComments.filter((c) => !c.isStaffReply).length === 0 && (
                <p className="text-[11px] text-[var(--color-text-secondary)] text-center py-1">
                  {t("collab.noFurtherReplies")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Talk with Support — internal chat */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[#FFFBEB]">
            <MessageSquare className="w-4 h-4 text-[#B45309]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("collab.talkWithSupportTitle")}
            </span>
            <span className="text-[10px] text-[var(--color-text-secondary)] ms-auto">
              {t("collab.privateChannel")}
            </span>
          </div>

          {/* Thread */}
          <div className="px-5 py-4 space-y-3 max-h-[460px] overflow-y-auto">
            {internalComments.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare className="w-8 h-8 mx-auto text-[var(--color-text-secondary)]/30 mb-2" />
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  {t("collab.startConversation")}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("collab.startConversationHint")}
                </p>
              </div>
            ) : (
              internalComments.map((c) => (
                <InternalBubble key={c.id} comment={c} fmt={fmt} t={t} />
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-[var(--color-border-subtle)] px-5 py-3">
            <div className="relative">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t("collab.replyPlaceholder")}
                rows={3}
                disabled={sending}
                className="w-full px-3 py-2.5 pe-12 text-sm rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!reply.trim() || sending}
                className="absolute end-2 bottom-2 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={t("collab.sendReply")}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1.5">
              {t("collab.composerHint")}
            </p>
          </div>
        </div>

          </div>

          {/* Right info rail — read-only requester context that helps
              the collaborator answer Support without asking back.
              Deliberately limited:
                ✓ About-this-student (when ticket is filed about a 3rd
                  party — instructor follow-up case)
                ✓ Student snapshot (courses, attendance, certs, CME,
                  payments — at-a-glance profile)
                ✓ Certificate & CME details (auto-expands for cert
                  category tickets)
              ✗ Recent activity / timeline — audit detail, not useful
              ✗ Attachment audit panel — internal compliance surface
              ✗ Trainer application — only meaningful for support */}
          <aside className="space-y-4">
            {ticket.aboutUser && (
              <AboutThisStudentCard data={ticket.aboutUser} />
            )}
            <StudentSnapshotCard
              ticketId={ticket.id}
              isGuestTicket={!!ticket.isGuestTicket}
            />
            <CertificateDetailsCard
              ticketId={ticket.id}
              ticketCategory={ticket.category}
              isGuestTicket={!!ticket.isGuestTicket}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm text-[var(--color-text-primary)] truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function InternalBubble({
  comment,
  fmt,
  t,
}: {
  comment: Comment;
  fmt: Intl.DateTimeFormat;
  t: ReturnType<typeof useTranslations>;
}) {
  const isFromSupport = comment.isStaffReply;
  const authorName =
    [comment.userFirstName, comment.userLastName].filter(Boolean).join(" ") ||
    t("collab.unknownAuthor");

  if (comment.isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 rounded-full bg-[var(--color-surface-page)] text-[11px] text-[var(--color-text-secondary)]">
          {comment.message}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isFromSupport ? "" : "flex-row-reverse"}`}>
      <Avatar name={authorName} tone={isFromSupport ? "support" : "self"} />
      <div className={`max-w-[80%] ${isFromSupport ? "" : "items-end flex flex-col"}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">
            {isFromSupport ? t("collab.supportLabel") : t("collab.youLabel")}
          </span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {fmt.format(new Date(comment.createdAt))}
          </span>
        </div>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
            isFromSupport
              ? "bg-[#FFFBEB] text-[#78350F] border border-[#FDE68A] rounded-tl-sm"
              : "bg-[var(--color-primary)] text-white rounded-tr-sm"
          }`}
        >
          <LinkifiedText text={comment.message} />
        </div>
        {comment.attachments && comment.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {comment.attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({
  name,
  tone = "neutral",
}: {
  name: string;
  tone?: "self" | "support" | "neutral";
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  const cls =
    tone === "self"
      ? "bg-[var(--color-primary)] text-white"
      : tone === "support"
      ? "bg-[#FDE68A] text-[#78350F]"
      : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)]";
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${cls}`}
    >
      {initials}
    </div>
  );
}
