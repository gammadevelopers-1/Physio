"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  supportApi,
  type RoleRequestEvent,
  type RoleRequestStatus,
  type MissingRequirement,
} from "@/lib/api";

interface Props {
  ticketId: string;
  ticketCategory: string;
  /**
   * Where the "View full application" CTA points. Support users go to
   * the read-only support page; admins go to the writable admin page.
   * Pass the right one from the embedding screen.
   */
  detailHref: (roleRequestId: string) => string;
}

type Application = {
  id: string;
  status: RoleRequestStatus;
  requestedRole: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  missingRequirements: MissingRequirement[] | null;
  applicantId: string;
};

const AUTO_EXPAND_CATEGORIES = new Set(["trainer"]);

export default function TrainerApplicationCard({
  ticketId,
  ticketCategory,
  detailHref,
}: Props) {
  const t = useTranslations("supportDashboard.trainerApplication");
  const locale = useLocale();

  const [expanded, setExpanded] = useState(
    AUTO_EXPAND_CATEGORIES.has(ticketCategory),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [events, setEvents] = useState<RoleRequestEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    supportApi
      .getTicketTrainerApplication(ticketId)
      .then((res) => {
        if (cancelled) return;
        setApplication(res.application);
        setEvents(res.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  // Hidden entirely when there's no matching application — avoids
  // adding an empty row to every ticket's sidebar.
  if (!loading && !error && !application) return null;

  const status = application?.status ?? "PENDING";
  const statusVisual = STATUS_VISUALS[status];
  const StatusIcon = statusVisual.icon;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-5 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
          <h3
            className="text-sm font-semibold text-[var(--color-text-primary)] truncate"
            title={t("title")}
          >
            {t("title")}
          </h3>
          {application && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${statusVisual.color} ${statusVisual.bg}`}
            >
              <StatusIcon className="w-3 h-3" />
              {t(`status.${status}`)}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {loading && <LoadingState />}
          {!loading && error && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-3">
              <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
              {t("loadError")}
            </div>
          )}

          {!loading && !error && application && (
            <>
              <MetaSection
                application={application}
                events={events}
                locale={locale}
                t={t}
              />

              {application.status === "MORE_INFO" &&
                application.missingRequirements &&
                application.missingRequirements.length > 0 && (
                  <MissingReqsSection
                    items={application.missingRequirements}
                    t={t}
                  />
                )}

              <EventsTimeline events={events} locale={locale} t={t} />

              <Link
                href={detailHref(application.id)}
                className="inline-flex items-center justify-center gap-1 w-full px-3 py-2 text-xs font-medium rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-page)] text-[var(--color-text-primary)]"
              >
                <ExternalLink className="w-3 h-3" />
                {t("viewFull")}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Status visuals ─────────────────────────────────────────────

type StatusVisual = {
  icon: LucideIcon;
  color: string;
  bg: string;
};

const STATUS_VISUALS: Record<RoleRequestStatus, StatusVisual> = {
  PENDING: {
    icon: Clock,
    color: "text-[#1D4ED8]",
    bg: "bg-[#DBEAFE]",
  },
  APPROVED: {
    icon: CheckCircle2,
    color: "text-[#16A34A]",
    bg: "bg-[#DCFCE7]",
  },
  REJECTED: {
    icon: XCircle,
    color: "text-[#DC2626]",
    bg: "bg-[#FEE2E2]",
  },
  MORE_INFO: {
    icon: AlertTriangle,
    color: "text-[#B45309]",
    bg: "bg-[#FEF3C7]",
  },
};

// ─── Subcomponents ──────────────────────────────────────────────

type T = ReturnType<typeof useTranslations>;

function MetaSection({
  application,
  events,
  locale,
  t,
}: {
  application: Application;
  events: RoleRequestEvent[];
  locale: string;
  t: T;
}) {
  const submitted = formatDate(application.submittedAt, locale);
  const latestReviewEvent = [...events]
    .reverse()
    .find((e) =>
      ["approved", "rejected", "requested_info"].includes(e.action),
    );
  const reviewerName = latestReviewEvent
    ? formatReviewerName(latestReviewEvent)
    : null;
  const reviewerWhen = latestReviewEvent
    ? formatDate(latestReviewEvent.createdAt, locale)
    : null;

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      <StatLine label={t("submittedOn")} value={submitted} />
      {reviewerName && (
        <StatLine
          label={t("latestReviewer")}
          value={`${reviewerName} · ${reviewerWhen}`}
        />
      )}
      {application.reviewNote && (
        <div className="col-span-2 bg-[var(--color-surface-page)] rounded-lg p-2.5 border border-[var(--color-border)]">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
            {t("latestNote")}
          </div>
          <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
            {application.reviewNote}
          </p>
        </div>
      )}
    </div>
  );
}

function MissingReqsSection({
  items,
  t,
}: {
  items: MissingRequirement[];
  t: T;
}) {
  return (
    <div className="border border-[#FDE68A] bg-[#FFFBEB] rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
        <span className="text-[11px] uppercase tracking-wide font-semibold text-[#92400E]">
          {t("missingReqsTitle")}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-[#92400E]">
            <div className="font-medium">{missingReqLabel(item, t)}</div>
            {item.note && (
              <div className="text-[11px] italic mt-0.5">{item.note}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function missingReqLabel(item: MissingRequirement, t: T): string {
  if (item.code === "OTHER") return item.label?.trim() || "—";
  // Fallback to label if admin set one; otherwise use the i18n key for
  // the standard code.
  if (item.label?.trim()) return item.label.trim();
  return t(`missingReqs.${item.code}`);
}

function EventsTimeline({
  events,
  locale,
  t,
}: {
  events: RoleRequestEvent[];
  locale: string;
  t: T;
}) {
  if (events.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[11px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)]">
          {t("activity")}
        </span>
      </div>
      <ol className="relative ps-3 space-y-3">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          return (
            <li key={event.id} className="relative">
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute -start-[2px] top-[14px] -bottom-3 w-px bg-[var(--color-border)]"
                />
              )}
              <span
                className="absolute -start-[7px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--color-surface-card)]"
                style={{
                  backgroundColor: EVENT_DOT_COLOR[event.action] ?? "#9CA3AF",
                }}
              />
              <div className="ms-3">
                <div className="text-xs font-medium text-[var(--color-text-primary)]">
                  {t(`events.${event.action}`)}
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">
                  {formatReviewerName(event) ?? t("eventByApplicant")}
                  {" · "}
                  {formatDate(event.createdAt, locale)}
                </div>
                {event.note && (
                  <p className="mt-1 text-[11px] text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {event.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const EVENT_DOT_COLOR: Record<string, string> = {
  submitted: "#1D4ED8",
  approved: "#16A34A",
  rejected: "#DC2626",
  requested_info: "#B45309",
  resubmitted: "#7C3AED",
};

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </span>
      <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
        {value}
      </span>
    </div>
  );
}

function LoadingState() {
  const t = useTranslations("supportDashboard.trainerApplication");
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-3">
      <Loader2 className="w-3 h-3 animate-spin" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}

function formatReviewerName(event: RoleRequestEvent): string | null {
  const first = event.performedByFirstName?.trim() ?? "";
  const last = event.performedByLastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  if (event.performedByEmail) return event.performedByEmail;
  return null;
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}
