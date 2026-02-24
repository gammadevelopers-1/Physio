"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  HelpCircle,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Send,
  Tag,
  X,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentTickets } from "@/hooks/useStudentTickets";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import { studentApi } from "@/lib/api";
import type {
  SupportTicket,
  TicketStatus,
  TicketCategory,
  TicketPriority,
} from "@/types/student-dashboard";
import TicketDetailView from "./TicketDetailView";
import EmptyStateIllustration from "./EmptyStateIllustration";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "supportPage.filterAll" },
  { key: "new", label: "supportPage.filterNew" },
  { key: "in_progress", label: "supportPage.filterInProgress" },
  { key: "resolved", label: "supportPage.filterResolved" },
  { key: "closed", label: "supportPage.filterClosed" },
];

const CATEGORIES: TicketCategory[] = [
  "billing",
  "login",
  "content",
  "certificate",
  "technical",
  "other",
];

const PRIORITIES: TicketPriority[] = ["high", "medium", "low"];

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
    new: <AlertCircle className="w-3 h-3" />,
    in_progress: <Clock className="w-3 h-3" />,
    resolved: <CheckCircle2 className="w-3 h-3" />,
    closed: <CheckCircle2 className="w-3 h-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] ?? ""}`}
    >
      {icons[status]}
      {t(`supportPage.status_${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

function PriorityBadge({
  priority,
  t,
}: {
  priority: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const styles: Record<string, string> = {
    high: "bg-red-50 text-red-700",
    medium: "bg-orange-50 text-orange-700",
    low: "bg-gray-50 text-gray-600",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${styles[priority] ?? ""}`}
    >
      {t(`supportPage.priority_${priority}` as Parameters<typeof t>[0])}
    </span>
  );
}

function getSlaHours(priority: string): number {
  switch (priority) {
    case "high": return 2;
    case "medium": return 4;
    case "low": return 8;
    default: return 4;
  }
}

function SlaBadge({ ticket, t }: { ticket: SupportTicket; t: ReturnType<typeof useTranslations> }) {
  if (ticket.status === "resolved" || ticket.status === "closed") return null;
  const slaHours = getSlaHours(ticket.priority);
  const slaDeadline = new Date(ticket.createdAt).getTime() + slaHours * 3600000;
  const remaining = slaDeadline - Date.now();
  const hoursLeft = remaining / 3600000;

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 text-red-700">
        <Clock className="w-2.5 h-2.5" />
        {t("supportPage.slaOverdue")}
      </span>
    );
  }
  const color = hoursLeft > 2 ? "bg-green-100 text-green-700" : hoursLeft > 1 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${color}`}>
      <Clock className="w-2.5 h-2.5" />
      {t("supportPage.expectedResponse", { hours: Math.ceil(hoursLeft) })}
    </span>
  );
}

function TicketRow({
  ticket,
  t,
  locale,
  onClick,
}: {
  ticket: SupportTicket;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  onClick: () => void;
}) {
  const isRTL = locale === "ar";
  const courseTitle =
    isRTL && ticket.courseTitleAr
      ? ticket.courseTitleAr
      : ticket.courseTitle;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 sm:p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors text-left"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <StatusBadge status={ticket.status} t={t} />
          <PriorityBadge priority={ticket.priority} t={t} />
          <span className="text-[10px] text-[#9CA3AF]">
            {t(`supportPage.category_${ticket.category}` as Parameters<typeof t>[0])}
          </span>
        </div>
        <h3 className="text-sm font-medium text-[#1F2937] truncate">
          {ticket.subject}
        </h3>
        {courseTitle && (
          <p className="text-xs text-[#6B7280] mt-0.5 truncate">
            {courseTitle}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] text-[#9CA3AF]">
            {new Date(ticket.createdAt).toLocaleDateString(
              isRTL ? "ar-SA" : "en-US",
              { year: "numeric", month: "short", day: "numeric" },
            )}
          </p>
          <SlaBadge ticket={ticket} t={t} />
        </div>
      </div>
      <ChevronRight
        className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 ${isRTL ? "rotate-180" : ""}`}
      />
    </button>
  );
}

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

function CreateTicketForm({
  t,
  locale,
  onCreated,
  onCancel,
}: {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const isRTL = locale === "ar";
  const [category, setCategory] = useState<TicketCategory>("technical");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: enrolledCourses } = useStudentCourses({ limit: 100 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setFormError(t("supportPage.fileTooLarge"));
      return;
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setFormError(t("supportPage.invalidFileType"));
      return;
    }
    setFormError(null);
    setAttachmentFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      let attachmentUrl: string | undefined;

      // Upload attachment first if present
      if (attachmentFile) {
        const uploadResult = await studentApi.uploadFile(attachmentFile);
        attachmentUrl = uploadResult.url;
      }

      await studentApi.createTicket({
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        ...(courseId && { courseId }),
        ...(attachmentUrl && { attachmentUrl }),
      });
      onCreated();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create ticket",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-[#1F2937]">
          {t("supportPage.newTicket")}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5 text-[#6B7280]" />
        </button>
      </div>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="space-y-4">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("supportPage.category")}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`supportPage.category_${cat}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </select>
        </div>

        {/* Related Course */}
        {enrolledCourses.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {t("supportPage.relatedCourse")}
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent"
            >
              <option value="">{t("supportPage.selectCourse")}</option>
              {enrolledCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {isRTL && c.titleAr ? c.titleAr : c.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("supportPage.priority")}
          </label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
                  priority === p
                    ? "border-[#002D87] bg-[#002D87] text-white"
                    : "border-[#D1D5DB] text-[#374151] hover:bg-gray-50"
                }`}
              >
                {t(`supportPage.priority_${p}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("supportPage.subject")}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder={t("supportPage.subjectPlaceholder")}
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("supportPage.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder={t("supportPage.descriptionPlaceholder")}
            className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent resize-none"
            required
          />
          <p className="text-xs text-[#9CA3AF] mt-1 text-right">
            {description.length}/2000
          </p>
        </div>

        {/* File Attachment */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("supportPage.attachment")}
          </label>
          {attachmentFile ? (
            <div className="flex items-center gap-2 p-2.5 border border-[#D1D5DB] rounded-lg bg-[#F9FAFB]">
              <Paperclip className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
              <span className="text-sm text-[#374151] truncate flex-1">
                {attachmentFile.name}
              </span>
              <span className="text-xs text-[#9CA3AF] flex-shrink-0">
                {(attachmentFile.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={() => setAttachmentFile(null)}
                className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-[#6B7280]" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-2.5 border border-dashed border-[#D1D5DB] rounded-lg cursor-pointer hover:bg-[#F9FAFB] transition-colors">
              <Paperclip className="w-4 h-4 text-[#9CA3AF]" />
              <span className="text-sm text-[#9CA3AF]">
                {t("supportPage.attachFile")}
              </span>
              <span className="text-xs text-[#D1D5DB] ml-auto">
                PDF, JPG, PNG (max 5MB)
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !subject.trim() || !description.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#002D87] text-white text-sm font-medium rounded-lg hover:bg-[#001f5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {t("supportPage.submitTicket")}
        </button>
      </div>
    </form>
  );
}

const SupportContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();

  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const {
    data: ticketsList,
    loading,
    error,
    refetch,
  } = useStudentTickets({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const handleTicketCreated = () => {
    setShowForm(false);
    refetch();
  };

  // If viewing ticket detail
  if (selectedTicketId) {
    return (
      <TicketDetailView
        ticketId={selectedTicketId}
        onBack={() => {
          setSelectedTicketId(null);
          refetch();
        }}
      />
    );
  }

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
              {/* Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                  {t("supportPage.title")}
                </h1>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#002D87] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#001f5c] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("supportPage.newTicket")}
                  </button>
                )}
              </div>

              <OfflineBanner />

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {showForm ? (
                  <CreateTicketForm
                    t={t}
                    locale={locale}
                    onCreated={handleTicketCreated}
                    onCancel={() => setShowForm(false)}
                  />
                ) : (
                  <>
                    {/* Status filter tabs */}
                    <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                      {STATUS_TABS.map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setStatusFilter(tab.key)}
                          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                            statusFilter === tab.key
                              ? "bg-[#002D87] text-white"
                              : "text-[#6B7280] hover:bg-gray-100"
                          }`}
                        >
                          {t(tab.label as Parameters<typeof t>[0])}
                        </button>
                      ))}
                    </div>

                    {/* Ticket list */}
                    {loading ? (
                      <div className="space-y-3 py-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-[#F3F4F6] rounded-lg h-16 animate-pulse" />
                        ))}
                      </div>
                    ) : error ? (
                      <StudentDashboardError message={error} onRetry={refetch} />
                    ) : ticketsList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                        <EmptyStateIllustration variant="tickets" className="mb-2" />
                        <h3 className="text-sm sm:text-base font-medium text-[#1F2937] mb-1">
                          {t("supportPage.noTicketsTitle")}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#6B7280] mb-4 sm:mb-6 text-center px-4">
                          {t("supportPage.noTicketsDescription")}
                        </p>
                        <button
                          onClick={() => setShowForm(true)}
                          className="flex items-center gap-1.5 px-5 py-2 border border-[#E5E7EB] text-[#1F2937] text-xs sm:text-sm font-medium rounded-lg hover:bg-[#F9FAFB] transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          {t("supportPage.createFirst")}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ticketsList.map((ticket) => (
                          <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            t={t}
                            locale={locale}
                            onClick={() => setSelectedTicketId(ticket.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportContent;
