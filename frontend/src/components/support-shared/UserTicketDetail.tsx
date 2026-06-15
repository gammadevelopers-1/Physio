"use client";

/**
 * Role-agnostic Ticket Detail.
 *
 * Mirrors the student dashboard's TicketDetailView but takes a
 * `renderShell` prop so each role dashboard (Instructor, Course
 * Manager, Finance, TA) can wrap the view in its own navbar +
 * sidebar. Uses the shared `userSupport.*` i18n namespace.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Paperclip,
  RefreshCw,
  Send,
  Star,
  Tag,
  User,
} from "lucide-react";
import { useTicketDetail } from "@/hooks/support/useMyTickets";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDateReadable } from "@/lib/platform-locale";
import { FmtDate } from "@/components/ui/Fmt";
import { supportApi, uploadFormData } from "@/lib/api";
import type { TicketReply, TicketStatus } from "@/types/student-dashboard";
import AttachmentChip, {
  type Attachment as ChipAttachment,
} from "@/components/support-dashboard/AttachmentChip";
import LinkifiedText from "@/components/support/LinkifiedText";
import CsatReviewCard from "@/components/support-dashboard/CsatReviewCard";
import AboutThisStudentCard, {
  type AboutUserData,
} from "@/components/support-shared/AboutThisStudentCard";
import AttachmentPreviewModal, {
  type PreviewableAttachment,
} from "@/components/support-dashboard/AttachmentPreviewModal";

const REOPEN_GRACE_MS = 48 * 60 * 60 * 1000;

export interface UserTicketDetailProps {
  ticketId: string;
  onBack: () => void;
  renderShell: (children: ReactNode) => ReactNode;
}

function StatusBadge({
  status,
  t,
}: {
  status: TicketStatus | string;
  t: ReturnType<typeof useTranslations>;
}) {
  const styles: Record<string, string> = {
    new: "bg-[#DBEAFE] text-[#1D4ED8]",
    in_progress: "bg-[#FEF9C3] text-[#A16207]",
    on_hold: "bg-[#FEF3C7] text-[#B45309]",
    resolved: "bg-[#DCFCE7] text-[#15803D]",
    closed: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };
  const icons: Record<string, ReactNode> = {
    new: <AlertCircle className="w-3.5 h-3.5" />,
    in_progress: <Clock className="w-3.5 h-3.5" />,
    on_hold: <Clock className="w-3.5 h-3.5" />,
    resolved: <CheckCircle2 className="w-3.5 h-3.5" />,
    closed: <CheckCircle2 className="w-3.5 h-3.5" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${styles[status] ?? ""}`}
    >
      {icons[status]}
      {t(`status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

function ReplyBubble({
  reply,
  locale,
  onPreview,
}: {
  reply: TicketReply;
  locale: string;
  onPreview?: (att: ChipAttachment) => void;
}) {
  const isRTL = locale === "ar";
  const isStaff = reply.isStaffReply;
  const attachments = reply.attachments || [];

  return (
    <div
      className={`flex ${isStaff ? "justify-start" : "justify-end"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] ${
          isStaff
            ? "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)] rounded-tl-sm"
            : "bg-[var(--color-primary)] text-white rounded-tr-sm"
        } rounded-2xl p-3 sm:p-4 shadow-sm`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <User
            className={`w-3 h-3 ${
              isStaff ? "text-[var(--color-text-secondary)]" : "text-white/70"
            }`}
          />
          <span
            className={`text-[10px] sm:text-xs font-medium ${
              isStaff ? "text-[var(--color-text-secondary)]" : "text-white/85"
            }`}
          >
            {reply.userName}
          </span>
        </div>
        <p
          className={`text-xs sm:text-sm whitespace-pre-wrap leading-relaxed break-words ${
            isStaff ? "text-[var(--color-text-primary)]" : "text-white"
          }`}
        >
          <LinkifiedText
            text={reply.message}
            linkClassName={
              isStaff
                ? "text-[var(--color-primary)] underline decoration-1 underline-offset-2 hover:opacity-80 break-all"
                : "text-white underline decoration-1 underline-offset-2 hover:opacity-80 break-all"
            }
          />
        </p>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
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
                onPreview={onPreview}
              />
            ))}
          </div>
        )}
        <p
          className={`text-[10px] mt-1.5 ${
            isStaff ? "text-[var(--color-text-secondary)]" : "text-white/70"
          }`}
        >
          <FmtDate
            value={reply.createdAt}
            variant="readable"
            locale={isRTL ? "ar" : "en"}
            includeTime
          />
        </p>
      </div>
    </div>
  );
}

function SatisfactionRating({
  currentRating,
  ticketId,
  t,
  onRated,
}: {
  currentRating: number | null;
  ticketId: string;
  t: ReturnType<typeof useTranslations>;
  onRated: () => void;
}) {
  const [rating, setRating] = useState(currentRating ?? 0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!currentRating);

  const handleRate = async (value: number) => {
    if (submitted) return;
    setRating(value);
    setSubmitting(true);
    try {
      await supportApi.rateTicket(ticketId, value);
      setSubmitted(true);
      onRated();
    } catch {
      setRating(currentRating ?? 0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 p-4 sm:p-5 bg-gradient-to-br from-[var(--color-border-subtle)] to-[var(--color-surface-page)] rounded-xl border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-4 h-4 text-[#EAB308]" />
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("detail.rateExperience")}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={submitting || submitted}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !submitted && setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-0.5 disabled:cursor-default transition-transform hover:scale-110 disabled:hover:scale-100"
            aria-label={`Rate ${star} ${star === 1 ? "star" : "stars"}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= (hoveredStar || rating)
                  ? "text-[#EAB308] fill-[#EAB308]"
                  : "text-[var(--color-icon)]"
              }`}
            />
          </button>
        ))}
        {submitted && (
          <span className="ms-3 text-xs text-[#15803D] font-medium inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t("detail.thankYou")}
          </span>
        )}
      </div>
    </div>
  );
}

function formatHoursLeft(ms: number, isAr: boolean): string {
  const hours = Math.max(0, Math.floor(ms / (60 * 60 * 1000)));
  const mins = Math.max(0, Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000)));
  if (hours >= 1) return isAr ? `${hours} ساعة` : `${hours}h ${mins}m`;
  return isAr ? `${mins} دقيقة` : `${mins}m`;
}

type PendingReplyAttachment = {
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
};

const REPLY_MAX_FILES = 10;
const REPLY_MAX_BYTES = 5 * 1024 * 1024;
const REPLY_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const UserTicketDetail = ({
  ticketId,
  onBack,
  renderShell,
}: UserTicketDetailProps) => {
  const locale = useLocale();
  const t = useTranslations("userSupport");
  const isRTL = locale === "ar";
  const isAr = locale === "ar";

  const { data: ticket, loading, refetch } = useTicketDetail(ticketId);
  const platformLocale = usePlatformLocale();

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewAttachment, setPreviewAttachment] =
    useState<PreviewableAttachment | null>(null);
  const [pendingReplyAttachments, setPendingReplyAttachments] = useState<
    PendingReplyAttachment[]
  >([]);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  async function uploadOneReply(att: PendingReplyAttachment) {
    setPendingReplyAttachments((curr) =>
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
      setPendingReplyAttachments((curr) =>
        curr.map((a) =>
          a.id === att.id
            ? { ...a, status: "done" as const, url: data.url }
            : a,
        ),
      );
    } catch {
      setPendingReplyAttachments((curr) =>
        curr.map((a) =>
          a.id === att.id ? { ...a, status: "error" as const } : a,
        ),
      );
    }
  }

  function handleReplyAttachmentsAdded(files: File[]) {
    const accepted: PendingReplyAttachment[] = [];
    for (const file of files) {
      if (
        pendingReplyAttachments.length + accepted.length >=
        REPLY_MAX_FILES
      )
        break;
      if (!REPLY_ALLOWED_TYPES.has(file.type)) continue;
      if (file.size > REPLY_MAX_BYTES) continue;
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        status: "queued",
      });
    }
    if (accepted.length === 0) return;
    setPendingReplyAttachments((curr) => [...curr, ...accepted]);
    for (const att of accepted) void uploadOneReply(att);
  }

  function removePendingReply(id: string) {
    setPendingReplyAttachments((curr) => curr.filter((a) => a.id !== id));
  }

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const graceInfo = useMemo(() => {
    if (!ticket) return null;
    if (ticket.status !== "closed" || !ticket.closedAt) return null;
    const closedAt = new Date(ticket.closedAt).getTime();
    const remaining = closedAt + REOPEN_GRACE_MS - Date.now();
    return { remaining, inGrace: remaining > 0 };
  }, [ticket]);

  const canReply =
    ticket &&
    (ticket.status !== "closed" || (graceInfo?.inGrace ?? false));

  const isResolvedOrInGrace =
    ticket && (ticket.status === "resolved" || ticket.status === "closed");

  const showRating =
    ticket && (ticket.status === "resolved" || ticket.status === "closed");

  const threadEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ticket || ticket.replies.length === 0) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ticket?.replies.length, ticket]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticketId) return;
    if (
      pendingReplyAttachments.some(
        (a) => a.status === "queued" || a.status === "uploading",
      )
    )
      return;
    setSending(true);
    try {
      // Rich attachments so the BE persists filename/mimeType/sizeBytes
      // and the chip on the thread renders as a proper PDF / image
      // card instead of a generic "Attachment" placeholder.
      const doneAtts = pendingReplyAttachments.filter(
        (a) => a.status === "done" && a.url,
      );
      const richAtts = doneAtts.map((a) => ({
        url: a.url!,
        filename: a.file.name,
        mimeType: a.file.type || undefined,
        sizeBytes: a.file.size,
      }));
      await supportApi.addComment(ticketId, {
        message: replyText.trim(),
        attachments: richAtts.length > 0 ? richAtts : undefined,
      });
      setReplyText("");
      setPendingReplyAttachments([]);
      refetch();
    } catch {
      /* surface via toast in future; silent for now matches student behavior */
    } finally {
      setSending(false);
    }
  };

  function retryReplyAttachment(id: string) {
    const item = pendingReplyAttachments.find((a) => a.id === id);
    if (!item) return;
    setPendingReplyAttachments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "queued" as const, errorMessage: undefined }
          : a,
      ),
    );
    void uploadOneReply(item);
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const formatDate = (dateStr: string | null) =>
    formatPlatformDateReadable(
      dateStr,
      platformLocale,
      locale === "ar" ? "ar" : "en",
    );

  const handlePreviewAttachment = (att: ChipAttachment) =>
    setPreviewAttachment(att);

  // Resolve category label. next-intl returns the key path on miss instead
  // of throwing, so detect that and fall back to the raw slug — admin-
  // extensible categories outside the builtin set would otherwise render
  // as `userSupport.category.xyz`.
  let categoryLabel = "";
  if (ticket) {
    try {
      const translated = t(
        `category.${ticket.category}` as Parameters<typeof t>[0],
      );
      const fullKey = `userSupport.category.${ticket.category}`;
      categoryLabel =
        translated && translated !== fullKey && translated !== `category.${ticket.category}`
          ? translated
          : ticket.category;
    } catch {
      categoryLabel = ticket.category;
    }
  }

  const body = (
    <>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          {t("backToTickets")}
        </button>
        {ticket && !loading && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label={t("refresh")}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">{t("refresh")}</span>
          </button>
        )}
      </div>

      {loading || !ticket ? (
        <div className="space-y-3 py-4">
          <div className="bg-[var(--color-border-subtle)] rounded-lg h-32 animate-pulse" />
          <div className="bg-[var(--color-border-subtle)] rounded-lg h-24 animate-pulse" />
          <div className="bg-[var(--color-border-subtle)] rounded-lg h-48 animate-pulse" />
        </div>
      ) : (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-sm">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <StatusBadge status={ticket.status} t={t} />
              <span className="text-xs text-[var(--color-text-secondary)] inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {categoryLabel}
              </span>
              {(() => {
                // Intervention-tickets carry an auto-tag like
                // `concern-attendance`. Surface it as a coloured chip
                // so support and the filer both see what kind of
                // follow-up the instructor asked for at a glance.
                const tags = (ticket as { tags?: { name: string }[] }).tags;
                const concernTag = tags?.find((tg) =>
                  tg.name?.startsWith("concern-"),
                );
                if (!concernTag) return null;
                const slug = concernTag.name.slice("concern-".length);
                let label: string;
                try {
                  label = t(
                    `detail.concerns.${slug}` as Parameters<typeof t>[0],
                  );
                } catch {
                  label = slug;
                }
                return (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-semibold inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {label}
                  </span>
                );
              })()}
              {(ticket as { referenceNumber?: string | null })
                .referenceNumber && (
                <span className="text-xs text-[var(--color-text-secondary)] font-mono">
                  {
                    (ticket as { referenceNumber?: string | null })
                      .referenceNumber
                  }
                </span>
              )}
            </div>
            <h1 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-1">
              {ticket.subject}
            </h1>
            {ticket.courseTitle && (
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-1">
                {isRTL && ticket.courseTitleAr
                  ? ticket.courseTitleAr
                  : ticket.courseTitle}
              </p>
            )}
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("detail.createdOn", { date: formatDate(ticket.createdAt) })}
            </p>
          </div>

          {/* Description + attachments */}
          <div className="p-4 sm:p-6 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
              {t("detail.description")}
            </p>
            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed break-words">
              <LinkifiedText text={ticket.description} />
            </p>
            {(() => {
              type Attachment = {
                id: string;
                url: string;
                filename: string | null;
                scanStatus?:
                  | "clean"
                  | "pending"
                  | "quarantined"
                  | "unknown";
              };
              const multi = (ticket as { attachments?: Attachment[] })
                .attachments;
              const chips: ChipAttachment[] =
                multi && multi.length > 0
                  ? multi.map((a) => ({
                      id: a.id,
                      url: a.url,
                      filename: a.filename ?? t("detail.attachment"),
                      mimeType:
                        (a as { mimeType?: string | null }).mimeType ?? null,
                      sizeBytes:
                        (a as { sizeBytes?: number | null }).sizeBytes ?? null,
                      scanStatus: a.scanStatus,
                    }))
                  : ticket.attachmentUrl
                    ? [
                        {
                          url: ticket.attachmentUrl,
                          filename: t("detail.attachment"),
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
                      onPreview={handlePreviewAttachment}
                    />
                  ))}
                </div>
              );
            })()}
          </div>

          {/* "About this student" card — present on intervention tickets
              filed by the instructor about a third-party student. BE
              gates the payload to the filer + support staff so it
              never leaks across customers. */}
          {(ticket as unknown as { aboutUser?: AboutUserData | null })
            .aboutUser && (
            <div className="p-4 sm:p-6 border-b border-[var(--color-border)] bg-[var(--color-surface-card)]">
              <AboutThisStudentCard
                data={
                  (ticket as unknown as { aboutUser: AboutUserData })
                    .aboutUser
                }
              />
            </div>
          )}

          {/* CSAT review (if already submitted) */}
          {(ticket as {
            csatReview?: {
              score: number | null;
              comment: string | null;
              submittedAt: string | null;
              channel?: string | null;
            } | null;
          }).csatReview && (
            <div className="p-4 sm:p-6 border-b border-[var(--color-border)]">
              <CsatReviewCard
                review={
                  (
                    ticket as {
                      csatReview?: {
                        score: number | null;
                        comment: string | null;
                        submittedAt: string | null;
                        channel?: string | null;
                      } | null;
                    }
                  ).csatReview ?? null
                }
                locale={locale}
              />
            </div>
          )}

          {/* Status banners */}
          {ticket.status === "resolved" && (
            <div className="px-4 sm:px-6 py-3 bg-[#DCFCE7] border-b border-[#86EFAC] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#14532D] leading-relaxed">
                <p className="font-semibold mb-0.5">
                  {t("detail.resolvedBanner.title")}
                </p>
                <p>{t("detail.resolvedBanner.body")}</p>
              </div>
            </div>
          )}
          {ticket.status === "closed" && graceInfo?.inGrace && (
            <div className="px-4 sm:px-6 py-3 bg-[#FFEDD5] border-b border-[#FDBA74] flex items-start gap-2">
              <Clock className="w-4 h-4 text-[#C2410C] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[#7C2D12] leading-relaxed">
                <p className="font-semibold mb-0.5">
                  {t("detail.graceBanner.title", {
                    time: formatHoursLeft(graceInfo.remaining, isAr),
                  })}
                </p>
                <p>{t("detail.graceBanner.body")}</p>
              </div>
            </div>
          )}
          {ticket.status === "closed" && !graceInfo?.inGrace && (
            <div className="px-4 sm:px-6 py-3 bg-[var(--color-border-subtle)] border-b border-[var(--color-border)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                <p className="font-semibold text-[var(--color-text-primary)] mb-0.5">
                  {t("detail.closedBanner.title")}
                </p>
                <p>{t("detail.closedBanner.body")}</p>
              </div>
            </div>
          )}

          {/* Thread */}
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                {t("detail.replies")} ({ticket.replies.length})
              </p>
            </div>

            {ticket.replies.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)] text-center py-8">
                {t("detail.noRepliesYet")}
              </p>
            ) : (
              <div className="space-y-3 mb-4 max-h-[520px] overflow-y-auto pe-1">
                {ticket.replies.map((reply) => (
                  <ReplyBubble
                    key={reply.id}
                    reply={reply}
                    locale={locale}
                    onPreview={handlePreviewAttachment}
                  />
                ))}
                <div ref={threadEndRef} />
              </div>
            )}

            {/* Reply input */}
            {canReply && (
              <div
                className="border-t border-[var(--color-border)] pt-4"
                dir={isRTL ? "rtl" : "ltr"}
              >
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isResolvedOrInGrace
                        ? t("detail.reopenPlaceholder")
                        : t("detail.replyPlaceholder")
                    }
                    rows={2}
                    className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => replyFileInputRef.current?.click()}
                    className="p-2.5 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors flex-shrink-0"
                    aria-label={t("detail.attachFile")}
                  >
                    <Paperclip className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </button>
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      handleReplyAttachmentsAdded(
                        Array.from(e.target.files || []),
                      );
                      if (e.target) e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={
                      sending ||
                      !replyText.trim() ||
                      pendingReplyAttachments.some(
                        (a) => a.status === "queued" || a.status === "uploading",
                      )
                    }
                    className="p-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[#001d5e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label={t("detail.sendReply")}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {pendingReplyAttachments.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {pendingReplyAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 px-2 py-1.5 border border-[var(--color-border)] rounded text-[11px]"
                      >
                        <Paperclip className="w-3 h-3 text-[var(--color-text-secondary)]" />
                        <span className="truncate flex-1" title={att.file.name}>
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
                            ? t("detail.uploading")
                            : att.status === "done"
                              ? t("detail.uploaded")
                              : att.status === "error"
                                ? t("detail.uploadFailed")
                                : "…"}
                        </span>
                        {att.status === "error" && (
                          <button
                            type="button"
                            onClick={() => retryReplyAttachment(att.id)}
                            className="text-[var(--color-primary)] hover:underline font-medium"
                          >
                            {t("detail.retryUpload")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removePendingReply(att.id)}
                          className="text-[var(--color-text-secondary)] hover:text-[#991B1B]"
                          aria-label={t("detail.removeAttachment")}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-[10px] text-[var(--color-text-secondary)]">
                  {isResolvedOrInGrace
                    ? t("detail.reopenHint")
                    : t("detail.replyHint")}
                </p>
              </div>
            )}

            {/* CSAT rating */}
            {showRating && (
              <SatisfactionRating
                currentRating={ticket.satisfactionRating}
                ticketId={ticket.id}
                t={t}
                onRated={refetch}
              />
            )}
          </div>
        </div>
      )}

      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );

  return <>{renderShell(body)}</>;
};

export default UserTicketDetail;
