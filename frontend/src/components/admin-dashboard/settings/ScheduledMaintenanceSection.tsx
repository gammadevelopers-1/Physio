"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  scheduledMaintenanceApi,
  serviceStatusApi,
  type ScheduledMaintenanceWindow,
  type ServiceStatusComponent,
} from "@/lib/api";
import Select from "@/components/admin-dashboard/Select";
import DateTimePicker from "@/components/ui/DateTimePicker";

/**
 * Admin-side editor for scheduled maintenance windows. Mounts under
 * the Maintenance tab as a separate section so the manual toggle and
 * the schedule flow stay visually distinct.
 *
 * Cron handles activation + deactivation + pre-notifications. This UI
 * is just CRUD over the window rows.
 */

function fmt(ts: string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function statusChipClass(s: ScheduledMaintenanceWindow["status"]) {
  switch (s) {
    case "active":
      return "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]";
    case "scheduled":
      return "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]";
    case "completed":
      return "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]";
    case "cancelled":
    default:
      return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)]";
  }
}

/**
 * Convert an ISO timestamp (server format) to the "YYYY-MM-DDTHH:mm"
 * shape DateTimePicker expects (datetime-local equivalent). Uses
 * LOCAL time so the user sees the time they originally entered, not
 * the UTC translation.
 */
function isoToDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Now in "YYYY-MM-DDTHH:mm" local format — used as the `min` on the
 * pickers so the calendar can't go to past months and the user
 * can't pick yesterday.
 */
function nowAsDateTimeLocal(): string {
  return isoToDateTimeLocal(new Date().toISOString());
}

export default function ScheduledMaintenanceSection() {
  const [windows, setWindows] = useState<ScheduledMaintenanceWindow[]>([]);
  const [components, setComponents] = useState<ServiceStatusComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<
    | { kind: "closed" }
    | { kind: "create" }
    | { kind: "edit"; window: ScheduledMaintenanceWindow }
  >({ kind: "closed" });
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [w, c] = await Promise.all([
        scheduledMaintenanceApi.list(),
        serviceStatusApi.listComponents().catch(() => []),
      ]);
      setWindows(w);
      setComponents(c);
    } catch {
      toast.error("Couldn't load scheduled maintenance windows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await scheduledMaintenanceApi.cancel(id);
      toast.success("Window cancelled");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not cancel");
    } finally {
      setCancellingId(null);
    }
  };

  // Split for nicer rendering: upcoming/active up top, then history.
  const upcoming = windows.filter(
    (w) => w.status === "scheduled" || w.status === "active",
  );
  const past = windows.filter(
    (w) => w.status === "completed" || w.status === "cancelled",
  );

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[#92400E]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Scheduled maintenance windows
            </h3>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Plan a maintenance window. The platform flips into
              maintenance mode automatically and users get a heads-up.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalMode({ kind: "create" })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90"
        >
          <Plus className="w-3 h-3" />
          Schedule window
        </button>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading…
          </div>
        ) : windows.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[var(--color-border)] rounded-lg">
            <Calendar className="w-7 h-7 mx-auto text-[var(--color-text-secondary)]/30 mb-2" />
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              No scheduled windows
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Create one above to plan a maintenance period in advance.
            </p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)]">
                  Upcoming + Active
                </p>
                {upcoming.map((w) => (
                  <WindowRow
                    key={w.id}
                    window={w}
                    onEdit={() => setModalMode({ kind: "edit", window: w })}
                    onCancel={() => handleCancel(w.id)}
                    cancelling={cancellingId === w.id}
                  />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] pt-2 border-t border-[var(--color-border-subtle)]">
                  History
                </p>
                {past.slice(0, 10).map((w) => (
                  <WindowRow key={w.id} window={w} compact />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modalMode.kind !== "closed" && (
        <UpsertWindowModal
          mode={modalMode.kind}
          existing={modalMode.kind === "edit" ? modalMode.window : undefined}
          components={components}
          onClose={() => setModalMode({ kind: "closed" })}
          onSaved={async () => {
            setModalMode({ kind: "closed" });
            await load();
          }}
        />
      )}
    </div>
  );
}

function WindowRow({
  window: w,
  onEdit,
  onCancel,
  cancelling,
  compact,
}: {
  window: ScheduledMaintenanceWindow;
  onEdit?: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {w.titleEn}
            </p>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded border ${statusChipClass(w.status)}`}
            >
              {w.status}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] mt-1">
            <Clock className="w-3 h-3" />
            <span>
              {fmt(w.startAt)} → {fmt(w.endAt)}
            </span>
          </div>
          {!compact && w.descriptionEn && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
              {w.descriptionEn}
            </p>
          )}
          {!compact && w.affectedComponents.length > 0 && (
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              <span className="font-semibold uppercase">Affected:</span>{" "}
              {w.affectedComponents.join(" · ")}
            </p>
          )}
          {!compact &&
            w.status === "scheduled" &&
            w.preNotificationLeadMinutes > 0 && (
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 flex items-center gap-1">
                {w.preNotificationSentAt ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                    Heads-up sent {fmt(w.preNotificationSentAt)}
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3" />
                    Heads-up scheduled {w.preNotificationLeadMinutes} min before
                    start
                  </>
                )}
              </p>
            )}
        </div>
        {w.status === "scheduled" && (onEdit || onCancel) && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded hover:border-[#DC2626] hover:text-[#DC2626] disabled:opacity-50"
              >
                {cancelling ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UpsertWindowModal({
  mode,
  existing,
  components,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  existing?: ScheduledMaintenanceWindow;
  components: ServiceStatusComponent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [titleEn, setTitleEn] = useState(existing?.titleEn ?? "");
  const [titleAr, setTitleAr] = useState(existing?.titleAr ?? "");
  const [descriptionEn, setDescriptionEn] = useState(
    existing?.descriptionEn ?? "",
  );
  const [descriptionAr, setDescriptionAr] = useState(
    existing?.descriptionAr ?? "",
  );
  const [affected, setAffected] = useState<string[]>(
    existing?.affectedComponents ?? [],
  );
  const [startAt, setStartAt] = useState(
    existing ? isoToDateTimeLocal(existing.startAt) : "",
  );
  const [endAt, setEndAt] = useState(
    existing ? isoToDateTimeLocal(existing.endAt) : "",
  );
  const [leadMinutes, setLeadMinutes] = useState<number>(
    existing?.preNotificationLeadMinutes ?? 60,
  );
  const [saving, setSaving] = useState(false);

  // Past-date guard. Recomputed on every render so it stays accurate
  // while the user is still on the modal. Datetime-local has minute
  // resolution, so accept anything >= the start of the current minute.
  const minDateTime = useMemo(() => nowAsDateTimeLocal(), []);

  // Reactive validation messages so the submit button can be
  // visually disabled before the user clicks.
  const validationError = useMemo<string | null>(() => {
    if (!titleEn.trim()) return "Title (EN) is required";
    if (!startAt) return "Start date/time is required";
    if (!endAt) return "End date/time is required";
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    if (Number.isNaN(startDate.getTime())) return "Invalid start date";
    if (Number.isNaN(endDate.getTime())) return "Invalid end date";
    if (endDate <= startDate) return "End must be after start";
    // For new windows: start must be in the future. For edits we
    // allow keeping a start that was already in the past — server
    // rejects edits to non-scheduled windows anyway.
    if (mode === "create" && startDate <= new Date()) {
      return "Start must be in the future — can't schedule a window in the past";
    }
    return null;
  }, [titleEn, startAt, endAt, mode]);

  const handleSubmit = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        titleEn: titleEn.trim(),
        titleAr: titleAr.trim() || undefined,
        descriptionEn: descriptionEn.trim() || undefined,
        descriptionAr: descriptionAr.trim() || undefined,
        affectedComponents: affected,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        preNotificationLeadMinutes: leadMinutes,
      };
      if (mode === "edit" && existing) {
        await scheduledMaintenanceApi.update(existing.id, payload);
        toast.success("Window updated");
      } else {
        await scheduledMaintenanceApi.create(payload);
        toast.success("Maintenance window scheduled");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {mode === "edit"
              ? "Edit scheduled window"
              : "Schedule maintenance window"}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title (EN)" required>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                maxLength={200}
                placeholder="e.g. Q3 platform deploy"
                className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm"
              />
            </Field>
            <Field label="Title (AR)">
              <input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                maxLength={200}
                dir="rtl"
                className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Description (EN)">
              <textarea
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="What's happening, what to expect…"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
              />
            </Field>
            <Field label="Description (AR)">
              <textarea
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                rows={3}
                maxLength={2000}
                dir="rtl"
                className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Start" required>
              <DateTimePicker
                value={startAt}
                onChange={setStartAt}
                min={mode === "create" ? minDateTime : undefined}
              />
            </Field>
            <Field label="End" required>
              <DateTimePicker
                value={endAt}
                onChange={setEndAt}
                min={startAt || minDateTime}
              />
            </Field>
          </div>

          <Field label="Affected services / components">
            <div className="border border-[var(--color-border)] rounded-lg p-2 grid grid-cols-1 md:grid-cols-2 gap-1 max-h-40 overflow-y-auto">
              {components.length === 0 && (
                <p className="text-xs text-[var(--color-text-secondary)] col-span-2 py-2 text-center">
                  No service components configured yet.
                </p>
              )}
              {components.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={affected.includes(c.key)}
                    onChange={() =>
                      setAffected((prev) =>
                        prev.includes(c.key)
                          ? prev.filter((k) => k !== c.key)
                          : [...prev, c.key],
                      )
                    }
                  />
                  {c.nameEn}
                  <span className="text-[var(--color-text-secondary)] font-mono text-[10px]">
                    ({c.key})
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Notify users before maintenance">
            <Select
              size="sm"
              value={String(leadMinutes)}
              onChange={(v) => setLeadMinutes(Number(v))}
              options={[
                { value: "0", label: "No pre-notification" },
                { value: "15", label: "15 minutes before" },
                { value: "30", label: "30 minutes before" },
                { value: "60", label: "1 hour before" },
                { value: "180", label: "3 hours before" },
                { value: "1440", label: "1 day before" },
                { value: "4320", label: "3 days before" },
                { value: "10080", label: "1 week before" },
              ]}
            />
            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
              Sends a banner + in-app notification + email to affected users.
            </p>
          </Field>

          {validationError && (
            <div className="border border-[#FCA5A5] bg-[#FEF2F2] rounded-lg px-3 py-2 text-xs text-[#991B1B]">
              {validationError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:underline"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !!validationError}
              className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? mode === "edit"
                  ? "Saving…"
                  : "Scheduling…"
                : mode === "edit"
                  ? "Save changes"
                  : "Schedule window"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
        {label}
        {required && <span className="text-[#DC2626] ms-1">*</span>}
      </label>
      {children}
    </div>
  );
}
