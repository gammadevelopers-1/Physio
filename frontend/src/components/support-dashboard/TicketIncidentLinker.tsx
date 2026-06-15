"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  Plus,
  Unlink,
  X,
} from "lucide-react";
import {
  serviceStatusApi,
  type ActiveIncidentForLink,
  type IncidentForTicket,
} from "@/lib/api";
import Select from "@/components/admin-dashboard/Select";

/**
 * Right-rail widget on the support ticket detail. Shows incidents
 * already linked to this ticket and gives the agent a picker to link
 * to an active incident — so when the admin resolves it, this ticket
 * gets a system reply (and optionally auto-closes) per the strategy
 * the admin chose at resolve time.
 *
 * Only visible to support/admin viewers (gated by the parent).
 */
interface Props {
  ticketId: string;
}

function severityChip(sev: "minor" | "major" | "critical") {
  const map: Record<string, { bg: string; text: string }> = {
    critical: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
    major: { bg: "bg-[#FFFBEB]", text: "text-[#92400E]" },
    minor: { bg: "bg-[#EFF6FF]", text: "text-[#1E3A8A]" },
  };
  const p = map[sev] ?? map.minor;
  return (
    <span
      className={`text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${p.bg} ${p.text}`}
    >
      {sev}
    </span>
  );
}

export default function TicketIncidentLinker({ ticketId }: Props) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [linked, setLinked] = useState<IncidentForTicket[]>([]);
  const [active, setActive] = useState<ActiveIncidentForLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedId, setPickedId] = useState("");
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [linkedList, activeList] = await Promise.all([
        serviceStatusApi.listIncidentsForTicket(ticketId),
        serviceStatusApi.listActiveForLink(),
      ]);
      setLinked(linkedList);
      setActive(activeList);
    } catch {
      // Silent — failing to load shouldn't break the rest of the rail.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [ticketId]);

  const linkableActive = active.filter(
    (a) => !linked.some((l) => l.incidentId === a.id),
  );

  const handleLink = async () => {
    if (!pickedId) return;
    setAdding(true);
    try {
      await serviceStatusApi.linkTicketToIncident(pickedId, ticketId);
      toast.success(isAr ? "تم ربط التذكرة" : "Ticket linked to incident");
      setPickerOpen(false);
      setPickedId("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "تعذر الربط" : "Could not link"));
    } finally {
      setAdding(false);
    }
  };

  const handleUnlink = async (incidentId: string) => {
    setUnlinkingId(incidentId);
    try {
      await serviceStatusApi.unlinkTicketFromIncident(incidentId, ticketId);
      toast.success(isAr ? "تم إلغاء الربط" : "Unlinked");
      await load();
    } catch (e: any) {
      toast.error(e?.message || (isAr ? "تعذر الإلغاء" : "Could not unlink"));
    } finally {
      setUnlinkingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {isAr ? "جارٍ التحميل…" : "Loading incidents…"}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <Link2 className="w-4 h-4 text-[var(--color-primary)]" />
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {isAr ? "الحوادث المرتبطة" : "Linked incidents"}
        </span>
        {linked.length > 0 && (
          <span className="text-[10px] text-[var(--color-text-secondary)] ms-auto">
            {linked.length}
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        {linked.length === 0 && !pickerOpen && (
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
            {isAr
              ? "لا توجد حوادث مرتبطة. اربط هذه التذكرة بحادث نشط لإعلام صاحبها تلقائياً عند الحل."
              : "No linked incidents. Link this ticket to an active incident so the requester is notified automatically on resolution."}
          </p>
        )}

        {linked.map((inc) => (
          <div
            key={inc.incidentId}
            className="border border-[var(--color-border-subtle)] rounded-lg p-2.5 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {severityChip(inc.severity)}
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                    {inc.currentStatus.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs font-medium text-[var(--color-text-primary)] line-clamp-2">
                  {isAr && inc.titleAr ? inc.titleAr : inc.titleEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleUnlink(inc.incidentId)}
                disabled={unlinkingId === inc.incidentId}
                className="flex-shrink-0 w-6 h-6 rounded hover:bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] disabled:opacity-50"
                aria-label="Unlink"
              >
                {unlinkingId === inc.incidentId ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Unlink className="w-3 h-3" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
              {inc.resolvedAt ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                  {isAr ? "تم الحل" : "Resolved"}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-[#D97706]" />
                  {isAr ? "نشط" : "Active"}
                </>
              )}
            </div>
          </div>
        ))}

        {pickerOpen ? (
          <div className="border border-[var(--color-border-subtle)] rounded-lg p-2.5 space-y-2 bg-[var(--color-surface-page)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)]">
                {isAr ? "اختر حادثاً نشطاً" : "Pick active incident"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setPickedId("");
                }}
                className="w-5 h-5 rounded hover:bg-white flex items-center justify-center text-[var(--color-text-secondary)]"
                aria-label="Close picker"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {linkableActive.length === 0 ? (
              <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                {isAr
                  ? "لا توجد حوادث نشطة متاحة للربط."
                  : "No active incidents available to link."}
              </p>
            ) : (
              <>
                <Select
                  size="sm"
                  value={pickedId}
                  onChange={(v) => setPickedId(v)}
                  placeholder={isAr ? "اختر…" : "Select…"}
                  options={linkableActive.map((a) => ({
                    value: a.id,
                    label: `${(isAr && a.titleAr ? a.titleAr : a.titleEn)} · ${a.severity}`,
                  }))}
                />
                <button
                  type="button"
                  onClick={handleLink}
                  disabled={!pickedId || adding}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {adding ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Link2 className="w-3 h-3" />
                  )}
                  {isAr ? "ربط" : "Link"}
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] text-[var(--color-text-secondary)] transition-colors"
          >
            <Plus className="w-3 h-3" />
            {isAr ? "ربط بحادث نشط" : "Link to active incident"}
          </button>
        )}
      </div>
    </div>
  );
}
