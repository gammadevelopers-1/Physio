"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ArrowRightLeft, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import Select from "@/components/admin-dashboard/Select";

interface Category {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  requiresCourse: boolean;
  suggestedDepartment: string | null;
  applicableRoles: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  /** Current ticket category — used to exclude from the target dropdown. */
  currentCategory: string;
  /** Whether the ticket has a course attached — gates course-bound depts. */
  courseId: string | null;
  /** Pre-loaded categories so we don't re-fetch in every transfer. */
  categories: Category[];
  onTransferred: () => void;
}

const COURSE_BOUND = new Set(["instructor", "ta", "course_manager"]);

const ALL_DEPARTMENTS = [
  "finance",
  "course_manager",
  "instructor",
  "ta",
  "admin",
  "supervisor",
];

export default function TransferTicketModal({
  open,
  onOpenChange,
  ticketId,
  currentCategory,
  courseId,
  categories,
  onTransferred,
}: Props) {
  const t = useTranslations("supportDashboard.ticketDetail.transfer");
  const tDept = useTranslations("support.departments");

  const [toCategory, setToCategory] = useState<string>("");
  const [toDepartment, setToDepartment] = useState<string>("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset on (re)open.
  useEffect(() => {
    if (!open) return;
    setToCategory("");
    setToDepartment("");
    setNote("");
  }, [open]);

  // Auto-pick suggested department when category changes.
  useEffect(() => {
    if (!toCategory) return;
    const cat = categories.find((c) => c.slug === toCategory);
    if (cat?.suggestedDepartment) {
      setToDepartment(cat.suggestedDepartment);
    }
  }, [toCategory, categories]);

  // ESC + body scroll lock
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

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.slug !== currentCategory)
        // If category requires a course but the ticket doesn't have
        // one, drop it — we can't satisfy the constraint.
        .filter((c) => !c.requiresCourse || !!courseId)
        .sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
    [categories, currentCategory, courseId],
  );

  const departmentOptions = useMemo(
    () =>
      ALL_DEPARTMENTS.filter((d) => {
        if (COURSE_BOUND.has(d) && !courseId) return false;
        return true;
      }),
    [courseId],
  );

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async () => {
    if (!toCategory || !toDepartment) {
      toast.error(t("pickBoth"));
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.transferTicket(ticketId, {
        toCategory,
        toDepartment,
        noteToRequester: note.trim() || undefined,
      });
      toast.success(t("transferredSuccess"));
      onTransferred();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        (e as { message?: string })?.message || t("transferFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-[var(--color-text-primary)]" />
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

        <div className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] block mb-1.5">
              {t("toCategory")}
            </label>
            <Select
              value={toCategory}
              onChange={setToCategory}
              placeholder={t("selectCategory")}
              options={categoryOptions.map((c) => ({
                value: c.slug,
                label: `${c.nameEn}${c.requiresCourse ? " ★" : ""}`,
              }))}
            />
          </div>

          {/* Department */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] block mb-1.5">
              {t("toDepartment")}
            </label>
            <Select
              value={toDepartment}
              onChange={setToDepartment}
              placeholder={t("selectDepartment")}
              options={departmentOptions.map((d) => ({
                value: d,
                label: tDept(d),
              }))}
            />
          </div>

          {/* Optional note override */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] block mb-1.5">
              {t("noteToRequester")}{" "}
              <span className="font-normal normal-case text-[var(--color-text-secondary)]/60">
                ({t("noteOptional")})
              </span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
            <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              {t("noteHelp")}
            </div>
          </div>

          {/* Warning panel */}
          <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {t("brokerNotice")}
          </div>
        </div>

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
            disabled={submitting || !toCategory || !toDepartment}
            className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("confirmTransfer")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
