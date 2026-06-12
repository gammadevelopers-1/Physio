"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
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
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import TicketDetailSkeleton from "./TicketDetailSkeleton";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useTicketDetail } from "@/hooks/useStudentTickets";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDateReadable } from "@/lib/platform-locale";
import { FmtDate } from "@/components/ui/Fmt";
import { studentApi, supportApi, uploadFormData } from "@/lib/api";
import type { TicketReply, TicketStatus } from "@/types/student-dashboard";
import AttachmentChip, {
  type Attachment as ChipAttachment,
} from "@/components/support-dashboard/AttachmentChip";
import LinkifiedText from "@/components/support/LinkifiedText";
import CsatReviewCard from "@/components/support-dashboard/CsatReviewCard";
import AttachmentPreviewModal, {
  type PreviewableAttachment,
} from "@/components/support-dashboard/AttachmentPreviewModal";

const REOPEN_GRACE_MS = 48 * 60 * 60 * 1000;

function StatusBadge({
  status,
  t,
}: {
  status: TicketStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  // Themed semantic palette — keeps the chip readable without leaking
  // brand colors into status meaning.
  const styles: Record<string, string> = {
    new: "bg-[#DBEAFE] text-[#1D4ED8]",
    in_progress: "bg-[#FEF9C3] text-[#A16207]",
    on_hold: "bg-[#FEF3C7] text-[#B45309]",
    resolved: "bg-[#DCFCE7] text-[#15803D]",
    closed: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };

  const icons: Record<string, React.ReactNode> = {
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
      {t(`supportPage.status_${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

function ReplyBubble({
  reply,
  locale,
  t,
  onPreview,
}: {
  reply: TicketReply;
  locale: string;
  t: ReturnType<typeof useTranslations>;
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
      await studentApi.rateTicket(ticketId, value);
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
          {t("supportPage.rateExperience")}
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
            {t("supportPage.thankYou")}
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

interface TicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

const TicketDetailView = ({ ticketId, onBack }: TicketDetailViewProps) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const isAr = locale === "ar";
  const userData = useStudentProfile();

  const { data: ticket, loading, refetch } = useTicketDetail(ticketId);
  const platformLocale = usePlatformLocale();

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // In-app preview modal — opened from any attachment chip in the
  // ticket header or chat thread. Student tickets aren't subject to
  // staff-side download audit, so no audit hook is called here.
  const [previewAttachment, setPreviewAttachment] =
    useState<PreviewableAttachment | null>(null);
  const handlePreviewStudent = (att: ChipAttachment) =>
    setPreviewAttachment(att);
  type PendingReplyAttachment = {
    id: string;
    file: File;
    status: "queued" | "uploading" | "done" | "error";
    url?: string;
  };
  const [pendingReplyAttachments, setPendingReplyAttachments] = useState<
    PendingReplyAttachment[]
  >([]);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const REPLY_MAX_FILES = 10;
  const REPLY_MAX_BYTES = 5 * 1024 * 1024;
  const REPLY_ALLOWED_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

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

  // Live tick so the 48h grace countdown updates every minute without
  // hammering the API.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Reopen-in-grace logic: a CLOSED ticket within 48h of being closed
  // can still receive a reply, which auto-reopens it server-side.
  const graceInfo = useMemo(() => {
    if (!ticket) return null;
    if (ticket.status !== "closed" || !ticket.closedAt) return null;
    const closedAt = new Date(ticket.closedAt).getTime();
    const remaining = closedAt + REOPEN_GRACE_MS - Date.now();
    return {
      remaining,
      inGrace: remaining > 0,
    };
  }, [ticket]);

  const canReply =
    ticket &&
    (ticket.status !== "closed" || (graceInfo?.inGrace ?? false));

  const isResolvedOrInGrace =
    ticket &&
    (ticket.status === "resolved" ||
      ticket.status === "closed");

  const showRating =
    ticket &&
    (ticket.status === "resolved" || ticket.status === "closed");

  // Auto-scroll the thread to the latest message when replies change.
  const threadEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ticket || ticket.replies.length === 0) return;
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ticket?.replies.length, ticket]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticketId) return;
    // Block while any upload is still pending so we don't ship a reply
    // with half-attached files.
    if (
      pendingReplyAttachments.some(
        (a) => a.status === "queued" || a.status === "uploading",
      )
    )
      return;
    setSending(true);
    try {
      const attachmentUrls = pendingReplyAttachments
        .filter((a) => a.status === "done" && a.url)
        .map((a) => a.url!) as string[];
      await supportApi.addComment(ticketId, {
        message: replyText.trim(),
        attachmentUrls:
          attachmentUrls.length > 0 ? attachmentUrls : undefined,
      });
      setReplyText("");
      setPendingReplyAttachments([]);
      refetch();
    } catch {
      // Silent — server returns 400 with reason; future: surface toast.
    } finally {
      setSending(false);
    }
  };

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
    formatPlatformDateReadable(dateStr, platformLocale, locale === "ar" ? "ar" : "en");

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              {/* Back button + Refresh */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={onBack}
                  className={`flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                  {t("supportPage.backToTickets")}
                </button>
                {ticket && !loading && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                    aria-label={t("supportPage.refresh")}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{t("supportPage.refresh")}</span>
                  </button>
                )}
              </div>

              {loading || !ticket ? (
                <TicketDetailSkeleton />
              ) : (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-sm">
                  {/* Ticket header */}
                  <div className="p-4 sm:p-6 border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <StatusBadge status={ticket.status} t={t} />
                      <span className="text-xs text-[var(--color-text-secondary)] inline-flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {t(`supportPage.category_${ticket.category}` as Parameters<typeof t>[0])}
                      </span>
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
                      {t("supportPage.createdOn", {
                        date: formatDate(ticket.createdAt),
                      })}
                    </p>
                  </div>

                  {/* Description + Attachment */}
                  <div className="p-4 sm:p-6 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                      {t("supportPage.description")}
                    </p>
                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed break-words">
                      <LinkifiedText text={ticket.description} />
                    </p>
                    {/* Attachments — prefer the multi-attachment list when
                        the API surfaces it (post-0054); otherwise fall back
                        to the legacy single-URL field so older tickets
                        still render their chip. */}
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
                              filename:
                                a.filename ?? t("supportPage.attachment"),
                              mimeType:
                                (a as { mimeType?: string | null }).mimeType ??
                                null,
                              sizeBytes:
                                (a as { sizeBytes?: number | null })
                                  .sizeBytes ?? null,
                              scanStatus: a.scanStatus,
                            }))
                          : ticket.attachmentUrl
                            ? [
                                {
                                  url: ticket.attachmentUrl,
                                  filename: t("supportPage.attachment"),
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
                              onPreview={handlePreviewStudent}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* CSAT review — surface the student's own rating
                      inline once they've submitted so they (and any
                      staff member viewing the ticket) see it without
                      navigating away. */}
                  {(ticket as { csatReview?: { score: number | null; comment: string | null; submittedAt: string | null; channel?: string | null } | null }).csatReview && (
                    <div className="p-4 sm:p-6 border-b border-[var(--color-border)]">
                      <CsatReviewCard
                        review={(ticket as { csatReview?: { score: number | null; comment: string | null; submittedAt: string | null; channel?: string | null } | null }).csatReview ?? null}
                        locale={locale}
                      />
                    </div>
                  )}

                  {/* Status banners — resolved encouragement / grace countdown / past-grace */}
                  {ticket.status === "resolved" && (
                    <div className="px-4 sm:px-6 py-3 bg-[#DCFCE7] border-b border-[#86EFAC] flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#15803D] flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-[#14532D] leading-relaxed">
                        <p className="font-semibold mb-0.5">
                          {t("supportPage.resolvedBanner.title")}
                        </p>
                        <p>{t("supportPage.resolvedBanner.body")}</p>
                      </div>
                    </div>
                  )}
                  {ticket.status === "closed" && graceInfo?.inGrace && (
                    <div className="px-4 sm:px-6 py-3 bg-[#FFEDD5] border-b border-[#FDBA74] flex items-start gap-2">
                      <Clock className="w-4 h-4 text-[#C2410C] flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-[#7C2D12] leading-relaxed">
                        <p className="font-semibold mb-0.5">
                          {t("supportPage.graceBanner.title", {
                            time: formatHoursLeft(graceInfo.remaining, isAr),
                          })}
                        </p>
                        <p>{t("supportPage.graceBanner.body")}</p>
                      </div>
                    </div>
                  )}
                  {ticket.status === "closed" && !graceInfo?.inGrace && (
                    <div className="px-4 sm:px-6 py-3 bg-[var(--color-border-subtle)] border-b border-[var(--color-border)] flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        <p className="font-semibold text-[var(--color-text-primary)] mb-0.5">
                          {t("supportPage.closedBanner.title")}
                        </p>
                        <p>{t("supportPage.closedBanner.body")}</p>
                      </div>
                    </div>
                  )}

                  {/* Thread */}
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                        {t("supportPage.replies")} ({ticket.replies.length})
                      </p>
                    </div>

                    {ticket.replies.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-secondary)] text-center py-8">
                        {t("supportPage.noRepliesYet")}
                      </p>
                    ) : (
                      <div className="space-y-3 mb-4 max-h-[520px] overflow-y-auto pe-1">
                        {ticket.replies.map((reply) => (
                          <ReplyBubble
                            key={reply.id}
                            reply={reply}
                            locale={locale}
                            t={t}
                            onPreview={handlePreviewStudent}
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
                                ? t("supportPage.reopenPlaceholder")
                                : t("supportPage.replyPlaceholder")
                            }
                            rows={2}
                            className="flex-1 px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => replyFileInputRef.current?.click()}
                            className="p-2.5 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors flex-shrink-0"
                            aria-label={t("supportPage.attachFile")}
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
                            disabled={sending || !replyText.trim() || pendingReplyAttachments.some((a) => a.status === "queued" || a.status === "uploading")}
                            className="p-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[#001d5e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            aria-label={t("supportPage.sendReply")}
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
                                    ? t("supportPage.uploading")
                                    : att.status === "done"
                                      ? t("supportPage.uploaded")
                                      : att.status === "error"
                                        ? t("supportPage.uploadFailed")
                                        : "…"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removePendingReply(att.id)}
                                  className="text-[var(--color-text-secondary)] hover:text-[#991B1B]"
                                  aria-label={t("supportPage.removeAttachment")}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="mt-1.5 text-[10px] text-[var(--color-text-secondary)]">
                          {isResolvedOrInGrace
                            ? t("supportPage.reopenHint")
                            : t("supportPage.replyHint")}
                        </p>
                      </div>
                    )}

                    {/* Satisfaction rating */}
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
            </div>
          </div>
        </div>
      </div>

      {/* In-app PDF / image preview modal for the student. No
          download-audit hook fires on the student side — they're
          viewing their own files. */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
};

export default TicketDetailView;
