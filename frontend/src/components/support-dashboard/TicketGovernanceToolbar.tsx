"use client";

import { useState, useEffect } from "react";
import { Merge, ArrowRightLeft, FileClock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supportApi } from "@/lib/api";

interface Props {
  ticketId: string;
  ticketCategory: string;
  basePath: string;
  isSupervisor: boolean;
  onChanged?: () => void;
}

type Dialog = null | "merge" | "transfer" | "audit";

// Compact governance bar shown above the ticket header for supervisors.
// Three actions:
//   - Merge: roll this ticket into another (same customer)
//   - Transfer: change the category + reassign
//   - Audit: read-only view of the ticket's audit_logs rows
//
// Agent role hides the bar entirely — these are policy actions, not
// agent workflow.
export default function TicketGovernanceToolbar({
  ticketId,
  ticketCategory,
  basePath,
  isSupervisor,
  onChanged,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);

  // Merge state
  const [mergeTargetRef, setMergeTargetRef] = useState("");
  const [mergeNote, setMergeNote] = useState("");
  const [merging, setMerging] = useState(false);

  // Transfer state
  const [transferCategory, setTransferCategory] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferReassign, setTransferReassign] = useState(true);
  const [transferring, setTransferring] = useState(false);

  // Audit state (loaded lazily on open)
  const [audit, setAudit] = useState<Awaited<
    ReturnType<typeof supportApi.getTicketAuditLog>
  > | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (dialog !== "audit") return;
    setAuditLoading(true);
    supportApi
      .getTicketAuditLog(ticketId, 50)
      .then((rows) => setAudit(rows))
      .catch(() => setAudit([]))
      .finally(() => setAuditLoading(false));
  }, [dialog, ticketId]);

  if (!isSupervisor) return null;

  async function doMerge() {
    // The user pasted a reference like "T-000123" — server expects a
    // UUID. We need to resolve it via a list lookup. Simplest path:
    // ask the user for the target UUID via a paste of the URL. For
    // now we accept a UUID directly; supervisors can copy from the
    // ticket URL.
    const trimmed = mergeTargetRef.trim();
    if (!trimmed) {
      toast.error("Paste the target ticket's URL or UUID");
      return;
    }
    // Allow pasting a full /tickets/:id URL — extract the UUID at the end.
    const uuidMatch = trimmed.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    if (!uuidMatch) {
      toast.error("Target must be a ticket UUID or URL");
      return;
    }
    setMerging(true);
    try {
      const res = await supportApi.mergeTicket(
        ticketId,
        uuidMatch[0],
        mergeNote.trim() || undefined,
      );
      toast.success("Ticket merged");
      setDialog(null);
      // Route the user to the target so they see the unified thread.
      router.push(`${basePath}/tickets/${res.targetTicketId}`);
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Merge failed");
    } finally {
      setMerging(false);
    }
  }

  async function doTransfer() {
    const cat = transferCategory.trim();
    if (!cat) {
      toast.error("Pick a target category");
      return;
    }
    setTransferring(true);
    try {
      await supportApi.transferTicket(ticketId, {
        category: cat,
        reason: transferReason.trim() || undefined,
        reassign: transferReassign,
      });
      toast.success("Ticket transferred");
      setDialog(null);
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setDialog("merge")}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
        >
          <Merge className="w-3.5 h-3.5" />
          Merge
        </button>
        <button
          type="button"
          onClick={() => {
            setTransferCategory(ticketCategory === "billing" ? "" : "billing");
            setDialog("transfer");
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Transfer
        </button>
        <button
          type="button"
          onClick={() => setDialog("audit")}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]"
        >
          <FileClock className="w-3.5 h-3.5" />
          Audit
        </button>
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {dialog === "merge"
                  ? "Merge this ticket into another"
                  : dialog === "transfer"
                    ? "Transfer ticket"
                    : "Ticket audit log"}
              </h4>
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dialog === "merge" && (
              <>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                  Replies and tags move to the target ticket; this one
                  becomes a closed reference.
                </p>
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
                  Target ticket URL or UUID
                </label>
                <input
                  type="text"
                  value={mergeTargetRef}
                  onChange={(e) => setMergeTargetRef(e.target.value)}
                  className="w-full h-9 px-3 mb-3 text-sm border border-[var(--color-input-border)] rounded-lg"
                  placeholder="Paste from the other ticket's URL"
                />
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={mergeNote}
                  onChange={(e) => setMergeNote(e.target.value)}
                  maxLength={200}
                  className="w-full h-9 px-3 mb-4 text-sm border border-[var(--color-input-border)] rounded-lg"
                  placeholder="Visible in the merged thread"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 h-9 text-sm rounded-lg border border-[var(--color-border)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={doMerge}
                    disabled={merging}
                    className="px-4 h-9 text-sm bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {merging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Merge
                  </button>
                </div>
              </>
            )}

            {dialog === "transfer" && (
              <>
                <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                  Moves the ticket to a different category. Auto-assignment
                  re-runs by default.
                </p>
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
                  New category
                </label>
                <input
                  type="text"
                  value={transferCategory}
                  onChange={(e) => setTransferCategory(e.target.value)}
                  className="w-full h-9 px-3 mb-3 text-sm border border-[var(--color-input-border)] rounded-lg"
                  placeholder="e.g. technical"
                />
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  maxLength={200}
                  className="w-full h-9 px-3 mb-3 text-sm border border-[var(--color-input-border)] rounded-lg"
                  placeholder="Visible in the thread"
                />
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] mb-4">
                  <input
                    type="checkbox"
                    checked={transferReassign}
                    onChange={(e) => setTransferReassign(e.target.checked)}
                  />
                  Re-run auto-assignment for the new category
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="px-3 h-9 text-sm rounded-lg border border-[var(--color-border)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={doTransfer}
                    disabled={transferring}
                    className="px-4 h-9 text-sm bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {transferring && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    Transfer
                  </button>
                </div>
              </>
            )}

            {dialog === "audit" && (
              <>
                {auditLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                  </div>
                ) : !audit || audit.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
                    No audit events yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {audit.map((row) => (
                      <div
                        key={row.id}
                        className="p-2.5 rounded-lg border border-[var(--color-border-subtle)]"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-[var(--color-text-primary)] uppercase">
                            {row.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[var(--color-text-secondary)]">
                            {new Date(row.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                          {[row.performerFirstName, row.performerLastName]
                            .filter(Boolean)
                            .join(" ") ||
                            row.performerEmail ||
                            "(unknown)"}
                        </p>
                        {row.metadata && (
                          <pre className="mt-1 text-[10px] text-[var(--color-text-secondary)] whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
