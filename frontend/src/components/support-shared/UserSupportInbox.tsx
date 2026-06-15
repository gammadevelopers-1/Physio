"use client";

/**
 * Role-agnostic Support Inbox.
 *
 * Shared by Instructor, Course Manager, Finance, and Teaching-Assistant
 * dashboards. The Student dashboard keeps its own implementation
 * (`student-dashboard/SupportContent.tsx`) for now — both speak the
 * same backend endpoints (`/tickets`, `/tickets/my-tickets`).
 *
 * The caller wraps the inbox in its own role-specific chrome via the
 * `renderShell` prop — passing in sidebar, mobile sidebar, and navbar.
 * The inbox itself stays unaware of which dashboard hosts it.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Paperclip,
  Plus,
  Send,
  Upload,
  X,
} from "lucide-react";
import { useSupportOnlineStatus } from "@/hooks/useSupportOnlineStatus";
import { useMyTickets } from "@/hooks/support/useMyTickets";
import { FmtDate } from "@/components/ui/Fmt";
import { supportApi, uploadFormData } from "@/lib/api";
import type {
  SupportTicket,
  TicketStatus,
} from "@/types/student-dashboard";
import Select from "@/components/admin-dashboard/Select";
import SupportOfflineBanner from "@/components/student-dashboard/SupportOfflineBanner";

const STATUS_TABS = [
  { key: "all", labelKey: "filter.all" },
  { key: "new", labelKey: "filter.new" },
  { key: "in_progress", labelKey: "filter.in_progress" },
  { key: "on_hold", labelKey: "filter.on_hold" },
  { key: "resolved", labelKey: "filter.resolved" },
  { key: "closed", labelKey: "filter.closed" },
] as const;

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
  id: string;
  file: File;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  errorMessage?: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface UserSupportInboxCourse {
  id: string;
  title: string;
  titleAr?: string | null;
}

/** Dashboard-of-origin marker. Stored on the ticket and used to scope
 *  each role's Support tab so a multi-role user (e.g. instructor +
 *  course-manager + TA) does not see a unified pile across every
 *  Support tab — they only see tickets they raised from this
 *  dashboard. */
export type UserSupportInboxSource =
  | "instructor"
  | "course_manager"
  | "finance"
  | "ta"
  | "student";

export interface UserSupportInboxProps {
  /** Dashboard-of-origin marker. Filters the inbox to tickets raised
   *  from this dashboard, drives the create-ticket category dropdown
   *  (categories tagged for this role via the supervisor Categories
   *  panel), and is persisted on new tickets created here. */
  source: UserSupportInboxSource;
  /** When the caller wants the form to default to a specific slug.
   *  Falls back to the first applicable category if not provided. */
  defaultCategorySlug?: string;
  /** Optional course list — when present, the form shows a course
   *  picker. Pass `undefined` to hide the field entirely. */
  userCourses?: UserSupportInboxCourse[];
  /** Optional banner area rendered above the tabs (e.g. business-hours
   *  offline banner the role dashboard already renders). */
  topBanner?: ReactNode;
  /** Tile-style page header optional override. */
  pageTitle?: string;
  /** Called when the user clicks a ticket row — caller switches to a
   *  detail view. */
  onOpenTicket: (ticketId: string) => void;
  /** Render the dashboard chrome (navbar + sidebar + mobile sidebar)
   *  around the inbox body. The body is passed as `children`. */
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
    new: <AlertCircle className="w-3 h-3" />,
    in_progress: <Clock className="w-3 h-3" />,
    on_hold: <Clock className="w-3 h-3" />,
    resolved: <CheckCircle2 className="w-3 h-3" />,
    closed: <CheckCircle2 className="w-3 h-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] ?? ""}`}
    >
      {icons[status]}
      {t(`status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

function SlaBadge({
  ticket,
  t,
  supportOnline,
}: {
  ticket: SupportTicket;
  t: ReturnType<typeof useTranslations>;
  supportOnline: boolean | null;
}) {
  if (ticket.status === "resolved" || ticket.status === "closed") return null;
  const remaining = ticket.frtRemainingMinutes;
  if (supportOnline === false) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-700">
        <Clock className="w-2.5 h-2.5" />
        {t("sla.queuedUntilResume")}
      </span>
    );
  }
  if (remaining == null) return null;
  if (remaining < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-100 text-red-700">
        <Clock className="w-2.5 h-2.5" />
        {t("sla.overdue")}
      </span>
    );
  }
  const hoursLeft = remaining / 60;
  const color =
    hoursLeft > 2
      ? "bg-green-100 text-green-700"
      : hoursLeft > 1
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${color}`}
    >
      <Clock className="w-2.5 h-2.5" />
      {t("sla.expectedIn", { hours: Math.max(1, Math.ceil(hoursLeft)) })}
    </span>
  );
}

function TicketRow({
  ticket,
  t,
  locale,
  supportOnline,
  onClick,
}: {
  ticket: SupportTicket;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  supportOnline: boolean | null;
  onClick: () => void;
}) {
  const isRTL = locale === "ar";
  const courseTitle =
    isRTL && ticket.courseTitleAr ? ticket.courseTitleAr : ticket.courseTitle;
  // Category label. next-intl returns the key path on miss instead of
  // throwing, so detect that and fall back to the raw slug — admin-
  // extensible categories outside the builtin set would otherwise render
  // as `userSupport.category.xyz`.
  let categoryLabel: string = ticket.category;
  try {
    const translated = t(
      `category.${ticket.category}` as Parameters<typeof t>[0],
    );
    const fullKey = `userSupport.category.${ticket.category}`;
    if (translated && translated !== fullKey && translated !== `category.${ticket.category}`) {
      categoryLabel = translated;
    }
  } catch {
    // unreachable in next-intl
  }
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 sm:p-4 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-border-subtle)] transition-colors text-left"
      dir={isRTL ? "rtl" : "ltr"}
      title={ticket.subject}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <StatusBadge status={ticket.status} t={t} />
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {categoryLabel}
          </span>
          {ticket.referenceNumber && (
            <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">
              {ticket.referenceNumber}
            </span>
          )}
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
          <SlaBadge ticket={ticket} t={t} supportOnline={supportOnline} />
        </div>
      </div>
      <ChevronRight
        className={`w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 ${isRTL ? "rotate-180" : ""}`}
      />
    </button>
  );
}

function MultiAttachmentInput({
  t,
  attachments,
  onFilesAdded,
  onRemove,
  onRetry,
}: {
  t: ReturnType<typeof useTranslations>;
  attachments: PendingAttachment[];
  onFilesAdded: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        {t("form.attachments")}
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
          {t("form.dropFilesHere")}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {t("form.fileHint")}
        </span>
        <input
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          onChange={(e) => {
            onFilesAdded(e.target.files);
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
                <p className="text-sm text-[var(--color-text-primary)] truncate" title={a.file.name}>
                  {a.file.name}
                </p>
                <p
                  className={`text-xs ${a.status === "error" ? "text-red-600" : "text-[var(--color-text-secondary)]"}`}
                >
                  {a.status === "uploading"
                    ? t("form.uploading")
                    : a.status === "error"
                      ? a.errorMessage || t("form.uploadFailed")
                      : a.status === "done"
                        ? `${t("form.uploaded")} · ${formatBytes(a.file.size)}`
                        : formatBytes(a.file.size)}
                </p>
              </div>
              {a.status === "uploading" ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)] flex-shrink-0" />
              ) : a.status === "done" ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              ) : a.status === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              ) : null}
              {a.status === "error" && (
                <button
                  type="button"
                  onClick={() => onRetry(a.id)}
                  className="px-2 h-7 text-[11px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded flex-shrink-0"
                >
                  {t("form.retryUpload")}
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                className="p-0.5 hover:bg-[var(--color-border)] rounded flex-shrink-0"
                aria-label={t("form.removeAttachment")}
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

function CreateTicketForm({
  t,
  locale,
  defaultCategorySlug,
  userCourses,
  source,
  onCreated,
  onCancel,
}: {
  t: ReturnType<typeof useTranslations>;
  locale: string;
  defaultCategorySlug?: string;
  userCourses?: UserSupportInboxCourse[];
  source: UserSupportInboxSource;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const isRTL = locale === "ar";
  const [category, setCategory] = useState<string>(defaultCategorySlug ?? "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Categories applicable to this dashboard, fetched with a role
  // filter so supervisors can add new categories without a code
  // change. Falls back to a single "other" option if the API call
  // fails — the form must always be submittable.
  const [applicableCats, setApplicableCats] = useState<
    {
      slug: string;
      nameEn: string;
      nameAr: string | null;
      requiresCourse: boolean;
    }[]
  >([]);
  useEffect(() => {
    let cancelled = false;
    supportApi
      .listTicketCategories({ role: source })
      .then((cats) => {
        if (cancelled) return;
        const list = cats.map((c) => ({
          slug: c.slug,
          nameEn: c.nameEn,
          nameAr: c.nameAr,
          requiresCourse: !!c.requiresCourse,
        }));
        setApplicableCats(
          list.length > 0
            ? list
            : [
                {
                  slug: "other",
                  nameEn: "Other",
                  nameAr: "أخرى",
                  requiresCourse: false,
                },
              ],
        );
        setCategory((current) => {
          if (current && list.some((c) => c.slug === current)) return current;
          if (
            defaultCategorySlug &&
            list.some((c) => c.slug === defaultCategorySlug)
          ) {
            return defaultCategorySlug;
          }
          return list[0]?.slug ?? "other";
        });
      })
      .catch(() => {
        if (!cancelled) {
          setApplicableCats([
            {
              slug: "other",
              nameEn: "Other",
              nameAr: "أخرى",
              requiresCourse: false,
            },
          ]);
          setCategory("other");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, defaultCategorySlug]);

  // Phase 2 — the currently selected category's course-required flag.
  const selectedCategoryRequiresCourse = applicableCats.find(
    (c) => c.slug === category,
  )?.requiresCourse ?? false;

  const categoryOptions = applicableCats.map((c) => {
    const apiLabel = isRTL && c.nameAr ? c.nameAr : c.nameEn;
    let label = apiLabel;
    try {
      const translated = t(`category.${c.slug}` as Parameters<typeof t>[0]);
      // next-intl returns the raw key path (e.g. `userSupport.category.xyz`)
      // when a key is missing instead of throwing. Detect that and fall back
      // to the API-provided name so admin-extensible categories never show
      // raw keys.
      const fullKey = `userSupport.category.${c.slug}`;
      if (translated && translated !== fullKey && translated !== `category.${c.slug}`) {
        label = translated;
      }
    } catch {
      // truly unreachable in next-intl, but kept for safety
    }
    return { value: c.slug, label };
  });

  const courseOptions = userCourses
    ? [
        { value: "", label: t("form.selectCourse") },
        ...userCourses.map((c) => ({
          value: c.id,
          label: isRTL && c.titleAr ? c.titleAr : c.title,
        })),
      ]
    : [];

  function handleFilesAdded(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setFormError(null);
    const newPending: PendingAttachment[] = [];
    for (const file of Array.from(fileList)) {
      if (attachments.length + newPending.length >= MAX_ATTACHMENT_COUNT) {
        setFormError(
          t("form.maxAttachmentsReached", { max: MAX_ATTACHMENT_COUNT }),
        );
        break;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setFormError(t("form.fileTooLarge"));
        continue;
      }
      if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
        setFormError(t("form.invalidFileType"));
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
    for (const item of newPending) uploadOne(item);
  }

  async function uploadOne(item: PendingAttachment) {
    setAttachments((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, status: "uploading" } : a)),
    );
    try {
      const fd = new FormData();
      fd.append("file", item.file);
      const res = await uploadFormData<{ url: string; filename: string }>(
        "/storage/upload",
        fd,
      );
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

  function retryAttachment(id: string) {
    const item = attachments.find((a) => a.id === id);
    if (!item) return;
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: "queued", errorMessage: undefined }
          : a,
      ),
    );
    uploadOne(item);
  }

  const anyUploading = attachments.some((a) => a.status === "uploading");
  const hasErrors = attachments.some((a) => a.status === "error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    if (anyUploading) {
      setFormError(t("form.waitForUploads"));
      return;
    }
    // Phase 2 — categories that require a course must carry one. We
    // catch this client-side so the user sees an inline error rather
    // than a 400 from the server.
    if (selectedCategoryRequiresCourse && !courseId) {
      setFormError(t("form.courseRequired"));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      // Send rich attachments so the BE persists filename / mimeType /
      // sizeBytes and the chip on the ticket detail page renders with
      // the real file name and a proper PDF/image card.
      const doneAttachments = attachments.filter(
        (a) => a.status === "done" && a.url,
      );
      const richAttachments = doneAttachments.map((a) => ({
        url: a.url!,
        filename: a.file.name,
        mimeType: a.file.type || undefined,
        sizeBytes: a.file.size,
      }));
      await supportApi.createTicket({
        category,
        subject: subject.trim(),
        description: description.trim(),
        source,
        ...(courseId && { courseId }),
        ...(richAttachments.length > 0 && { attachments: richAttachments }),
      });
      onCreated();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("form.submitFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
          {t("newTicket")}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 hover:bg-[var(--color-border-subtle)] rounded"
          aria-label={t("form.cancel")}
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
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("form.category")}
          </label>
          <Select
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            placeholder={t("form.categoryPlaceholder")}
          />
        </div>

        {userCourses && userCourses.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("form.relatedCourse")}
              {selectedCategoryRequiresCourse && (
                <span className="ms-1 text-red-600">*</span>
              )}
            </label>
            <Select
              options={courseOptions}
              value={courseId}
              onChange={setCourseId}
              placeholder={t("form.selectCourse")}
            />
            {selectedCategoryRequiresCourse && (
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                {t("form.courseRequiredHint")}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("form.subject")}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder={t("form.subjectPlaceholder")}
            className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("form.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder={t("form.descriptionPlaceholder")}
            className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)] resize-none"
            required
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-right">
            {description.length}/2000
          </p>
        </div>

        <MultiAttachmentInput
          t={t}
          attachments={attachments}
          onFilesAdded={handleFilesAdded}
          onRemove={removeAttachment}
          onRetry={retryAttachment}
        />

        <button
          type="submit"
          disabled={
            submitting ||
            anyUploading ||
            !subject.trim() ||
            !description.trim()
          }
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[#001f5c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={hasErrors ? t("form.attachmentErrorsTip") : undefined}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {submitting ? t("form.submitting") : t("form.submit")}
        </button>
      </div>
    </form>
  );
}

const UserSupportInbox = ({
  source,
  defaultCategorySlug,
  userCourses,
  topBanner,
  pageTitle,
  onOpenTicket,
  renderShell,
}: UserSupportInboxProps) => {
  const locale = useLocale();
  const t = useTranslations("userSupport");
  const { isOnline: supportOnline } = useSupportOnlineStatus();

  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const {
    data: ticketsList,
    loading,
    error,
    refetch,
  } = useMyTickets({
    status: statusFilter === "all" ? undefined : statusFilter,
    source,
  });

  const handleTicketCreated = () => {
    setShowForm(false);
    refetch();
  };

  const body = (
    <>
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
          {pageTitle ?? t("title")}
        </h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-primary)] text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-[#001f5c] transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("newTicket")}
          </button>
        )}
      </div>

      {topBanner}
      <SupportOfflineBanner />

      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
        {showForm ? (
          <CreateTicketForm
            t={t}
            locale={locale}
            defaultCategorySlug={defaultCategorySlug}
            userCourses={userCourses}
            source={source}
            onCreated={handleTicketCreated}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <>
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
                  {t(tab.labelKey as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-[var(--color-border-subtle)] rounded-lg h-16 animate-pulse"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="py-10 text-center">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                  {t("loadFailed")}
                </p>
                <button
                  onClick={() => refetch()}
                  className="text-sm text-[var(--color-primary)] underline"
                >
                  {t("retry")}
                </button>
              </div>
            ) : ticketsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                <div className="w-16 h-16 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center mb-3">
                  <AlertCircle className="w-8 h-8 text-[var(--color-text-secondary)] opacity-60" />
                </div>
                <h3 className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] mb-1">
                  {t("noTicketsTitle")}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-6 text-center px-4 max-w-md">
                  {t("noTicketsDescription")}
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 px-5 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs sm:text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t("createFirst")}
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
                    supportOnline={supportOnline}
                    onClick={() => onOpenTicket(ticket.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return <>{renderShell(body)}</>;
};

export default UserSupportInbox;
