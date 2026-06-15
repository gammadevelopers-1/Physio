import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Wrench,
  History,
  Clock,
} from "lucide-react";
import StatusPageViewTracker from "./StatusPageViewTracker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

// Always server-render with fresh data — the whole point of this
// page is to reflect reality at this moment. CDN caching defeats
// the purpose.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ComponentStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

type Component = {
  key: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  currentStatus: ComponentStatus;
  currentMessageEn: string | null;
  currentMessageAr: string | null;
  updatedAt: string;
  checkType?: 'manual' | 'internal_db' | 'statuspage';
  autoCheckedAt?: string | null;
  isManualOverride?: boolean;
};

type IncidentUpdate = {
  id: string;
  status: IncidentStatus;
  messageEn: string;
  messageAr: string | null;
  postedAt: string;
};

type Incident = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  affectedComponents: string[];
  currentStatus: IncidentStatus;
  severity: "minor" | "major" | "critical";
  startedAt: string;
  resolvedAt: string | null;
  updates: IncidentUpdate[];
};

type StatusPayload = {
  overallStatus: "operational" | "degraded" | "down" | "maintenance";
  components: Component[];
  activeIncidents: Incident[];
  recentResolvedIncidents: Incident[];
  generatedAt: string;
};

async function fetchStatus(): Promise<StatusPayload | null> {
  try {
    const res = await fetch(`${API_URL}/public/service-status`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as StatusPayload;
  } catch {
    return null;
  }
}

type PublicSummary = {
  windowDays: number;
  incidentCount: number;
  avgResolutionMinutes: number;
};

async function fetchSummary(): Promise<PublicSummary | null> {
  try {
    const res = await fetch(`${API_URL}/public/service-status/summary`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicSummary;
  } catch {
    return null;
  }
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("statusPage");
  const isRTL = locale === "ar";

  const [data, summary] = await Promise.all([fetchStatus(), fetchSummary()]);

  if (!data) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--color-surface-page)]"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-[#DC2626] mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            {t("loadError.title")}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("loadError.body")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--color-surface-page)] py-10 px-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-3xl mx-auto">
        {/* Overall status banner */}
        <OverallStatusBanner status={data.overallStatus} t={t} />

        {/* Components */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
            {t("componentsHeading")}
          </h2>
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {data.components.map((c) => (
              <ComponentRow key={c.key} component={c} locale={locale} t={t} />
            ))}
          </div>
        </section>

        {/* Active incidents */}
        {data.activeIncidents.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#DC2626] mb-3">
              {t("activeIncidentsHeading")}
            </h2>
            <div className="space-y-4">
              {data.activeIncidents.map((i) => (
                <IncidentCard key={i.id} incident={i} locale={locale} t={t} />
              ))}
            </div>
          </section>
        )}

        {/* Recent resolved incidents */}
        {data.recentResolvedIncidents.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
              {t("recentResolvedHeading")}
            </h2>
            <div className="space-y-3">
              {data.recentResolvedIncidents.map((i) => (
                <IncidentCard key={i.id} incident={i} locale={locale} t={t} compact />
              ))}
            </div>
          </section>
        )}

        {/* Public transparency stats */}
        {summary && summary.incidentCount > 0 && (
          <div className="mt-10 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 flex items-center justify-around gap-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                {isRTL ? `آخر ${summary.windowDays} يوم` : `Last ${summary.windowDays} days`}
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5">
                {summary.incidentCount}
              </p>
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                {isRTL ? "حوادث" : summary.incidentCount === 1 ? "incident" : "incidents"}
              </p>
            </div>
            <div className="h-10 w-px bg-[var(--color-border)]" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] flex items-center justify-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {isRTL ? "متوسط وقت الحل" : "Avg resolution time"}
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5">
                {fmtMinutes(summary.avgResolutionMinutes, isRTL)}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href={`/${locale}/status/history`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            <History className="w-3.5 h-3.5" />
            {locale === "ar" ? "عرض الأرشيف الكامل" : "View full history"}
          </Link>
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            {t("generatedAt", { time: new Date(data.generatedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US") })}
          </p>
        </div>

        {/* Fire-and-forget view tracker (cookie-deduped server-side) */}
        <StatusPageViewTracker />
      </div>
    </div>
  );
}

function fmtMinutes(min: number, isAr: boolean): string {
  if (min < 1) return isAr ? "< 1 دقيقة" : "< 1 min";
  if (min < 60) return isAr ? `${min} دقيقة` : `${min} min`;
  const hours = min / 60;
  if (hours < 24)
    return isAr ? `${hours.toFixed(1)} ساعة` : `${hours.toFixed(1)} h`;
  const days = hours / 24;
  return isAr ? `${days.toFixed(1)} يوم` : `${days.toFixed(1)} d`;
}

function OverallStatusBanner({
  status,
  t,
}: {
  status: "operational" | "degraded" | "down" | "maintenance";
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const meta = {
    operational: {
      icon: CheckCircle2,
      bg: "bg-[#DCFCE7]",
      border: "border-[#86EFAC]",
      text: "text-[#166534]",
      iconColor: "text-[#16A34A]",
      title: t("overall.operational.title"),
      body: t("overall.operational.body"),
    },
    degraded: {
      icon: AlertTriangle,
      bg: "bg-[#FEF3C7]",
      border: "border-[#FDE68A]",
      text: "text-[#92400E]",
      iconColor: "text-[#D97706]",
      title: t("overall.degraded.title"),
      body: t("overall.degraded.body"),
    },
    down: {
      icon: AlertCircle,
      bg: "bg-[#FEE2E2]",
      border: "border-[#FECACA]",
      text: "text-[#991B1B]",
      iconColor: "text-[#DC2626]",
      title: t("overall.down.title"),
      body: t("overall.down.body"),
    },
    maintenance: {
      icon: Wrench,
      bg: "bg-[#DBEAFE]",
      border: "border-[#BFDBFE]",
      text: "text-[#1E40AF]",
      iconColor: "text-[#2563EB]",
      title: t("overall.maintenance.title"),
      body: t("overall.maintenance.body"),
    },
  }[status];

  const Icon = meta.icon;

  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border ${meta.border} ${meta.bg} p-5`}
    >
      <Icon className={`w-7 h-7 ${meta.iconColor} flex-shrink-0`} />
      <div>
        <h1 className={`text-lg font-semibold ${meta.text}`}>{meta.title}</h1>
        <p className={`text-sm ${meta.text} opacity-80 mt-1`}>{meta.body}</p>
      </div>
    </div>
  );
}

function ComponentRow({
  component: c,
  locale,
  t,
}: {
  component: Component;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const name = locale === "ar" ? c.nameAr || c.nameEn : c.nameEn;
  const description = locale === "ar" ? c.descriptionAr : c.descriptionEn;
  const message = locale === "ar"
    ? c.currentMessageAr
    : c.currentMessageEn;

  // Show "Last checked X" for auto-monitored components so users
  // trust the page is live. Manual-only components (e.g. Payment
  // before a real gateway is wired) hide this row.
  const isAutoMonitored = c.checkType && c.checkType !== 'manual';
  const lastCheckedLabel = isAutoMonitored
    ? c.autoCheckedAt
      ? t("lastChecked", { time: formatRelative(new Date(c.autoCheckedAt), locale, t) })
      : t("notYetChecked")
    : null;

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">
          {name}
        </div>
        {description && (
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {description}
          </div>
        )}
        {message && (
          <div className="text-xs text-[var(--color-text-primary)] mt-1.5 italic">
            {message}
          </div>
        )}
        {lastCheckedLabel && (
          <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">
            {lastCheckedLabel}
          </div>
        )}
      </div>
      <StatusPill status={c.currentStatus} t={t} />
    </div>
  );
}

function formatRelative(
  date: Date,
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t("justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  // Fall back to absolute date for older timestamps — relative
  // labels stop being useful past 24h.
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatusPill({
  status,
  t,
}: {
  status: ComponentStatus;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const meta = {
    operational: { color: "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]" },
    degraded: { color: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" },
    partial_outage: { color: "bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]" },
    major_outage: { color: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]" },
    maintenance: { color: "bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]" },
  }[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border whitespace-nowrap flex-shrink-0 ${meta.color}`}
    >
      {t(`componentStatus.${status}`)}
    </span>
  );
}

function IncidentCard({
  incident,
  locale,
  t,
  compact,
}: {
  incident: Incident;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
  compact?: boolean;
}) {
  const title = locale === "ar" ? incident.titleAr || incident.titleEn : incident.titleEn;
  return (
    <div
      className={`bg-[var(--color-surface-card)] rounded-2xl border ${incident.resolvedAt ? 'border-[var(--color-border)]' : 'border-[#FECACA]'} p-5`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
            incident.currentStatus === 'resolved'
              ? 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
              : 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
          }`}
        >
          {t(`incidentStatus.${incident.currentStatus}`)}
        </span>
      </div>
      <div className="text-[11px] text-[var(--color-text-secondary)] mb-3">
        {t("incidentStartedAt", { time: new Date(incident.startedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US") })}
        {incident.resolvedAt && (
          <>
            {' · '}
            {t("incidentResolvedAt", { time: new Date(incident.resolvedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US") })}
          </>
        )}
      </div>
      {!compact && (
        <ol className="space-y-3 border-s border-[var(--color-border)] ps-4">
          {incident.updates.map((u) => {
            const msg = locale === "ar" ? u.messageAr || u.messageEn : u.messageEn;
            return (
              <li key={u.id} className="relative">
                <span className="absolute -start-[19px] top-1.5 w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-primary)]">
                    {t(`incidentStatus.${u.status}`)}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-secondary)]">
                    {new Date(u.postedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-line">{msg}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
