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
import { studentApi, supportApi } from "@/lib/api";
import type { TicketReply, TicketStatus } from "@/types/student-dashboard";

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
    resolved: "bg-[#DCFCE7] text-[#15803D]",
    closed: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };

  const icons: Record<string, React.ReactNode> = {
    new: <AlertCircle className="w-3.5 h-3.5" />,
    in_progress: <Clock className="w-3.5 h-3.5" />,
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
}: {
  reply: TicketReply;
  locale: string;
}) {
  const isRTL = locale === "ar";
  const isStaff = reply.isStaffReply;

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
          className={`text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${
            isStaff ? "text-[var(--color-text-primary)]" : "text-white"
          }`}
        >
          {reply.message}
        </p>
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
    setSending(true);
    try {
      await supportApi.addComment(ticketId, { message: replyText.trim() });
      setReplyText("");
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
                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                      {ticket.description}
                    </p>
                    {/* Attachments — prefer the multi-attachment list when
                        the API surfaces it (post-0054); otherwise fall back
                        to the legacy single-URL field so older tickets
                        still render their chip. */}
                    {(() => {
                      const multi =
                        (ticket as any).attachments as
                          | { id: string; url: string; filename: string | null }[]
                          | undefined;
                      const chips =
                        multi && multi.length > 0
                          ? multi.map((a) => ({
                              key: a.id,
                              url: a.url,
                              label: a.filename || t("supportPage.attachment"),
                            }))
                          : ticket.attachmentUrl
                            ? [
                                {
                                  key: "legacy",
                                  url: ticket.attachmentUrl,
                                  label: t("supportPage.attachment"),
                                },
                              ]
                            : [];
                      if (chips.length === 0) return null;
                      return (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {chips.map((c) => (
                            <a
                              key={c.key}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[200px]">{c.label}</span>
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

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
                            onClick={handleSendReply}
                            disabled={sending || !replyText.trim()}
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
    </>
  );
};

export default TicketDetailView;
