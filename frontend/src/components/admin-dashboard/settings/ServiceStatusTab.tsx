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
  type IncidentAffectedRole,
  type IncidentReport,
  type LinkedTicketSummary,
  type ServiceStatusComponent,
  type ServiceStatusComponentStatus,
  type ServiceStatusIncident,
  type ServiceStatusIncidentStatus,
} from "@/lib/api";
import Select from "@/components/admin-dashboard/Select";
import StatusAnalyticsSection from "./StatusAnalyticsSection";

const AFFECTED_ROLE_OPTIONS: { value: IncidentAffectedRole; label: string }[] = [
  { value: "STUDENT", label: "Student" },
  { value: "INSTRUCTOR", label: "Instructor" },
  { value: "MANAGER", label: "Course Manager" },
  { value: "TEACHING_ASSISTANT", label: "Teaching Assistant" },
  { value: "FINANCE", label: "Finance" },
];

const COMPONENT_KEY_TO_DEFAULT_ROLES: Record<string, IncidentAffectedRole[]> = {
  zoom: ["STUDENT", "INSTRUCTOR", "MANAGER"],
  webinar: ["STUDENT", "INSTRUCTOR", "MANAGER"],
  payment: ["STUDENT", "FINANCE"],
  email: ["STUDENT", "INSTRUCTOR", "MANAGER", "TEACHING_ASSISTANT", "FINANCE"],
  otp: ["STUDENT", "INSTRUCTOR", "MANAGER", "TEACHING_ASSISTANT", "FINANCE"],
  sms: ["STUDENT", "INSTRUCTOR", "MANAGER", "TEACHING_ASSISTANT", "FINANCE"],
};

function suggestRolesFromComponents(
  componentKeys: string[],
): IncidentAffectedRole[] {
  const merged = new Set<IncidentAffectedRole>();
  for (const k of componentKeys) {
    const hit = COMPONENT_KEY_TO_DEFAULT_ROLES[k];
    if (hit) hit.forEach((r) => merged.add(r));
  }
  return Array.from(merged);
}

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
                    <Select
                      size="sm"
                      value={draft?.status ?? c.currentStatus}
                      onChange={(val) =>
                        setComponentDrafts((prev) => ({
                          ...prev,
                          [c.key]: {
                            ...prev[c.key],
                            status: val as ServiceStatusComponentStatus,
                          },
                        }))
                      }
                      options={COMPONENT_STATUSES.map((s) => ({
                        value: s,
                        label: t(`componentStatus.${s}`),
                      }))}
                    />
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

      {/* Analytics — view counts, trend, top components, export. */}
      <StatusAnalyticsSection />

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
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <div
      className={`border rounded-lg p-4 ${incident.resolvedAt ? "border-[var(--color-border)] bg-[var(--color-surface-page)]" : "border-[#FECACA] bg-[#FFFBFB]"}`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 flex-wrap">
            {incident.titleEn}
            <span
              className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded ${incident.severity === "critical" ? "bg-[#FEE2E2] text-[#991B1B]" : incident.severity === "major" ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"}`}
            >
              {t(`severity.${incident.severity}`)}
            </span>
            {incident.audience === "end_users" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded bg-[#FFE4E6] text-[#9F1239]">
                End users
              </span>
            )}
            {typeof incident.linkedTicketsCount === "number" &&
              incident.linkedTicketsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  {incident.linkedTicketsCount} ticket{incident.linkedTicketsCount === 1 ? "" : "s"}
                </span>
              )}
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
            onClick={() => setReportOpen((v) => !v)}
            className="px-2 py-1 text-[11px] font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          >
            {reportOpen ? "Hide report" : "Report"}
          </button>
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
      <IncidentReportPanel
        incidentId={incident.id}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
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
  const [audience, setAudience] = useState<"internal" | "end_users">("internal");
  const [affectedRoles, setAffectedRoles] = useState<IncidentAffectedRole[]>([]);
  // Tracks whether the admin manually edited affected roles. Until
  // they do, we re-seed defaults whenever the component selection
  // changes — so picking "Zoom" auto-populates the right banner roles.
  const [rolesTouched, setRolesTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-suggest affected roles from component picks until the
  // admin overrides them. Resets if affected components clear.
  useEffect(() => {
    if (rolesTouched) return;
    if (audience !== "end_users") return;
    setAffectedRoles(suggestRolesFromComponents(affected));
  }, [affected, audience, rolesTouched]);

  const handleSubmit = async () => {
    if (!titleEn.trim() || !initialMessageEn.trim()) {
      toast.error(t("incidents.errors.required"));
      return;
    }
    if (audience === "end_users" && affectedRoles.length === 0) {
      toast.error(
        "Pick at least one affected role for an end-user incident",
      );
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
        audience,
        affectedRoles: audience === "end_users" ? affectedRoles : [],
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
            <Select
              size="sm"
              value={severity}
              onChange={(val) => setSeverity(val as (typeof SEVERITIES)[number])}
              options={SEVERITIES.map((s) => ({
                value: s,
                label: t(`severity.${s}`),
              }))}
            />
          </Field>
          <Field label={t("incidents.fields.initialStatus")}>
            <Select
              size="sm"
              value={initialStatus}
              onChange={(val) => setInitialStatus(val as ServiceStatusIncidentStatus)}
              options={INCIDENT_STATUSES.map((s) => ({
                value: s,
                label: t(`incidentStatus.${s}`),
              }))}
            />
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

        {/* Audience + affected roles. Internal stays inside admin/
            support; end-user fires the cross-dashboard banner +
            email + in-app fan-out. Roles auto-suggest from the
            component picks above until the admin overrides. */}
        <div className="border-t border-[var(--color-border)] pt-3 space-y-3">
          <Field label="Audience">
            <Select
              size="sm"
              value={audience}
              onChange={(v) => setAudience(v as "internal" | "end_users")}
              options={[
                {
                  value: "internal",
                  label: "Internal only (ops / dev)",
                },
                {
                  value: "end_users",
                  label: "End users (banner + email + in-app)",
                },
              ]}
            />
          </Field>
          {audience === "end_users" && (
            <Field label="Affected dashboards">
              <div className="border border-[var(--color-border)] rounded-lg p-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                {AFFECTED_ROLE_OPTIONS.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={affectedRoles.includes(r.value)}
                      onChange={() => {
                        setRolesTouched(true);
                        setAffectedRoles((prev) =>
                          prev.includes(r.value)
                            ? prev.filter((p) => p !== r.value)
                            : [...prev, r.value],
                        );
                      }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                Admin + Support never receive end-user banners; they're managing the incident.
              </p>
            </Field>
          )}
        </div>

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
  const [strategy, setStrategy] = useState<
    "soft_resolve" | "auto_close" | "leave_open"
  >("soft_resolve");
  const [linkedCount, setLinkedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  // Resolution flow shows a strategy picker — only meaningful when
  // there are linked tickets, so we fetch the count once.
  useEffect(() => {
    serviceStatusApi
      .listTicketsForIncident(incidentId)
      .then((rows) => setLinkedCount(rows.length))
      .catch(() => setLinkedCount(0));
  }, [incidentId]);

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
        linkedResolutionStrategy:
          status === "resolved" && linkedCount > 0 ? strategy : undefined,
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
          <Select
            size="sm"
            value={status}
            onChange={(val) => setStatus(val as ServiceStatusIncidentStatus)}
            options={INCIDENT_STATUSES.map((s) => ({
              value: s,
              label: t(`incidentStatus.${s}`),
            }))}
          />
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

        {status === "resolved" && linkedCount > 0 && (
          <div className="border border-[#FCA5A5] bg-[#FEF2F2] rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
              <span className="text-xs font-semibold text-[#991B1B]">
                {linkedCount} linked ticket{linkedCount === 1 ? "" : "s"} — what should happen?
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                {
                  v: "soft_resolve" as const,
                  label: "Soft-resolve (recommended)",
                  hint: "Post the resolution message + transition each linked ticket to On Hold so the agent has a checkpoint with the user.",
                },
                {
                  v: "auto_close" as const,
                  label: "Auto-close immediately",
                  hint: "Post the resolution message + close each linked ticket. Use only when there's nothing to confirm.",
                },
                {
                  v: "leave_open" as const,
                  label: "Leave open",
                  hint: "Post the resolution message only. Each agent closes their ticket manually.",
                },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className="flex items-start gap-2 p-2 rounded border border-transparent hover:border-[#FCA5A5] cursor-pointer"
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === opt.v}
                    onChange={() => setStrategy(opt.v)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-xs font-medium text-[#991B1B]">
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-[#B91C1C] mt-0.5 leading-snug">
                      {opt.hint}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

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

/**
 * Inline post-mortem panel: shows linked tickets, unique affected
 * users count, and lets the admin edit root cause + corrective
 * actions on a resolved incident. Mounted under each IncidentRow
 * as a collapsible section.
 */
function IncidentReportPanel({
  incidentId,
  open,
  onClose,
}: {
  incidentId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [rootCause, setRootCause] = useState("");
  const [correctiveActions, setCorrectiveActions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    serviceStatusApi
      .getIncidentReport(incidentId)
      .then((r) => {
        setReport(r);
        setRootCause(r.incident.rootCause ?? "");
        setCorrectiveActions(r.incident.correctiveActions ?? "");
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [incidentId, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await serviceStatusApi.updateIncidentReport(incidentId, {
        rootCause: rootCause.trim() || undefined,
        correctiveActions: correctiveActions.trim() || undefined,
      });
      toast.success("Report saved");
    } catch {
      toast.error("Could not save report");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  if (loading) {
    return (
      <div className="mt-2 border-t border-[var(--color-border)] pt-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading report…
      </div>
    );
  }
  if (!report) {
    return (
      <div className="mt-2 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-secondary)]">
        Couldn't load report.{" "}
        <button onClick={onClose} className="text-[var(--color-primary)] hover:underline">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Linked tickets" value={report.linkedTickets.length} />
        <Stat label="Affected users" value={report.affectedUsersCount} />
        <Stat
          label="Started"
          value={new Date(report.incident.startedAt).toLocaleDateString()}
        />
        <Stat
          label="Resolved"
          value={
            report.incident.resolvedAt
              ? new Date(report.incident.resolvedAt).toLocaleDateString()
              : "—"
          }
        />
      </div>

      {report.linkedTickets.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1.5">
            Linked tickets
          </p>
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden divide-y divide-[var(--color-border-subtle)] max-h-48 overflow-y-auto">
            {report.linkedTickets.map((t) => (
              <LinkedTicketRow key={t.ticketId} t={t} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Root cause">
          <textarea
            value={rootCause}
            onChange={(e) => setRootCause(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="What caused this?"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
          />
        </Field>
        <Field label="Corrective actions">
          <textarea
            value={correctiveActions}
            onChange={(e) => setCorrectiveActions(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="What's being done so it doesn't happen again?"
            className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:underline"
        >
          Close
        </button>
        <button
          onClick={() => exportIncidentReportPdf(report)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          Export PDF
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save report"}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--color-border)] rounded-lg p-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
        {value}
      </p>
    </div>
  );
}

function LinkedTicketRow({ t }: { t: LinkedTicketSummary }) {
  const name =
    [t.studentFirstName, t.studentLastName].filter(Boolean).join(" ") ||
    "—";
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
      <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">
        {t.referenceNumber}
      </span>
      <span className="text-[var(--color-text-primary)] flex-1 truncate">
        {t.subject}
      </span>
      <span className="text-[10px] text-[var(--color-text-secondary)]">
        {name}
      </span>
      <span className="text-[10px] uppercase font-semibold text-[var(--color-primary)]">
        {t.status}
      </span>
    </div>
  );
}

/**
 * Quick-and-dirty PDF export — opens a printable HTML view in a new
 * tab and triggers the browser's print-to-PDF. Avoids a server
 * round-trip for what is essentially an admin convenience.
 */
function exportIncidentReportPdf(report: IncidentReport) {
  const i = report.incident;
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Allow pop-ups to export PDF");
    return;
  }
  const linkedRows = report.linkedTickets
    .map((t) => {
      const name =
        [t.studentFirstName, t.studentLastName].filter(Boolean).join(" ") ||
        "—";
      return `<tr><td>${t.referenceNumber}</td><td>${escapeHtml(
        t.subject,
      )}</td><td>${escapeHtml(name)}</td><td>${t.status}</td></tr>`;
    })
    .join("");
  const updatesRows = report.updates
    .map(
      (u) =>
        `<li><strong>${u.status}</strong> · ${new Date(
          u.postedAt,
        ).toLocaleString()}<br/>${escapeHtml(u.messageEn)}</li>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Incident report — ${escapeHtml(
    i.titleEn,
  )}</title>
<style>body{font-family:'DM Sans',Arial,sans-serif;color:#1a1a1a;padding:32px;line-height:1.5;}h1{margin:0 0 4px;font-size:22px;}h2{font-size:14px;margin-top:24px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;}td,th{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;}.meta div{border:1px solid #e5e7eb;border-radius:8px;padding:8px;}.label{font-size:10px;text-transform:uppercase;color:#6b7280;}.val{font-weight:600;}</style></head>
<body>
<h1>Incident report</h1>
<p style="color:#6b7280;margin:0;">${escapeHtml(i.titleEn)}</p>
<div class="meta">
<div><div class="label">Severity</div><div class="val">${i.severity}</div></div>
<div><div class="label">Linked tickets</div><div class="val">${report.linkedTickets.length}</div></div>
<div><div class="label">Affected users</div><div class="val">${report.affectedUsersCount}</div></div>
<div><div class="label">Started</div><div class="val">${new Date(i.startedAt).toLocaleString()}</div></div>
<div><div class="label">Resolved</div><div class="val">${i.resolvedAt ? new Date(i.resolvedAt).toLocaleString() : "—"}</div></div>
<div><div class="label">Audience</div><div class="val">${i.audience ?? "internal"}</div></div>
<div><div class="label">Affected roles</div><div class="val">${(i.affectedRoles ?? []).join(", ") || "—"}</div></div>
<div><div class="label">Status</div><div class="val">${i.currentStatus}</div></div>
</div>
<h2>Root cause</h2>
<p>${escapeHtml(i.rootCause ?? "—")}</p>
<h2>Corrective actions</h2>
<p>${escapeHtml(i.correctiveActions ?? "—")}</p>
<h2>Timeline</h2>
<ol>${updatesRows}</ol>
<h2>Linked tickets (${report.linkedTickets.length})</h2>
<table><thead><tr><th>Ref</th><th>Subject</th><th>Requester</th><th>Status</th></tr></thead><tbody>${linkedRows || '<tr><td colspan="4" style="text-align:center;color:#6b7280;">No linked tickets</td></tr>'}</tbody></table>
<script>window.onload=()=>setTimeout(()=>window.print(),200);</script>
</body></html>`;
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
