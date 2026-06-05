"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  HelpCircle,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentTickets } from "@/hooks/useStudentTickets";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import { FmtDate } from "@/components/ui/Fmt";
import { studentApi, supportApi } from "@/lib/api";
import type {
  SupportTicket,
  TicketStatus,
  TicketCategory,
} from "@/types/student-dashboard";
import TicketDetailView from "./TicketDetailView";
import EmptyStateIllustration from "./EmptyStateIllustration";
import Select from "@/components/admin-dashboard/Select";

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
    closed: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
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
      className="w-full flex items-center gap-3 p-3 sm:p-4 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-border-subtle)] transition-colors text-left"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <StatusBadge status={ticket.status} t={t} />
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {t(`supportPage.category_${ticket.category}` as Parameters<typeof t>[0])}
          </span>
        </div>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {ticket.subject}
        </h3>
        {courseTitle && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
            {courseTitle}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <FmtDate
            value={ticket.createdAt}
            variant="readable"
            locale={locale === "ar" ? "ar" : "en"}
            className="text-[10px] text-[var(--color-text-secondary)]"
          />
          <SlaBadge ticket={ticket} t={t} />
        </div>
      </div>
      <ChevronRight
        className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 ${isRTL ? "rotate-180" : ""}`}
      />
    </button>
  );
}

// Per-file: 5MB. Server upload endpoint caps at 10MB but we mirror the
// stricter limit on the client so the user gets fast feedback. Total
// attachment count capped to match the DTO (ArrayMaxSize(10)).
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const ATTACHMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

type PendingAttachment = {
  // Stable local id so we can re-render rows without keying on filename
  // (two files with the same name break a name-based key).
  id: string;
  file: File;
  /** "queued" before upload, "uploading" during, "done" with the URL,
   *  "error" with a message. */
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  errorMessage?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: enrolledCourses } = useStudentCourses({ limit: 100 });

  // Build options for the custom Select components.
  const categoryOptions = CATEGORIES.map((cat) => ({
    value: cat,
    label: t(`supportPage.category_${cat}` as Parameters<typeof t>[0]),
  }));
  const courseOptions = [
    { value: "", label: t("supportPage.selectCourse") },
    ...enrolledCourses.map((c) => ({
      value: c.id,
      label: isRTL && c.titleAr ? c.titleAr : c.title,
    })),
  ];

  // Accept a FileList and start uploading the valid ones in parallel.
  // Each upload's lifecycle is reflected in its own row — failed uploads
  // surface their error and can be removed without blocking the others.
  function handleFilesAdded(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setFormError(null);

    const newPending: PendingAttachment[] = [];
    for (const file of Array.from(fileList)) {
      if (attachments.length + newPending.length >= MAX_ATTACHMENT_COUNT) {
        setFormError(
          t("supportPage.maxAttachmentsReached", {
            max: MAX_ATTACHMENT_COUNT,
          }),
        );
        break;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setFormError(t("supportPage.fileTooLarge"));
        continue;
      }
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        setFormError(t("supportPage.invalidFileType"));
        continue;
      }
      newPending.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        status: "queued",
      });
    }

    if (newPending.length === 0) return;
    setAttachments((prev) => [...prev, ...newPending]);

    // Kick off uploads. We use the per-id helper instead of mutating
    // state inside the loop so React always sees the latest copy.
    for (const item of newPending) uploadOne(item);
  }

  async function uploadOne(item: PendingAttachment) {
    setAttachments((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, status: "uploading" } : a)),
    );
    try {
      const res = await studentApi.uploadFile(item.file);
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: "done", url: res.url } : a,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: "error", errorMessage: msg } : a,
        ),
      );
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  const anyUploading = attachments.some((a) => a.status === "uploading");
  const hasErrors = attachments.some((a) => a.status === "error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    if (anyUploading) {
      setFormError(t("supportPage.waitForUploads"));
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      // Only attachments that finished uploading get sent. Errored
      // rows are skipped silently — the user can see them and choose
      // to remove or retry by re-adding the file.
      const attachmentUrls = attachments
        .filter((a) => a.status === "done" && a.url)
        .map((a) => a.url!) as string[];

      await supportApi.createTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
        ...(courseId && { courseId }),
        ...(attachmentUrls.length > 0 && { attachmentUrls }),
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
        <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
          {t("supportPage.newTicket")}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 hover:bg-[var(--color-border-subtle)] rounded"
        >
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      {formError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="space-y-4">
        {/* Category — custom dropdown */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("supportPage.category")}
          </label>
          <Select
            options={categoryOptions}
            value={category}
            onChange={(v) => setCategory(v as TicketCategory)}
            placeholder={t("supportPage.category")}
          />
        </div>

        {/* Related Course — custom dropdown */}
        {enrolledCourses.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("supportPage.relatedCourse")}
            </label>
            <Select
              options={courseOptions}
              value={courseId}
              onChange={setCourseId}
              placeholder={t("supportPage.selectCourse")}
            />
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("supportPage.subject")}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder={t("supportPage.subjectPlaceholder")}
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("supportPage.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder={t("supportPage.descriptionPlaceholder")}
            className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
            required
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-right">
            {description.length}/2000
          </p>
        </div>

        {/* Multi-file attachments */}
        <MultiAttachmentInput
          t={t}
          attachments={attachments}
          onFilesAdded={handleFilesAdded}
          onRemove={removeAttachment}
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={
            submitting ||
            anyUploading ||
            !subject.trim() ||
            !description.trim()
          }
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[#001f5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={hasErrors ? t("supportPage.attachmentErrorsTip") : undefined}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {submitting
            ? t("supportPage.submitting")
            : t("supportPage.submitTicket")}
        </button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────
// MultiAttachmentInput
//
// Drag-and-drop + click-to-pick file picker. Each picked file uploads
// in parallel and surfaces its own row with status (uploading / done /
// error). The submit button is gated on `anyUploading` in the parent
// so users can't fire createTicket with an attachment URL that hasn't
// landed yet.
// ──────────────────────────────────────────────────────────────────
function MultiAttachmentInput({
  t,
  attachments,
  onFilesAdded,
  onRemove,
}: {
  t: ReturnType<typeof useTranslations>;
  attachments: PendingAttachment[];
  onFilesAdded: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        {t("supportPage.attachments")}
      </label>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          onFilesAdded(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-1 p-4 border border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragOver
            ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
            : "border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
        }`}
      >
        <Upload className="w-5 h-5 text-[var(--color-text-secondary)]" />
        <span className="text-sm text-[var(--color-text-primary)]">
          {t("supportPage.dropFilesHere")}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {t("supportPage.fileHint")}
        </span>
        <input
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          onChange={(e) => {
            onFilesAdded(e.target.files);
            // Reset so re-picking the same file fires onChange again.
            e.target.value = "";
          }}
          className="hidden"
        />
      </label>

      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className={`flex items-center gap-2 p-2.5 border rounded-lg ${
                a.status === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-[var(--color-border)] bg-[var(--color-surface-page)]"
              }`}
            >
              <Paperclip className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] truncate">
                  {a.file.name}
                </p>
                <p
                  className={`text-xs ${a.status === "error" ? "text-red-600" : "text-[var(--color-text-secondary)]"}`}
                >
                  {a.status === "uploading"
                    ? t("supportPage.uploading")
                    : a.status === "error"
                      ? a.errorMessage || t("supportPage.uploadFailed")
                      : a.status === "done"
                        ? t("supportPage.uploaded")
                        : formatBytes(a.file.size)}
                  {a.status !== "error" &&
                    a.status !== "uploading" &&
                    a.status === "done" &&
                    ` · ${formatBytes(a.file.size)}`}
                </p>
              </div>
              {a.status === "uploading" ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)] flex-shrink-0" />
              ) : a.status === "done" ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              ) : a.status === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                className="p-0.5 hover:bg-[var(--color-border)] rounded flex-shrink-0"
                aria-label={t("supportPage.removeAttachment")}
              >
                <X className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type MainTab = "tickets" | "faq" | "articles";

const FAQ_CATEGORIES = ["enrollment", "sessions", "assessments", "certificates", "technical"] as const;

function FAQSection({ t, locale }: { t: ReturnType<typeof useTranslations>; locale: string }) {
  const isRTL = locale === "ar";
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const faqItems = FAQ_CATEGORIES.flatMap((cat) => {
    const count = cat === "enrollment" ? 3 : cat === "sessions" ? 3 : cat === "assessments" ? 3 : cat === "certificates" ? 3 : 3;
    return Array.from({ length: count }, (_, i) => ({
      category: cat,
      question: t(`supportPage.faq.${cat}_q${i + 1}` as Parameters<typeof t>[0]),
      answer: t(`supportPage.faq.${cat}_a${i + 1}` as Parameters<typeof t>[0]),
    }));
  });

  const filtered = faqItems.filter((item) => {
    const matchesCategory = activeCategory === "all" || item.category === activeCategory;
    const matchesSearch = !searchQuery || item.question.toLowerCase().includes(searchQuery.toLowerCase()) || item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Search */}
      <div className="relative mb-4">
        <Search className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-3" : "left-3"} w-4 h-4 text-[var(--color-text-secondary)]`} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("supportPage.searchFaq")}
          className={`w-full ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"} py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002D87] focus:border-transparent`}
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeCategory === "all" ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"}`}
        >
          {t("supportPage.faq.allCategories")}
        </button>
        {FAQ_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeCategory === cat ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"}`}
          >
            {t(`supportPage.faq.${cat}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {/* FAQ Accordion */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <HelpCircle className="w-10 h-10 text-[var(--color-border)] mx-auto mb-2" />
          <p className="text-sm text-[var(--color-text-secondary)]">{t("supportPage.faq.noResults")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, index) => (
            <div key={index} className="border border-[var(--color-border)] rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] flex-shrink-0">
                    {t(`supportPage.faq.${item.category}` as Parameters<typeof t>[0])}
                  </span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.question}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 transition-transform ${expandedIndex === index ? "rotate-180" : ""}`} />
              </button>
              {expandedIndex === index && (
                <div className="px-4 pb-3 text-sm text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-3">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SupportContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();

  const [mainTab, setMainTab] = useState<MainTab>("tickets");
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

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("supportPage.title")}
                </h1>
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-primary)] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#001f5c] transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("supportPage.newTicket")}
                  </button>
                )}
              </div>

              <OfflineBanner />

              {/* Main Tabs: Tickets / Help Articles / FAQ */}
              <div className="flex gap-1 mb-4 border-b border-[var(--color-border)] overflow-x-auto">
                {([
                  { key: "tickets" as MainTab, label: t("supportPage.tabTickets"), icon: MessageSquarePlus },
                  { key: "articles" as MainTab, label: t("supportPage.tabArticles"), icon: BookOpen },
                  { key: "faq" as MainTab, label: t("supportPage.tabFaq"), icon: HelpCircle },
                ]).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setMainTab(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
                        mainTab === tab.key
                          ? "border-[#002D87] text-[var(--color-primary)]"
                          : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              {mainTab === "articles" ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                  <HelpArticlesSection t={t} locale={locale} />
                </div>
              ) : mainTab === "faq" ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                  <FAQSection t={t} locale={locale} />
                </div>
              ) : (
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
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
                              ? "bg-[var(--color-primary)] text-white"
                              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
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
                          <div key={i} className="bg-[var(--color-border-subtle)] rounded-lg h-16 animate-pulse" />
                        ))}
                      </div>
                    ) : error ? (
                      <StudentDashboardError message={error} onRetry={refetch} />
                    ) : ticketsList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                        <EmptyStateIllustration variant="tickets" className="mb-2" />
                        <h3 className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] mb-1">
                          {t("supportPage.noTicketsTitle")}
                        </h3>
                        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-6 text-center px-4">
                          {t("supportPage.noTicketsDescription")}
                        </p>
                        <button
                          onClick={() => setShowForm(true)}
                          className="flex items-center gap-1.5 px-5 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs sm:text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
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
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// Help Articles — student-dashboard view of the public Help Center.
// Lightweight inline list with search, category chips, and links to
// the full article-detail page at /[locale]/support/kb/[id].
// ──────────────────────────────────────────────────────────────────
function HelpArticlesSection({
  t,
  locale,
}: {
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const isRTL = locale === "ar";
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<
    { id: string; slug: string; nameEn: string; nameAr: string | null }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      supportApi
        .getKbArticles({
          category: activeCategory === "all" ? undefined : activeCategory,
          search: search || undefined,
        })
        .then((d) => (d || []).filter((a: any) => a.published)),
      categories.length === 0
        ? supportApi.listKbCategories().catch(() => [])
        : Promise.resolve(categories),
    ])
      .then(([articlesRes, categoriesRes]) => {
        if (cancelled) return;
        setArticles(articlesRes);
        if (categoriesRes && categoriesRes.length) {
          setCategories(categoriesRes);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // categories.length intentionally left out — only one fetch is needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, search]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("supportPage.articlesSearchPlaceholder")}
            className={`w-full h-9 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]`}
          />
        </div>
        <Link
          href={`/${locale}/support/kb`}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
        >
          {t("supportPage.openHelpCenter")}
          <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 text-[12px] font-medium rounded-full whitespace-nowrap ${
            activeCategory === "all"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
          }`}
        >
          {t("supportPage.articlesAll")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.slug)}
            className={`px-3 py-1 text-[12px] font-medium rounded-full whitespace-nowrap ${
              activeCategory === c.slug
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
            }`}
          >
            {isRTL && c.nameAr ? c.nameAr : c.nameEn}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : articles.length === 0 ? (
        <div className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {t("supportPage.articlesEmpty")}
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => {
            const title = isRTL
              ? article.titleAr || article.titleEn
              : article.titleEn || article.titleAr;
            return (
              <Link
                key={article.id}
                href={`/${locale}/support/kb/${article.id}`}
                className="block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                dir={isRTL ? "rtl" : "ltr"}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1 line-clamp-1">
                      {title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
                      <span className="px-1.5 py-0.5 bg-[var(--color-border-subtle)] rounded-full">
                        {article.category}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-[var(--color-text-secondary)] opacity-50 flex-shrink-0 mt-1 ${isRTL ? "rotate-180" : ""}`}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SupportContent;
