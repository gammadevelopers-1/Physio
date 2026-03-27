"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import {
  ArrowLeft,
  Send,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  MessageSquare,
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

  const isSupportOrAdmin =
    user?.roles?.includes("SUPPORT") ||
    user?.roles?.includes("ADMIN") ||
    user?.roles?.includes("SUPER_ADMIN");
  const isSupervisor = user?.supportSubRole === "supervisor";

  const profile = {
    name: user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
      : "",
    email: user?.email || "",
    resolved: 0,
    csat: 0,
    avgFRT: "--",
  };

  useEffect(() => {
    if (!ticketId) return;
    async function fetchTicket() {
      setIsLoading(true);
      try {
        const data = await supportApi.getTicket(ticketId);
        setTicket(data);
      } catch {
        toast.error("Failed to load ticket");
      } finally {
        setIsLoading(false);
      }
    }
    fetchTicket();
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
      toast.success(isInternal ? "Internal note added" : "Reply sent");
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!ticketId) return;
    setIsUpdating(true);
    try {
      if (newStatus === "resolved") {
        await supportApi.resolveTicket(ticketId);
      } else if (newStatus === "closed") {
        await supportApi.closeTicket(ticketId);
      } else {
        await supportApi.updateTicket(ticketId, { status: newStatus });
      }
      const data = await supportApi.getTicket(ticketId);
      setTicket(data);
      toast.success(`Status changed to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
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
    closed: "bg-[#F3F4F6] text-[#6B7280]",
  };

  return (
    <>
      <SupportNavbar profile={profile} />
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar
                profile={profile}
                supportSubRole={user?.supportSubRole}
              />
            </div>
            <SupportMobileSidebar profile={profile} supportSubRole={user?.supportSubRole} />

            <div className="flex-1 min-w-0">
              {/* Back Button */}
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Tickets
              </button>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[#002D87]" />
                </div>
              ) : !ticket ? (
                <div className="text-center py-20 text-[#6B7280]">
                  Ticket not found
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Content — Thread */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Ticket Header */}
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h1 className="text-lg font-semibold text-[#1F2937] mb-1">
                            {ticket.subject}
                          </h1>
                          <p className="text-sm text-[#6B7280]">
                            #{ticket.id.substring(0, 8)} &middot;{" "}
                            {[
                              ticket.studentFirstName,
                              ticket.studentLastName,
                            ]
                              .filter(Boolean)
                              .join(" ")}{" "}
                            &middot; {ticket.studentEmail}
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
                      <p className="text-sm text-[#374151] leading-relaxed">
                        {ticket.description}
                      </p>
                      <div className="mt-3 text-xs text-[#9CA3AF]">
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
                                : "border-[#E5E7EB]"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                  comment.isStaffReply
                                    ? "bg-[#002D87]"
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
                                <span className="text-sm font-medium text-[#1F2937]">
                                  {authorName || "Unknown"}
                                </span>
                                {comment.isStaffReply && (
                                  <span className="ml-1.5 text-xs text-[#002D87] bg-[#EFF6FF] px-1.5 py-0.5 rounded">
                                    Staff
                                  </span>
                                )}
                                {comment.isInternal && (
                                  <span className="ml-1.5 text-xs text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.5 rounded flex items-center gap-1 inline-flex">
                                    <Lock className="w-3 h-3" />
                                    Internal
                                  </span>
                                )}
                              </div>
                              <span className="ml-auto text-xs text-[#9CA3AF]">
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-[#374151] leading-relaxed">
                              {comment.message}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Reply Composer */}
                    {ticket.status !== "closed" && (
                      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <MessageSquare className="w-4 h-4 text-[#6B7280]" />
                          <span className="text-sm font-medium text-[#1F2937]">
                            Reply
                          </span>
                          {isSupportOrAdmin && (
                            <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isInternal}
                                onChange={(e) =>
                                  setIsInternal(e.target.checked)
                                }
                                className="w-4 h-4 rounded border-[#D1D5DB]"
                              />
                              <Lock className="w-3.5 h-3.5 text-[#D97706]" />
                              <span className="text-xs text-[#6B7280]">
                                Internal Note
                              </span>
                            </label>
                          )}
                        </div>
                        <textarea
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder={
                            isInternal
                              ? "Add an internal note (not visible to student)..."
                              : "Type your reply..."
                          }
                          rows={3}
                          className={`w-full px-3.5 py-2.5 border rounded-lg text-sm resize-none outline-none transition-colors ${
                            isInternal
                              ? "border-[#FDE68A] bg-[#FFFBEB] focus:border-[#D97706]"
                              : "border-[#E5E7EB] focus:border-[#002D87]"
                          }`}
                          dir={isRTL ? "rtl" : "ltr"}
                        />
                        <div className="flex justify-end mt-3">
                          <button
                            onClick={handleSendReply}
                            disabled={!replyMessage.trim() || isSending}
                            className="flex items-center gap-2 px-4 py-2 bg-[#002D87] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {isInternal ? "Add Note" : "Send Reply"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Panel — Details & Actions */}
                  <div className="space-y-4">
                    {/* Ticket Info */}
                    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                      <h3 className="text-sm font-semibold text-[#1F2937] mb-4">
                        Details
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[#6B7280]">Category</span>
                          <span className="font-medium text-[#1F2937] capitalize">
                            {ticket.category}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6B7280]">Assignee</span>
                          <span className="font-medium text-[#1F2937]">
                            {ticket.assigneeName || "Unassigned"}
                          </span>
                        </div>
                        {ticket.courseName && (
                          <div className="flex justify-between">
                            <span className="text-[#6B7280]">Course</span>
                            <span className="font-medium text-[#1F2937] text-right max-w-[150px] truncate">
                              {ticket.courseName}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[#6B7280]">Created</span>
                          <span className="text-[#1F2937]">
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {ticket.resolvedAt && (
                          <div className="flex justify-between">
                            <span className="text-[#6B7280]">Resolved</span>
                            <span className="text-[#1F2937]">
                              {new Date(
                                ticket.resolvedAt,
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SLA Panel */}
                    {ticket.slaPolicy && (
                      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                        <h3 className="text-sm font-semibold text-[#1F2937] mb-4">
                          SLA
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-[#6B7280]">
                              FRT Target
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">
                                {ticket.slaPolicy.frtMinutes}m
                              </span>
                              {ticket.slaBreachedFrt ? (
                                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                              ) : ticket.firstResponseAt ? (
                                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                              ) : (
                                <Clock className="w-4 h-4 text-[#F59E0B]" />
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#6B7280]">
                              TTR Target
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium">
                                {ticket.slaPolicy.ttrMinutes > 60
                                  ? `${(ticket.slaPolicy.ttrMinutes / 60).toFixed(0)}h`
                                  : `${ticket.slaPolicy.ttrMinutes}m`}
                              </span>
                              {ticket.slaBreachedTtr ? (
                                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                              ) : ticket.resolvedAt ? (
                                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                              ) : (
                                <Clock className="w-4 h-4 text-[#F59E0B]" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {isSupportOrAdmin &&
                      ticket.status !== "closed" && (
                        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                          <h3 className="text-sm font-semibold text-[#1F2937] mb-4">
                            Actions
                          </h3>
                          <div className="space-y-2">
                            {ticket.status !== "resolved" && (
                              <button
                                onClick={() => handleStatusChange("resolved")}
                                disabled={isUpdating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#22C55E] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Resolve Ticket
                              </button>
                            )}
                            {ticket.status === "resolved" && (
                              <button
                                onClick={() => handleStatusChange("closed")}
                                disabled={isUpdating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#6B7280] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                              >
                                <XCircle className="w-4 h-4" />
                                Close Ticket
                              </button>
                            )}
                            {ticket.status !== "on_hold" &&
                              ticket.status !== "resolved" && (
                                <button
                                  onClick={() =>
                                    handleStatusChange("on_hold")
                                  }
                                  disabled={isUpdating}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[#E5E7EB] text-[#4B5563] text-sm font-medium rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50"
                                >
                                  <Clock className="w-4 h-4" />
                                  Put On Hold
                                </button>
                              )}
                            {ticket.status === "on_hold" && (
                              <button
                                onClick={() =>
                                  handleStatusChange("in_progress")
                                }
                                disabled={isUpdating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[#E5E7EB] text-[#4B5563] text-sm font-medium rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50"
                              >
                                Resume Ticket
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
