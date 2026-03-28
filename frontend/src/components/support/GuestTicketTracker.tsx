"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Headphones,
  Copy,
} from "lucide-react";

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

const statusLabels: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  on_hold: "On Hold",
  resolved: "Resolved",
  closed: "Closed",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function GuestTicketTracker({ token }: GuestTicketTrackerProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [ticket, setTicket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    try {
      const data = await supportApi.getGuestTicket(token);
      setTicket(data);
      setError(null);
    } catch {
      setError("Ticket not found");
      setTicket(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTicket();
    const interval = setInterval(fetchTicket, 60000);
    return () => clearInterval(interval);
  }, [fetchTicket]);

  const handleReply = async () => {
    if (!replyMessage.trim() || isSending) return;
    setIsSending(true);
    try {
      await supportApi.addGuestReply(token, replyMessage.trim());
      setReplyMessage("");
      toast.success("Reply sent successfully");
      await fetchTicket();
    } catch {
      toast.error("Failed to send reply. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#002D87]" />
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
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            Ticket Not Found
          </h2>
          <p className="text-sm text-gray-500">
            The tracking link may be invalid or expired.
          </p>
        </div>
      </div>
    );
  }

  const guestInitials = ticket.guestName ? getInitials(ticket.guestName) : "G";

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 py-10"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#EFF6FF] mb-3">
          <Headphones className="w-6 h-6 text-[#002D87]" />
        </div>
        <h1
          className="text-xl font-bold text-gray-900"
          style={{ textAlign: isRTL ? "right" : "left" }}
        >
          Track Your Support Ticket
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ticket #{ticket.id.substring(0, 8)}
        </p>
      </div>

      {/* Ticket Info Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 mb-4">
        <div className="flex items-start justify-between gap-3">
          <h2
            className="text-base font-semibold text-gray-900"
            style={{ textAlign: isRTL ? "right" : "left" }}
          >
            {ticket.subject}
          </h2>
          <span
            className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[ticket.status] || statusStyles.new}`}
          >
            {statusLabels[ticket.status] || ticket.status}
          </span>
        </div>
        <p
          className="text-sm text-gray-500 mt-2"
          style={{ textAlign: isRTL ? "right" : "left" }}
        >
          {ticket.description}
        </p>
        <div className="flex gap-4 mt-3 text-xs text-gray-400">
          <span>Category: {ticket.category}</span>
          <span>Submitted: {formatDate(ticket.createdAt)}</span>
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-3 mb-4">
        {/* Initial message from guest */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#8B5CF6] text-white text-xs font-bold flex items-center justify-center">
              {guestInitials}
            </div>
            <span className="text-sm font-medium text-gray-800">
              {ticket.guestName}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(ticket.createdAt)}
            </span>
          </div>
          <p
            className="text-sm text-gray-700"
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
              ? getInitials(staffName || "Support")
              : guestInitials;

            return (
              <div
                key={comment.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-full ${isStaff ? "bg-[#002D87]" : "bg-[#8B5CF6]"} text-white text-xs font-bold flex items-center justify-center`}
                  >
                    {avatarInitials}
                  </div>
                  <span className="text-sm font-medium text-gray-800">
                    {isStaff ? staffName || "Support Agent" : ticket.guestName}
                  </span>
                  {isStaff && (
                    <span className="text-xs bg-[#EFF6FF] text-[#002D87] px-1.5 py-0.5 rounded font-medium">
                      Support
                    </span>
                  )}
                  <span
                    className={`text-xs text-gray-400 ${isRTL ? "mr-auto" : "ml-auto"}`}
                  >
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p
                  className="text-sm text-gray-700"
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
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Reply</span>
          </div>
          <textarea
            rows={3}
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Type your reply..."
            className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-sm resize-none focus:outline-none focus:border-[#002D87]"
            style={{ textAlign: isRTL ? "right" : "left" }}
          />
          <div
            className={`flex ${isRTL ? "justify-start" : "justify-end"} mt-3`}
          >
            <button
              onClick={handleReply}
              disabled={!replyMessage.trim() || isSending}
              className="flex items-center gap-2 px-4 py-2 bg-[#002D87] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
