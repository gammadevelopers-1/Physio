"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Merge,
  ArrowRightLeft,
  Loader2,
  X,
  ChevronDown,
  Inbox,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { supportApi } from "@/lib/api";
import TransferTicketModal from "./TransferTicketModal";

interface Props {
  ticketId: string;
  ticketCategory: string;
  basePath: string;
  isSupervisor: boolean;
  /** Course attached to this ticket — gates course-bound departments
   *  in the Transfer modal. Leave null/undefined when unknown (the
   *  modal falls back to a course-agnostic dept list). */
  courseId?: string | null;
  onChanged?: () => void;
}

type Dialog = null | "merge";

type MergeCandidate = {
  id: string;
  referenceNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
};

type Category = {
  slug: string;
  nameEn: string;
  nameAr: string | null;
  requiresCourse: boolean;
  suggestedDepartment: string | null;
  applicableRoles: string[];
};

// Compact governance bar shown above the ticket header for supervisors.
// Two actions:
//   - Merge:    pick from a list of same-customer / same-category open
//               tickets (no UUID pasting). Confirmed actions feed the
//               supervisor audit trail as `merged`.
//   - Transfer: pick the target category from the admin-defined list
//               (no free-text). Confirmed actions feed the supervisor
//               audit trail as `transferred`.
//
// Agents don't see this bar — these are policy actions, not agent
// workflow.
export default function TicketGovernanceToolbar({
  ticketId,
  ticketCategory,
  basePath,
  isSupervisor,
  courseId,
  onChanged,
}: Props) {
  const router = useRouter();
  const t = useTranslations("supportDashboard.ticketDetail.governance");
  const [dialog, setDialog] = useState<Dialog>(null);

  // ── Merge state ───────────────────────────────────────────
  const [candidates, setCandidates] = useState<MergeCandidate[] | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeNote, setMergeNote] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const mergeRef = useRef<HTMLDivElement>(null);

  // ── Transfer state ────────────────────────────────────────
  // Phase 2 — the Transfer button now opens the canonical
  // <TransferTicketModal> (broker-model: category + dept + system
  // message). We still own a small categories cache here so the modal
  // doesn't have to refetch on every open.
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Lazy-load categories the first time the user opens Transfer; cache
  // for the lifetime of the toolbar so reopening is instant.
  useEffect(() => {
    if (!showTransferModal || categories) return;
    supportApi
      .listTicketCategories()
      .then((rows) => setCategories(rows))
      .catch(() => setCategories([]));
  }, [showTransferModal, categories]);

  // Reset merge form state whenever the merge modal re-opens so
  // leftover values from a cancelled attempt don't bleed into the
  // next one.
  useEffect(() => {
    if (dialog === null) {
      setMergeOpen(false);
    }
    if (dialog === "merge") {
      setMergeTargetId("");
      setMergeNote("");
      setCandidatesLoading(true);
      supportApi
        .getMergeCandidates(ticketId)
        .then((rows) => setCandidates(rows))
        .catch(() => setCandidates([]))
        .finally(() => setCandidatesLoading(false));
    }
  }, [dialog, ticketId]);

  // Esc-to-close.
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  // Close merge dropdown on outside click.
  useEffect(() => {
    if (!mergeOpen) return;
    const onClick = (e: MouseEvent) => {
      if (mergeRef.current && !mergeRef.current.contains(e.target as Node)) {
        setMergeOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [mergeOpen]);

  const doMerge = useCallback(async () => {
    if (!mergeTargetId) {
      toast.error(t("merge.errorPickTarget"));
      return;
    }
    setMerging(true);
    try {
      const res = await supportApi.mergeTicket(
        ticketId,
        mergeTargetId,
        mergeNote.trim() || undefined,
      );
      toast.success(t("merge.success"));
      setDialog(null);
      router.push(`${basePath}/tickets/${res.targetTicketId}`);
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || t("merge.errorGeneric"));
    } finally {
      setMerging(false);
    }
  }, [mergeTargetId, mergeNote, ticketId, basePath, router, onChanged, t]);

  if (!isSupervisor) return null;

  const selectedCandidate =
    candidates?.find((c) => c.id === mergeTargetId) || null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setDialog("merge")}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
        >
          <Merge className="w-3.5 h-3.5" />
          {t("mergeButton")}
        </button>
        <button
          type="button"
          onClick={() => setShowTransferModal(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          {t("transferButton")}
        </button>
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <div
            className="w-full max-w-lg bg-[var(--color-surface-card)] rounded-2xl shadow-xl border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── header ─────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("merge.title")}
              </h3>
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={merging}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                aria-label={t("close")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── body ───────────────────────────────────── */}
            <div className="px-5 py-4 space-y-4">
              {dialog === "merge" && (
                <>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t("merge.intro")}
                  </p>

                  {/* Themed target dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("merge.targetLabel")}
                    </label>
                    <div ref={mergeRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setMergeOpen((v) => !v)}
                        disabled={merging || candidatesLoading}
                        className="w-full min-h-[40px] px-3 py-2 flex items-center justify-between gap-2 bg-white border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:border-[var(--color-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                      >
                        <span className="text-start truncate">
                          {candidatesLoading ? (
                            <span className="text-[var(--color-text-secondary)]">
                              {t("merge.loading")}
                            </span>
                          ) : selectedCandidate ? (
                            <span>
                              <span className="font-medium">
                                {selectedCandidate.referenceNumber}
                              </span>{" "}
                              <span className="text-[var(--color-text-secondary)]">
                                — {selectedCandidate.subject}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-secondary)]">
                              {t("merge.targetPlaceholder")}
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            mergeOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {mergeOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-10 py-1 overflow-hidden max-h-72 overflow-y-auto">
                          {candidates && candidates.length > 0 ? (
                            candidates.map((c) => {
                              const isSelected = c.id === mergeTargetId;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setMergeTargetId(c.id);
                                    setMergeOpen(false);
                                  }}
                                  className={`w-full px-3 py-2.5 text-start hover:bg-[var(--color-border-subtle)] flex items-start gap-2 ${
                                    isSelected
                                      ? "bg-[var(--color-border-subtle)]"
                                      : ""
                                  }`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 text-sm">
                                      <span
                                        className={`font-semibold ${
                                          isSelected
                                            ? "text-[var(--color-primary)]"
                                            : "text-[var(--color-text-primary)]"
                                        }`}
                                      >
                                        {c.referenceNumber}
                                      </span>
                                      <PriorityChip priority={c.priority} />
                                      <StatusChip status={c.status} />
                                    </div>
                                    <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                                      {c.subject}
                                    </p>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-1" />
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-3 py-6 flex flex-col items-center gap-2 text-center">
                              <Inbox className="w-6 h-6 text-[var(--color-text-secondary)] opacity-60" />
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("merge.empty")}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Optional note */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
                      {t("merge.noteLabel")}
                    </label>
                    <input
                      type="text"
                      value={mergeNote}
                      onChange={(e) => setMergeNote(e.target.value)}
                      maxLength={200}
                      disabled={merging}
                      placeholder={t("merge.notePlaceholder")}
                      className="w-full h-10 px-3 bg-white border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                    />
                  </div>
                </>
              )}

            </div>

            {/* ── footer ────────────────────────────────── */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-subtle)]">
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={merging}
                className="px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              {dialog === "merge" && (
                <button
                  type="button"
                  onClick={doMerge}
                  disabled={
                    merging || candidatesLoading || !mergeTargetId
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {merging && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("merge.submit")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 — Transfer (broker model). Same modal the right-hand
          "Involved departments" panel opens; mounting it here ensures
          the toolbar's Transfer button uses the identical flow. */}
      <TransferTicketModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        ticketId={ticketId}
        currentCategory={ticketCategory}
        courseId={courseId ?? null}
        categories={categories ?? []}
        onTransferred={() => onChanged?.()}
      />
    </>
  );
}

// Tiny inline chips for the merge dropdown rows. Kept local to the
// toolbar because they're only used here and stay simple/visual.
function PriorityChip({ priority }: { priority: string }) {
  const cls =
    priority === "high"
      ? "text-[#991B1B] bg-[#FEE2E2] border-[#FCA5A5]"
      : priority === "low"
        ? "text-[#1D4ED8] bg-[#DBEAFE] border-[#93C5FD]"
        : "text-[#92400E] bg-[#FEF3C7] border-[#FDE68A]";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${cls} uppercase`}
    >
      {priority}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "new"
      ? "text-[#1D4ED8] bg-[#DBEAFE] border-[#93C5FD]"
      : status === "in_progress"
        ? "text-[#92400E] bg-[#FEF3C7] border-[#FDE68A]"
        : "text-[#6B21A8] bg-[#F3E8FF] border-[#D8B4FE]"; // on_hold
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${cls} uppercase`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
