"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2, UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import { useSupportAttachmentUpload } from "@/hooks/useSupportAttachmentUpload";
import AttachmentPickerBar from "@/components/support-shared/AttachmentPickerBar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  /** When the ticket has a course attached we use it to scope the
   *  Instructor / TA / Course Manager dropdowns. When null, those
   *  dept options are hidden entirely. */
  courseId: string | null;
  /** Pre-select a department (e.g. from the category's
   *  suggestedDepartment hint). Optional. */
  suggestedDepartment?: string | null;
  /** Already-active collaborator user IDs — used to grey-out members
   *  who are already on the ticket. */
  activeUserIds: string[];
  onAdded: () => void;
}

type Member = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  courseRoleLabel?: string;
};

// Course-bound departments only show up when courseId is set.
const COURSE_BOUND = new Set(["instructor", "ta", "course_manager"]);

const ALL_DEPARTMENTS: { key: string; tone: string }[] = [
  { key: "finance", tone: "bg-amber-50 text-amber-900 border-amber-200" },
  { key: "course_manager", tone: "bg-indigo-50 text-indigo-900 border-indigo-200" },
  { key: "instructor", tone: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  { key: "ta", tone: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  { key: "admin", tone: "bg-red-50 text-red-900 border-red-200" },
  { key: "supervisor", tone: "bg-sky-50 text-sky-900 border-sky-200" },
];

export default function LoopInCollaboratorModal({
  open,
  onOpenChange,
  ticketId,
  courseId,
  suggestedDepartment,
  activeUserIds,
  onAdded,
}: Props) {
  const t = useTranslations("supportDashboard.ticketDetail.loopIn");
  const tDept = useTranslations("support.departments");
  const [dept, setDept] = useState<string | null>(
    suggestedDepartment ?? null,
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const upload = useSupportAttachmentUpload();

  // Reset state on (re)open.
  useEffect(() => {
    if (!open) return;
    setDept(suggestedDepartment ?? null);
    setMemberId(null);
    setMembers([]);
    setMessage("");
    upload.clear();
    // upload.clear identity is stable per instance; deliberately not
    // in deps to avoid re-firing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestedDepartment]);

  const notifyAttachmentRejects = (
    r: ReturnType<typeof upload.addFiles>,
  ) => {
    if (r.rejectedType.length)
      toast.error(t("attachRejectedType", { names: r.rejectedType.join(", ") }));
    if (r.rejectedSize.length)
      toast.error(t("attachRejectedSize", { names: r.rejectedSize.join(", ") }));
    if (r.rejectedCap.length)
      toast.error(t("attachRejectedCap"));
  };

  // Fetch members when dept changes.
  useEffect(() => {
    if (!open || !dept) {
      setMembers([]);
      return;
    }
    if (COURSE_BOUND.has(dept) && !courseId) {
      // Course-bound dept without a course — no eligible members.
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    supportApi
      .getDepartmentMembers(dept, courseId ? { courseId } : undefined)
      .then((res) => {
        setMembers(res.members);
        // Auto-pick the first non-active member as a convenience.
        const firstAvailable = res.members.find(
          (m) => !activeUserIds.includes(m.id),
        );
        setMemberId(firstAvailable?.id ?? res.members[0]?.id ?? null);
      })
      .catch(() => {
        setMembers([]);
        toast.error(t("memberFetchError"));
      })
      .finally(() => setLoadingMembers(false));
  }, [open, dept, courseId, activeUserIds, t]);

  // ESC to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async () => {
    if (!dept || !memberId) {
      toast.error(t("pickRequired"));
      return;
    }
    if (activeUserIds.includes(memberId)) {
      toast.error(t("alreadyActive"));
      return;
    }
    if (upload.isUploading) {
      toast.error(t("waitForUploads"));
      return;
    }
    const richAtts = upload.getDoneRich();
    const trimmedMessage = message.trim();
    setSubmitting(true);
    try {
      await supportApi.addCollaborator(ticketId, {
        userId: memberId,
        department: dept,
        message: trimmedMessage || undefined,
        attachments: richAtts.length > 0 ? richAtts : undefined,
      });
      toast.success(t("addedSuccess"));
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        (e as { message?: string })?.message || t("addFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const departmentsToShow = ALL_DEPARTMENTS.filter((d) => {
    // Hide course-bound depts when there's no course attached.
    if (COURSE_BOUND.has(d.key) && !courseId) return false;
    return true;
  });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <button
        aria-label="Close"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        tabIndex={-1}
      />
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-2xl border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-[var(--color-text-primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t("title")}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg hover:bg-[var(--color-bg-secondary)] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Step 1 — Department picker */}
        <div className="px-5 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            {t("stepDepartment")}
          </div>
          <div className="flex flex-wrap gap-2">
            {departmentsToShow.map((d) => {
              const active = dept === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDept(d.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : d.tone + " hover:opacity-80"
                  }`}
                >
                  {tDept(d.key)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2 — Member picker */}
        <div className="px-5 pt-5 pb-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            {t("stepMember")}
          </div>

          {!dept ? (
            <div className="text-xs text-[var(--color-text-secondary)] py-4 text-center bg-[var(--color-bg-secondary)] rounded-lg">
              {t("pickDepartmentFirst")}
            </div>
          ) : loadingMembers ? (
            <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-secondary)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("loadingMembers")}
            </div>
          ) : members.length === 0 ? (
            <div className="text-xs text-[var(--color-text-secondary)] py-4 text-center bg-[var(--color-bg-secondary)] rounded-lg">
              {t("noMembers")}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
              {members.map((m) => {
                const isActive = activeUserIds.includes(m.id);
                const isPicked = memberId === m.id;
                const name = [m.firstName, m.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || m.email;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => !isActive && setMemberId(m.id)}
                    disabled={isActive}
                    className={`w-full text-start px-3 py-2.5 flex items-start gap-3 transition-colors ${
                      isActive
                        ? "bg-[var(--color-bg-secondary)] opacity-60 cursor-not-allowed"
                        : isPicked
                          ? "bg-[var(--color-primary)]/10"
                          : "hover:bg-[var(--color-bg-secondary)]"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${
                        isPicked
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                          : "border-[var(--color-border)]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {name}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {m.courseRoleLabel ?? m.email}
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded bg-[var(--color-border)]/40">
                        {t("alreadyOn")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 3 — Optional context reply (message + attachments).
            Posted as an internal comment on the ticket so the new
            collaborator sees WHY they were pulled in. Empty on both
            fields → legacy silent add. */}
        <div className="px-5 pt-3 pb-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2">
            {t("stepMessage")}{" "}
            <span className="font-normal normal-case text-[var(--color-text-secondary)]/60">
              ({t("messageOptional")})
            </span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            maxLength={1000}
            rows={3}
            disabled={submitting}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none disabled:opacity-50 mb-2"
          />
          <AttachmentPickerBar
            pending={upload.pending}
            onAdd={(files) => notifyAttachmentRejects(upload.addFiles(files))}
            onRemove={upload.remove}
            disabled={submitting}
            maxCount={upload.maxCount}
            maxBytes={upload.maxBytes}
          />
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-1.5">
            {t("messageHint")}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-[var(--color-bg-secondary)] flex items-center justify-end gap-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting || !dept || !memberId || upload.isUploading
            }
            className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("addCollaborator")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
