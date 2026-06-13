"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import { roleLabelForComment } from "@/components/support-shared/CollaboratorTicketView";

/**
 * Support-side chat panel for talking to looped-in collaborators
 * without leaving the ticket detail.
 *
 * Mounts in the right column under "Involved Departments". Reads from
 * the comments array the parent already loaded (so no extra API round
 * trip) and filters down to internal messages. Composer sends with
 * isInternal=true so the agent never has to think about which channel
 * they're on — this UI is the channel.
 *
 * The main thread above continues to show ALL messages (public +
 * internal) so the audit context stays intact. This panel is a
 * focused-surface addition, not a replacement.
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
  /** Phase 2 — if the commenter was looped-in on this ticket, BE
   *  returns the dept they joined as. Takes precedence over userRole
   *  so a multi-role person reads as the role they're acting as
   *  (e.g. an agent looped-in as Course Manager shows "Course Manager"
   *  not "Support"). */
  collabDepartment?: string | null;
};

interface Props {
  ticketId: string;
  comments: Comment[];
  /** Current viewer's userId — drives the bubble alignment + "You" label. */
  currentUserId: string;
  /** Whether the panel can be used at all (closed/resolved tickets
   *  should still show history but disable the composer). */
  composerEnabled: boolean;
  /** Called after a successful send so the parent can refetch the
   *  ticket and the new bubble appears. */
  onSent: () => void;
}

export default function CollaboratorChatPanel({
  ticketId,
  comments,
  currentUserId,
  composerEnabled,
  onSent,
}: Props) {
  const t = useTranslations("supportDashboard.ticketDetail.collabChat");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Just the internal channel — supports the focused-surface model.
  // System messages stay (e.g. "looped in Finance") so the panel
  // has continuity even when there's no human reply yet.
  const internalComments = comments.filter((c) => c.isInternal);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [internalComments.length]);

  const handleSend = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await supportApi.addComment(ticketId, {
        message: reply.trim(),
        isInternal: true,
      });
      setReply("");
      onSent();
    } catch (e: any) {
      toast.error(e?.message || t("sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[#FFFBEB]">
        <MessageSquare className="w-4 h-4 text-[#B45309]" />
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("title")}
        </span>
        <span className="text-[10px] text-[var(--color-text-secondary)] ms-auto">
          {t("subtitle")}
        </span>
      </div>

      {/* Thread */}
      <div className="px-4 py-3 space-y-3 max-h-[360px] overflow-y-auto">
        {internalComments.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-7 h-7 mx-auto text-[var(--color-text-secondary)]/30 mb-2" />
            <p className="text-xs font-medium text-[var(--color-text-primary)] mb-0.5">
              {t("emptyTitle")}
            </p>
            <p className="text-[11px] text-[var(--color-text-secondary)] max-w-xs mx-auto">
              {t("emptyHint")}
            </p>
          </div>
        ) : (
          internalComments.map((c) => (
            <Bubble
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              fmt={fmt}
              t={t}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--color-border-subtle)] px-3 py-2.5">
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
            placeholder={
              composerEnabled
                ? t("composerPlaceholder")
                : t("composerDisabledPlaceholder")
            }
            rows={2}
            disabled={!composerEnabled || sending}
            className="w-full px-3 py-2 pe-11 text-sm rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!composerEnabled || !reply.trim() || sending}
            className="absolute end-2 bottom-2 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={t("sendReply")}
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1.5">
          {t("composerHint")}
        </p>
      </div>
    </div>
  );
}

function Bubble({
  comment,
  currentUserId,
  fmt,
  t,
}: {
  comment: Comment;
  currentUserId: string;
  fmt: Intl.DateTimeFormat;
  t: ReturnType<typeof useTranslations>;
}) {
  if (comment.isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-3 py-1.5 rounded-full bg-[var(--color-surface-page)] text-[11px] text-[var(--color-text-secondary)]">
          {comment.message}
        </div>
      </div>
    );
  }

  const isSelf = comment.userId === currentUserId;
  const authorName =
    [comment.userFirstName, comment.userLastName].filter(Boolean).join(" ") ||
    t("unknownAuthor");
  const initials =
    authorName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  const roleLabel = roleLabelForComment(comment);

  return (
    <div className={`flex gap-2 ${isSelf ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
          isSelf
            ? "bg-[var(--color-primary)] text-white"
            : "bg-[#FDE68A] text-[#78350F]"
        }`}
      >
        {initials}
      </div>
      <div className={`max-w-[85%] ${isSelf ? "items-end flex flex-col" : ""}`}>
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">
            {authorName}
          </span>
          {roleLabel && (
            <span className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
              {roleLabel}
            </span>
          )}
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {fmt.format(new Date(comment.createdAt))}
          </span>
        </div>
        <div
          className={`px-3 py-2 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed ${
            isSelf
              ? "bg-[var(--color-primary)] text-white rounded-tr-sm"
              : "bg-[#FFFBEB] text-[#78350F] border border-[#FDE68A] rounded-tl-sm"
          }`}
        >
          {comment.message}
        </div>
      </div>
    </div>
  );
}
