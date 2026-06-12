"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  serviceStatusApi,
  type ServiceStatusComponent,
  type ServiceStatusComponentStatus,
  type ServiceStatusIncident,
  type ServiceStatusIncidentStatus,
} from "@/lib/api";

const COMPONENT_STATUSES: ServiceStatusComponentStatus[] = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
];

const INCIDENT_STATUSES: ServiceStatusIncidentStatus[] = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
];

const SEVERITIES = ["minor", "major", "critical"] as const;

export default function ServiceStatusTab() {
  const t = useTranslations("adminDashboard.settingsPage.serviceStatusTab");

  const [components, setComponents] = useState<ServiceStatusComponent[]>([]);
  const [incidents, setIncidents] = useState<ServiceStatusIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [componentDrafts, setComponentDrafts] = useState<
    Record<string, { status: ServiceStatusComponentStatus; messageEn: string; messageAr: string }>
  >({});
  const [savingComponentKey, setSavingComponentKey] = useState<string | null>(null);
  const [createIncidentOpen, setCreateIncidentOpen] = useState(false);
  const [postUpdateForIncident, setPostUpdateForIncident] = useState<string | null>(null);
  const [incidentFilter, setIncidentFilter] = useState<"active" | "resolved" | "all">("active");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [comps, incs] = await Promise.all([
        serviceStatusApi.listComponents(),
        serviceStatusApi.listIncidents(incidentFilter),
      ]);
      setComponents(comps);
      setIncidents(incs);
      const drafts: typeof componentDrafts = {};
      for (const c of comps) {
        drafts[c.key] = {
          status: c.currentStatus,
          messageEn: c.currentMessageEn ?? "",
          messageAr: c.currentMessageAr ?? "",
        };
      }
      setComponentDrafts(drafts);
    } catch {
      toast.error(t("toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentFilter]);

  const handleSaveComponent = async (key: string) => {
    const draft = componentDrafts[key];
    if (!draft) return;
    setSavingComponentKey(key);
    try {
      await serviceStatusApi.updateComponent(key, {
        currentStatus: draft.status,
        currentMessageEn: draft.messageEn || undefined,
        currentMessageAr: draft.messageAr || undefined,
      });
      toast.success(t("toasts.componentSaved"));
      await loadAll();
    } catch {
      toast.error(t("toasts.saveFailed"));
    } finally {
      setSavingComponentKey(null);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    if (!confirm(t("toasts.confirmDelete"))) return;
    try {
      await serviceStatusApi.deleteIncident(id);
      toast.success(t("toasts.incidentDeleted"));
      await loadAll();
    } catch {
      toast.error(t("toasts.deleteFailed"));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("intro.title")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {t("intro.body")}{" "}
              <a
                href="/en/status"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-primary)] underline"
              >
                /status
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Components */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {t("components.title")}
        </h3>
        <div className="space-y-3">
          {components.map((c) => {
            const draft = componentDrafts[c.key];
            const hasChanges =
              draft &&
              (draft.status !== c.currentStatus ||
                draft.messageEn !== (c.currentMessageEn ?? "") ||
                draft.messageAr !== (c.currentMessageAr ?? ""));
            return (
              <div
                key={c.key}
                className="border border-[var(--color-border)] rounded-lg p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {c.nameEn}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-secondary)] font-mono">
                      {c.key}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ComponentStatusPill status={c.currentStatus} t={t} />
                    {c.manualOverrideStatus && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        {t("components.pinned")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Auto-check meta row — shows the auto signal next
                    to the admin override, plus when we last checked.
                    For manual-only components we explain why
                    auto-detection isn't wired. */}
                <AutoCheckMeta
                  component={c}
                  onClearOverride={async () => {
                    try {
                      await serviceStatusApi.clearComponentOverride(c.key);
                      toast.success(t("toasts.overrideCleared"));
                      await loadAll();
                    } catch {
                      toast.error(t("toasts.saveFailed"));
                    }
                  }}
                  t={t}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                      {t("components.statusLabel")}
                    </label>
                    <select
                      value={draft?.status ?? c.currentStatus}
                      onChange={(e) =>
                        setComponentDrafts((prev) => ({
                          ...prev,
                          [c.key]: {
                            ...prev[c.key],
                            status: e.target.value as ServiceStatusComponentStatus,
                          },
                        }))
                      }
                      className="w-full h-9 px-2 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:outline-none focus:border-[var(--color-primary)]"
                    >
                      {COMPONENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`componentStatus.${s}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                      {t("components.messageEnLabel")}
                    </label>
                    <input
                      type="text"
                      value={draft?.messageEn ?? ""}
                      onChange={(e) =>
                        setComponentDrafts((prev) => ({
                          ...prev,
                          [c.key]: { ...prev[c.key], messageEn: e.target.value },
                        }))
                      }
                      maxLength={500}
                      placeholder={t("components.messagePlaceholder")}
                      className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                      {t("components.messageArLabel")}
                    </label>
                    <input
                      type="text"
                      value={draft?.messageAr ?? ""}
                      onChange={(e) =>
                        setComponentDrafts((prev) => ({
                          ...prev,
                          [c.key]: { ...prev[c.key], messageAr: e.target.value },
                        }))
                      }
                      maxLength={500}
                      dir="rtl"
                      placeholder={t("components.messagePlaceholder")}
                      className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>
                {hasChanges && (
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                      onClick={() =>
                        setComponentDrafts((prev) => ({
                          ...prev,
                          [c.key]: {
                            status: c.currentStatus,
                            messageEn: c.currentMessageEn ?? "",
                            messageAr: c.currentMessageAr ?? "",
                          },
                        }))
                      }
                      className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:underline"
                    >
                      {t("components.cancel")}
                    </button>
                    <button
                      onClick={() => handleSaveComponent(c.key)}
                      disabled={savingComponentKey === c.key}
                      className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      {savingComponentKey === c.key ? t("components.saving") : t("components.save")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Incidents */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("incidents.title")}
          </h3>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
              {(["active", "resolved", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setIncidentFilter(s)}
                  className={`px-2.5 py-1 text-[11px] font-medium ${incidentFilter === s ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"}`}
                >
                  {t(`incidents.filter.${s}`)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCreateIncidentOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90"
            >
              <Plus className="w-3 h-3" />
              {t("incidents.create")}
            </button>
          </div>
        </div>
        {incidents.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--color-text-secondary)] border border-dashed border-[var(--color-border)] rounded-lg">
            {incidentFilter === "active"
              ? t("incidents.emptyActive")
              : t("incidents.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => (
              <IncidentRow
                key={inc.id}
                incident={inc}
                onPostUpdate={() => setPostUpdateForIncident(inc.id)}
                onDelete={() => handleDeleteIncident(inc.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      {createIncidentOpen && (
        <CreateIncidentModal
          components={components}
          onClose={() => setCreateIncidentOpen(false)}
          onCreated={async () => {
            setCreateIncidentOpen(false);
            await loadAll();
          }}
          t={t}
        />
      )}

      {postUpdateForIncident && (
        <PostUpdateModal
          incidentId={postUpdateForIncident}
          onClose={() => setPostUpdateForIncident(null)}
          onPosted={async () => {
            setPostUpdateForIncident(null);
            await loadAll();
          }}
          t={t}
        />
      )}
    </div>
  );
}

function AutoCheckMeta({
  component: c,
  onClearOverride,
  t,
}: {
  component: ServiceStatusComponent;
  onClearOverride: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  // For manual-only components (e.g. Payment until a real gateway
  // is wired), explain why there's no auto signal. The cron skips
  // these — admin's last save IS the truth.
  if (c.checkType === 'manual') {
    return (
      <div className="text-[10px] text-[var(--color-text-secondary)] italic mb-3">
        {t("components.manualOnly")}
      </div>
    );
  }

  const lastChecked = c.autoCheckedAt
    ? formatTimeAgo(new Date(c.autoCheckedAt), t)
    : t("components.notYetChecked");
  const autoLabel = c.autoStatus
    ? t(`componentStatus.${c.autoStatus}`)
    : t("components.notYetChecked");

  return (
    <div className="flex items-center gap-2 flex-wrap mb-3 text-[10px] text-[var(--color-text-secondary)]">
      <span>
        {t("components.autoSays")}:{" "}
        <span className="font-medium text-[var(--color-text-primary)]">
          {autoLabel}
        </span>
      </span>
      <span>·</span>
      <span>
        {t("components.lastChecked")}: {lastChecked}
      </span>
      {c.autoError && (
        <>
          <span>·</span>
          <span className="text-[#DC2626]" title={c.autoError}>
            {t("components.lastCheckError")}
          </span>
        </>
      )}
      {c.manualOverrideStatus && (
        <>
          <span>·</span>
          <button
            type="button"
            onClick={onClearOverride}
            className="text-[var(--color-primary)] hover:underline font-medium"
          >
            {t("components.clearOverride")}
          </button>
        </>
      )}
    </div>
  );
}

function formatTimeAgo(
  date: Date,
  t: ReturnType<typeof useTranslations>,
): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t("components.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("components.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("components.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("components.daysAgo", { count: days });
}

function ComponentStatusPill({
  status,
  t,
}: {
  status: ServiceStatusComponentStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  const color = {
    operational: "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]",
    degraded: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
    partial_outage: "bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]",
    major_outage: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]",
    maintenance: "bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]",
  }[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${color}`}
    >
      {t(`componentStatus.${status}`)}
    </span>
  );
}

function IncidentRow({
  incident,
  onPostUpdate,
  onDelete,
  t,
}: {
  incident: ServiceStatusIncident;
  onPostUpdate: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div
      className={`border rounded-lg p-4 ${incident.resolvedAt ? "border-[var(--color-border)] bg-[var(--color-surface-page)]" : "border-[#FECACA] bg-[#FFFBFB]"}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            {incident.titleEn}
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded ${incident.severity === "critical" ? "bg-[#FEE2E2] text-[#991B1B]" : incident.severity === "major" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"}`}
            >
              {t(`severity.${incident.severity}`)}
            </span>
          </div>
          <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
            {incident.affectedComponents.join(" · ") || t("incidents.noComponents")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${incident.currentStatus === "resolved" ? "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]" : "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]"}`}
          >
            {t(`incidentStatus.${incident.currentStatus}`)}
          </span>
          {!incident.resolvedAt && (
            <button
              onClick={onPostUpdate}
              className="px-2 py-1 text-[11px] font-medium border border-[var(--color-primary)] text-[var(--color-primary)] rounded hover:bg-[var(--color-primary)] hover:text-white"
            >
              {t("incidents.postUpdate")}
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded"
            title={t("incidents.delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <ol className="space-y-2 mt-2 border-s border-[var(--color-border)] ps-3">
        {incident.updates.map((u) => (
          <li key={u.id} className="relative">
            <span className="absolute -start-[15px] top-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-primary)]">
                {t(`incidentStatus.${u.status}`)}
              </span>
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {new Date(u.postedAt).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-primary)] mt-0.5 whitespace-pre-line">{u.messageEn}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CreateIncidentModal({
  components,
  onClose,
  onCreated,
  t,
}: {
  components: ServiceStatusComponent[];
  onClose: () => void;
  onCreated: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [affected, setAffected] = useState<string[]>([]);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("minor");
  const [initialStatus, setInitialStatus] = useState<ServiceStatusIncidentStatus>("investigating");
  const [initialMessageEn, setInitialMessageEn] = useState("");
  const [initialMessageAr, setInitialMessageAr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!titleEn.trim() || !initialMessageEn.trim()) {
      toast.error(t("incidents.errors.required"));
      return;
    }
    setSaving(true);
    try {
      await serviceStatusApi.createIncident({
        titleEn: titleEn.trim(),
        titleAr: titleAr.trim() || undefined,
        affectedComponents: affected,
        severity,
        initialStatus,
        initialMessageEn: initialMessageEn.trim(),
        initialMessageAr: initialMessageAr.trim() || undefined,
      });
      toast.success(t("incidents.toasts.created"));
      onCreated();
    } catch {
      toast.error(t("incidents.toasts.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t("incidents.createTitle")} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t("incidents.fields.titleEn")} required>
            <input
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              maxLength={200}
              className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm"
            />
          </Field>
          <Field label={t("incidents.fields.titleAr")}>
            <input
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              maxLength={200}
              dir="rtl"
              className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm"
            />
          </Field>
        </div>

        <Field label={t("incidents.fields.affected")}>
          <div className="border border-[var(--color-border)] rounded-lg p-2 space-y-1">
            {components.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer">
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
                <span className="text-[var(--color-text-secondary)] font-mono">({c.key})</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t("incidents.fields.severity")}>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}
              className="w-full h-9 px-2 border border-[var(--color-border)] rounded-lg text-sm bg-white"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {t(`severity.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("incidents.fields.initialStatus")}>
            <select
              value={initialStatus}
              onChange={(e) => setInitialStatus(e.target.value as ServiceStatusIncidentStatus)}
              className="w-full h-9 px-2 border border-[var(--color-border)] rounded-lg text-sm bg-white"
            >
              {INCIDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`incidentStatus.${s}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t("incidents.fields.messageEn")} required>
          <textarea
            value={initialMessageEn}
            onChange={(e) => setInitialMessageEn(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
          />
        </Field>
        <Field label={t("incidents.fields.messageAr")}>
          <textarea
            value={initialMessageAr}
            onChange={(e) => setInitialMessageAr(e.target.value)}
            rows={3}
            maxLength={2000}
            dir="rtl"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:underline">
            {t("incidents.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("incidents.creating") : t("incidents.create")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function PostUpdateModal({
  incidentId,
  onClose,
  onPosted,
  t,
}: {
  incidentId: string;
  onClose: () => void;
  onPosted: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [status, setStatus] = useState<ServiceStatusIncidentStatus>("investigating");
  const [messageEn, setMessageEn] = useState("");
  const [messageAr, setMessageAr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!messageEn.trim()) {
      toast.error(t("incidents.errors.required"));
      return;
    }
    setSaving(true);
    try {
      await serviceStatusApi.postIncidentUpdate(incidentId, {
        status,
        messageEn: messageEn.trim(),
        messageAr: messageAr.trim() || undefined,
      });
      toast.success(t("incidents.toasts.updatePosted"));
      onPosted();
    } catch {
      toast.error(t("incidents.toasts.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={t("incidents.postUpdateTitle")} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t("incidents.fields.status")}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ServiceStatusIncidentStatus)}
            className="w-full h-9 px-2 border border-[var(--color-border)] rounded-lg text-sm bg-white"
          >
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`incidentStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("incidents.fields.messageEn")} required>
          <textarea
            value={messageEn}
            onChange={(e) => setMessageEn(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
          />
        </Field>
        <Field label={t("incidents.fields.messageAr")}>
          <textarea
            value={messageAr}
            onChange={(e) => setMessageAr(e.target.value)}
            rows={3}
            maxLength={2000}
            dir="rtl"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:underline">
            {t("incidents.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("incidents.posting") : t("incidents.post")}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
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
