"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  AlertTriangle,
  MessageSquare,
  Headphones,
  Star,
} from "lucide-react";

interface CsatSurveyState {
  id: string;
  score: number | null;
  submittedAt: string | null;
  sentAt: string;
  expired: boolean;
  alreadySubmitted: boolean;
}

interface GuestTicketTrackerProps {
  token: string;
}

const statusStyles: Record<string, string> = {
  new: "bg-[#DBEAFE] text-[#2563EB]",
  in_progress: "bg-[#FEF9C3] text-[#CA8A04]",
  on_hold: "bg-[#FFEDD5] text-[#EA580C]",
  resolved: "bg-[#DCFCE7] text-[#16A34A]",
  closed: "bg-[#F3F4F6] text-[#6B7280]",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function GuestTicketTracker({ token }: GuestTicketTrackerProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("surveys.guestTracker");

  const [ticket, setTicket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CSAT rating state
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingSelected, setRatingSelected] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const fetchTicket = useCallback(async () => {
    try {
      const data = await supportApi.getGuestTicket(token);
      setTicket(data);
      setError(null);
    } catch {
      setError("not_found");
      setTicket(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(() => {
      // Only poll while the tab is visible — saves API quota when the
      // visitor leaves the tab open in the background.
      if (document.visibilityState === "visible") fetchTicket();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchTicket]);

  const handleReply = async () => {
    if (!replyMessage.trim() || isSending) return;
    setIsSending(true);
    try {
      await supportApi.addGuestReply(token, replyMessage.trim());
      setReplyMessage("");
      toast.success(t("replySent"));
      await fetchTicket();
    } catch {
      toast.error(t("replyError"));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmitRating = async () => {
    const csat: CsatSurveyState | null = ticket?.csatSurvey ?? null;
    if (!csat || ratingSelected < 1 || isSubmittingRating) return;
    setIsSubmittingRating(true);
    try {
      await supportApi.submitCsat(csat.id, {
        score: ratingSelected,
        comment: ratingComment.trim() || undefined,
      });
      toast.success(t("csat.thankYouToast"));
      await fetchTicket();
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || t("csat.errorToast");
      toast.error(typeof message === "string" ? message : t("csat.fallbackError"));
      await fetchTicket();
    } finally {
      setIsSubmittingRating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#a37f49]" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div
        className="max-w-3xl mx-auto px-4 sm:px-6 py-10"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            {t("notFoundTitle")}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("notFoundDescription")}
          </p>
        </div>
      </div>
    );
  }

  const guestInitials = ticket.guestName ? getInitials(ticket.guestName) : "G";

  // Translate ticket status if known; fall back to raw string.
  const knownStatuses = ["new", "in_progress", "on_hold", "resolved", "closed"];
  const statusLabel = knownStatuses.includes(ticket.status)
    ? t(`status.${ticket.status}` as Parameters<typeof t>[0])
    : ticket.status;

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 py-10"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FFF8E6] mb-3">
          <Headphones className="w-6 h-6 text-[#a37f49]" />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          {t("pageTitle")}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {t("ticketIdLabel")} #{ticket.id.substring(0, 8)}
        </p>
      </div>

      {/* Ticket Info Card */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6 mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2
            className="text-base font-semibold text-[var(--color-text-primary)]"
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            {ticket.subject}
          </h2>
          <span
            className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[ticket.status] || statusStyles.new}`}
          >
            {statusLabel}
          </span>
        </div>
        <p
          className="text-sm text-[var(--color-text-secondary)] mt-2"
          style={{ textAlign: isRTL ? "right" : "left" }}
        >
          {ticket.description}
        </p>
        <div className="flex gap-4 mt-3 text-xs text-[var(--color-text-secondary)]">
          <span>{t("categoryLabel")} {ticket.category}</span>
          <span>{t("submittedLabel")} {formatDate(ticket.createdAt)}</span>
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-3 mb-4">
        {/* Initial message from guest */}
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#8B5CF6] text-white text-xs font-bold flex items-center justify-center">
              {guestInitials}
            </div>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {ticket.guestName}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {formatDate(ticket.createdAt)}
            </span>
          </div>
          <p
            className="text-sm text-[var(--color-text-primary)]"
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            {ticket.description}
          </p>
        </div>

        {/* Comments */}
        {ticket.comments?.map(
          (comment: {
            id: string;
            isStaffReply: boolean;
            userFirstName?: string;
            userLastName?: string;
            message: string;
            createdAt: string;
          }) => {
            const isStaff = comment.isStaffReply;
            const staffName = [comment.userFirstName, comment.userLastName]
              .filter(Boolean)
              .join(" ");
            const avatarInitials = isStaff
              ? getInitials(staffName || t("supportAgentFallback"))
              : guestInitials;

            return (
              <div
                key={comment.id}
                className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-full ${isStaff ? "bg-[#a37f49]" : "bg-[#8B5CF6]"} text-white text-xs font-bold flex items-center justify-center`}
                  >
                    {avatarInitials}
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {isStaff
                      ? staffName || t("supportAgentFallback")
                      : ticket.guestName}
                  </span>
                  {isStaff && (
                    <span className="text-xs bg-[#FFF8E6] text-[#6b4e24] px-1.5 py-0.5 rounded font-medium">
                      {t("supportBadge")}
                    </span>
                  )}
                  <span
                    className={`text-xs text-[var(--color-text-secondary)] ${isRTL ? "mr-auto" : "ml-auto"}`}
                  >
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p
                  className="text-sm text-[var(--color-text-primary)]"
                  style={{ textAlign: isRTL ? "right" : "left" }}
                >
                  {comment.message}
                </p>
              </div>
            );
          },
        )}
      </div>

      {/* Reply Box (only if ticket not closed) */}
      {ticket.status !== "closed" && (
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("replyHeader")}
            </span>
          </div>
          <textarea
            rows={3}
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder={t("replyPlaceholder")}
            className="w-full px-3.5 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--color-input-focus)]"
            style={{ textAlign: isRTL ? "right" : "left" }}
          />
          <div
            className={`flex ${isRTL ? "justify-start" : "justify-end"} mt-3`}
          >
            <button
              onClick={handleReply}
              disabled={!replyMessage.trim() || isSending}
              className="flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSending ? t("sendingReply") : t("sendReply")}
            </button>
          </div>
        </div>
      )}

      {/* CSAT Rating Widget — shown for resolved/closed tickets */}
      {(ticket.status === "resolved" || ticket.status === "closed") &&
        ticket.csatSurvey && (
          <div className="mt-4 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
            {(() => {
              const csat = ticket.csatSurvey as CsatSurveyState;

              // State 1: Already rated — show thank-you + score read-only
              if (csat.alreadySubmitted) {
                return (
                  <div className="text-center py-2">
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#FFF8E6] mb-2">
                      <Star className="w-5 h-5 text-[#a37f49] fill-[#a37f49]" />
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                      {t("csat.thankYouTitle")}
                    </h3>
                    {csat.score != null && (
                      <div className="flex items-center justify-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-5 h-5 ${
                              n <= (csat.score ?? 0)
                                ? "text-[#a37f49] fill-[#a37f49]"
                                : "text-[var(--color-text-secondary)] opacity-40"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // State 2: Rating window expired
              if (csat.expired) {
                return (
                  <div className="text-center py-2">
                    <AlertTriangle className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("csat.expiredMessage")}
                    </p>
                  </div>
                );
              }

              // State 3: Show interactive star widget
              return (
                <div>
                  <h3
                    className="text-sm font-semibold text-[var(--color-text-primary)] mb-1"
                    style={{ textAlign: isRTL ? "right" : "left" }}
                  >
                    {t("csat.prompt")}
                  </h3>
                  <p
                    className="text-xs text-[var(--color-text-secondary)] mb-3"
                    style={{ textAlign: isRTL ? "right" : "left" }}
                  >
                    {t("csat.subprompt")}
                  </p>
                  <div
                    className={`flex items-center gap-1 mb-3 ${isRTL ? "justify-end" : "justify-start"}`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => {
                      const filled = n <= (ratingHover || ratingSelected);
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={isSubmittingRating}
                          onClick={() => setRatingSelected(n)}
                          onMouseEnter={() => setRatingHover(n)}
                          onMouseLeave={() => setRatingHover(0)}
                          className="p-1 disabled:cursor-default"
                          aria-label={t("csat.starAriaLabel", {
                            n,
                            plural: n > 1 ? "s" : "",
                          })}
                        >
                          <Star
                            className={`w-7 h-7 transition-colors ${
                              filled
                                ? "text-[#a37f49] fill-[#a37f49]"
                                : "text-[var(--color-text-secondary)] opacity-40"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    rows={2}
                    value={ratingComment}
                    onChange={(e) =>
                      setRatingComment(e.target.value.slice(0, 1000))
                    }
                    placeholder={t("csat.commentPlaceholder")}
                    disabled={isSubmittingRating}
                    className="w-full px-3.5 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--color-input-focus)] disabled:bg-[var(--color-surface-page)]"
                    style={{ textAlign: isRTL ? "right" : "left" }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-[var(--color-text-secondary)]">
                      {ratingComment.length}/1000
                    </span>
                  </div>
                  <div
                    className={`flex ${isRTL ? "justify-start" : "justify-end"} mt-3`}
                  >
                    <button
                      type="button"
                      onClick={handleSubmitRating}
                      disabled={ratingSelected < 1 || isSubmittingRating}
                      className="flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingRating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {t("csat.submit")}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
    </div>
  );
}
