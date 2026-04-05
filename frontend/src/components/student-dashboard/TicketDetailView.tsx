"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Star,
  Tag,
  User,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useTicketDetail } from "@/hooks/useStudentTickets";
import { studentApi, supportApi } from "@/lib/api";
import type { TicketReply, TicketStatus } from "@/types/student-dashboard";

function StatusBadge({
  status,
  t,
}: {
  status: TicketStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  const styles: Record<string, string> = {
    new: "bg-blue-50 text-blue-700",
    in_progress: "bg-yellow-50 text-yellow-700",
    resolved: "bg-green-50 text-green-700",
    closed: "bg-gray-100 text-gray-500",
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
            ? "bg-[#F3F4F6] rounded-tl-sm"
            : "bg-[#a37f49] text-white rounded-tr-sm"
        } rounded-2xl p-3 sm:p-4`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <User className={`w-3 h-3 ${isStaff ? "text-[#6B7280]" : "text-[#FFF1CF]"}`} />
          <span
            className={`text-[10px] sm:text-xs font-medium ${
              isStaff ? "text-[#6B7280]" : "text-[#FFF1CF]"
            }`}
          >
            {reply.userName}
          </span>
        </div>
        <p
          className={`text-xs sm:text-sm whitespace-pre-wrap ${
            isStaff ? "text-[#374151]" : "text-white"
          }`}
        >
          {reply.message}
        </p>
        <p
          className={`text-[10px] mt-1.5 ${
            isStaff ? "text-[#9CA3AF]" : "text-blue-200"
          }`}
        >
          {new Date(reply.createdAt).toLocaleString(
            isRTL ? "ar-SA" : "en-US",
            {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          )}
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
      // Revert on error
      setRating(currentRating ?? 0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
      <p className="text-sm font-medium text-[#374151] mb-2">
        {t("supportPage.rateExperience")}
      </p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={submitting || submitted}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !submitted && setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-0.5 disabled:cursor-default"
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (hoveredStar || rating)
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
        {submitted && (
          <span className="ml-2 text-xs text-green-600 font-medium">
            {t("supportPage.thankYou")}
          </span>
        )}
      </div>
    </div>
  );
}

interface TicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

const TicketDetailView = ({ ticketId, onBack }: TicketDetailViewProps) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();

  const { data: ticket, loading, refetch } = useTicketDetail(ticketId);

  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const canReply = ticket && ticket.status !== "closed";
  const showRating =
    ticket &&
    (ticket.status === "resolved" || ticket.status === "closed");

  const handleSendReply = async () => {
    if (!replyText.trim() || !ticketId) return;
    setSending(true);
    try {
      await supportApi.addComment(ticketId, { message: replyText.trim() });
      setReplyText("");
      refetch();
    } catch {
      // Silently fail for now
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(
      isRTL ? "ar-SA" : "en-US",
      { year: "numeric", month: "long", day: "numeric" },
    );
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              {/* Back button + title */}
              <button
                onClick={onBack}
                className={`flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
              >
                <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                {t("supportPage.backToTickets")}
              </button>

              {loading || !ticket ? (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  {/* Ticket header */}
                  <div className="p-4 sm:p-6 border-b border-[#E5E7EB]">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <StatusBadge status={ticket.status} t={t} />
                      <span className="text-xs text-[#9CA3AF]">
                        <Tag className="w-3 h-3 inline mr-1" />
                        {t(`supportPage.category_${ticket.category}` as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <h1 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-1">
                      {ticket.subject}
                    </h1>
                    {ticket.courseTitle && (
                      <p className="text-xs sm:text-sm text-[#6B7280] mb-1">
                        {isRTL && ticket.courseTitleAr
                          ? ticket.courseTitleAr
                          : ticket.courseTitle}
                      </p>
                    )}
                    <p className="text-xs text-[#9CA3AF]">
                      {t("supportPage.createdOn", {
                        date: formatDate(ticket.createdAt),
                      })}
                    </p>
                  </div>

                  {/* Description */}
                  <div className="p-4 sm:p-6 border-b border-[#E5E7EB] bg-[#FAFBFC]">
                    <p className="text-xs font-medium text-[#6B7280] mb-2">
                      {t("supportPage.description")}
                    </p>
                    <p className="text-sm text-[#374151] whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                  </div>

                  {/* Replies */}
                  <div className="p-4 sm:p-6">
                    <p className="text-xs font-medium text-[#6B7280] mb-3">
                      {t("supportPage.replies")} ({ticket.replies.length})
                    </p>

                    {ticket.replies.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF] text-center py-6">
                        {t("supportPage.noRepliesYet")}
                      </p>
                    ) : (
                      <div className="space-y-3 mb-4">
                        {ticket.replies.map((reply) => (
                          <ReplyBubble
                            key={reply.id}
                            reply={reply}
                            locale={locale}
                          />
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    {canReply && (
                      <div
                        className="flex items-end gap-2 mt-4"
                        dir={isRTL ? "rtl" : "ltr"}
                      >
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={t("supportPage.replyPlaceholder")}
                          rows={2}
                          className="flex-1 px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#a37f49] focus:border-transparent resize-none"
                        />
                        <button
                          onClick={handleSendReply}
                          disabled={sending || !replyText.trim()}
                          className="p-2.5 btn-gold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
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
