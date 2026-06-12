"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  MessageSquare,
  BookOpen,
  Video,
  CreditCard,
  Award,
  CalendarCheck,
  ClipboardList,
  UserCheck,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { supportApi } from "@/lib/api";

interface Props {
  ticketId: string;
  isGuestTicket: boolean;
}

type EventType =
  | 'ticket'
  | 'enrollment'
  | 'webinar'
  | 'payment'
  | 'certificate'
  | 'session'
  | 'intervention'
  | 'course_managed'
  | 'ta_assignment';

type TimelineEvent = {
  type: EventType;
  timestamp: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  linkTarget: { kind: 'ticket'; ticketId: string } | null;
};

type RequesterRole =
  | 'student'
  | 'instructor'
  | 'manager'
  | 'ta'
  | 'finance'
  | 'guest';

type FilterKey =
  | 'all'
  | 'ticket'
  | 'enrollment'
  | 'webinar'
  | 'payment'
  | 'certificate'
  | 'session'
  | 'intervention'
  | 'course_managed'
  | 'ta_assignment';

export default function StudentTimelineCard({ ticketId, isGuestTicket }: Props) {
  const t = useTranslations("supportDashboard.ticketDetail");
  const locale = useLocale();
  // Same card is rendered on both the support and admin ticket detail
  // pages. Detect which dashboard owns the current view so the click
  // target points at the right ticket route — otherwise an admin lands
  // on a SUPPORT-role-only path and gets bounced to /dashboard.
  const pathname = usePathname() || "";
  const ticketsBaseHref = pathname.includes("/dashboard/admin/")
    ? `/${locale}/dashboard/admin/support/tickets`
    : `/${locale}/dashboard/support/tickets`;
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [role, setRole] = useState<RequesterRole>('student');
  const [filter, setFilter] = useState<FilterKey>('all');
  // Defer fetching until first expand — collapsed card is the default,
  // so we don't burn 5 queries on tickets where the agent never opens
  // the timeline.
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (isGuestTicket || !expanded || hasFetched) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    supportApi
      .getTicketStudentTimeline(ticketId)
      .then((res) => {
        if (cancelled) return;
        if (res.isGuest) {
          setEvents([]);
        } else {
          setEvents(res.events);
        }
        setRole(res.role);
        setHasFetched(true);
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
  }, [ticketId, isGuestTicket, expanded, hasFetched]);

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => {
      if (filter === 'enrollment') return e.type === 'enrollment' || e.type === 'certificate';
      return e.type === filter;
    });
  }, [events, filter]);

  if (isGuestTicket) return null;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between text-start"
      >
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("timeline.title")}
        </h3>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
          {hasFetched && (
            <span>{t("timeline.eventsCount", { count: events.length })}</span>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="mt-3">
          {/* Filter chips — role-aware so a manager's timeline
              doesn't show "payments" chip that filters to zero. */}
          {hasFetched && events.length > 0 && (
            <div className="flex items-center gap-1 mb-3 flex-wrap">
              {filterChipsForRole(role, t).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
                    filter === f.key
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-3">
              <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
              {t("timeline.loadError")}
            </div>
          )}

          {!loading && !error && hasFetched && events.length === 0 && (
            <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">
              {t("timeline.empty")}
            </p>
          )}

          {!loading && !error && filteredEvents.length === 0 && events.length > 0 && (
            <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">
              {t("timeline.emptyFilter")}
            </p>
          )}

          {!loading && !error && filteredEvents.length > 0 && (
            <ol className="space-y-2.5 max-h-80 overflow-y-auto pe-1">
              {filteredEvents.map((e, idx) => (
                <TimelineRow
                  key={`${e.type}-${e.timestamp}-${idx}`}
                  event={e}
                  t={t}
                  locale={locale}
                  ticketsBaseHref={ticketsBaseHref}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineRow({
  event,
  t,
  locale,
  ticketsBaseHref,
}: {
  event: TimelineEvent;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  ticketsBaseHref: string;
}) {
  const meta = eventMeta(event.type);
  const Icon = meta.icon;
  const statusLabel = event.status ? statusLabelFor(event, t) : null;
  const statusColor = event.status ? statusColorFor(event) : '';
  const dateLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(event.timestamp));

  const body = (
    <div className="flex items-start gap-2.5">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.iconBg}`}
      >
        <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {dateLabel}
          </span>
          {statusLabel && (
            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${statusColor}`}>
              {statusLabel}
            </span>
          )}
        </div>
        <div
          className="text-xs text-[var(--color-text-primary)] font-medium truncate mt-0.5"
          title={event.title}
        >
          {event.title}
        </div>
        {event.subtitle && (
          <div
            className="text-[11px] text-[var(--color-text-secondary)] truncate"
            title={event.subtitle}
          >
            {event.subtitle}
          </div>
        )}
      </div>
      {event.linkTarget && (
        <ExternalLink className="w-3 h-3 text-[var(--color-text-secondary)] mt-2 flex-shrink-0" />
      )}
    </div>
  );

  if (event.linkTarget?.kind === 'ticket') {
    return (
      <li>
        <a
          href={`${ticketsBaseHref}/${event.linkTarget.ticketId}`}
          className="block hover:bg-[var(--color-border-subtle)] rounded p-1 -m-1 transition-colors"
        >
          {body}
        </a>
      </li>
    );
  }

  return <li>{body}</li>;
}

function eventMeta(type: EventType): {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
} {
  switch (type) {
    case 'ticket':
      return { icon: MessageSquare, iconBg: 'bg-[#EFF6FF]', iconColor: 'text-[#3B82F6]' };
    case 'enrollment':
      return { icon: BookOpen, iconBg: 'bg-[#F5F3FF]', iconColor: 'text-[#8B5CF6]' };
    case 'webinar':
      return { icon: Video, iconBg: 'bg-[#FFF7ED]', iconColor: 'text-[#EA580C]' };
    case 'payment':
      return { icon: CreditCard, iconBg: 'bg-[#ECFDF5]', iconColor: 'text-[#047857]' };
    case 'certificate':
      return { icon: Award, iconBg: 'bg-[#FEF3C7]', iconColor: 'text-[#92400E]' };
    case 'session':
      return { icon: CalendarCheck, iconBg: 'bg-[#EEF2FF]', iconColor: 'text-[#4F46E5]' };
    case 'intervention':
      return { icon: ClipboardList, iconBg: 'bg-[#FEF2F2]', iconColor: 'text-[#B91C1C]' };
    case 'course_managed':
      return { icon: BookOpen, iconBg: 'bg-[#F0F9FF]', iconColor: 'text-[#0369A1]' };
    case 'ta_assignment':
      return { icon: UserCheck, iconBg: 'bg-[#F0FDF4]', iconColor: 'text-[#15803D]' };
  }
}

// Each role gets the chips that actually match events it can
// emit. Keeps the strip lean — no "payments" chip on a manager
// timeline, no "courses managed" chip on a student timeline.
function filterChipsForRole(
  role: RequesterRole,
  t: ReturnType<typeof useTranslations>,
): { key: FilterKey; label: string }[] {
  const all = { key: 'all' as FilterKey, label: t("timeline.filters.all") };
  const tickets = { key: 'ticket' as FilterKey, label: t("timeline.filters.tickets") };

  if (role === 'instructor') {
    return [
      all,
      tickets,
      { key: 'session', label: t("timeline.filters.sessions") },
      { key: 'intervention', label: t("timeline.filters.interventions") },
    ];
  }
  if (role === 'manager') {
    return [
      all,
      tickets,
      { key: 'course_managed', label: t("timeline.filters.coursesManaged") },
    ];
  }
  if (role === 'ta') {
    return [
      all,
      tickets,
      { key: 'ta_assignment', label: t("timeline.filters.taAssignments") },
    ];
  }
  if (role === 'finance') {
    return [tickets];
  }
  return [
    all,
    tickets,
    { key: 'enrollment', label: t("timeline.filters.courses") },
    { key: 'webinar', label: t("timeline.filters.webinars") },
    { key: 'payment', label: t("timeline.filters.payments") },
  ];
}

function statusLabelFor(event: TimelineEvent, t: ReturnType<typeof useTranslations>): string {
  if (!event.status) return '';
  // Re-use existing status translations where they exist; fall back
  // to the raw value so we never render an empty chip.
  const key = `timeline.status.${event.type}.${event.status}`;
  try {
    const translated = t(key);
    if (translated && translated !== key) return translated;
  } catch {
    // missing key — fall through to raw
  }
  return event.status;
}

function statusColorFor(event: TimelineEvent): string {
  const s = event.status || '';
  // Negative — failed, dropped, closed, missed, revoked, suspended, rejected
  if (
    [
      'failed',
      'dropped',
      'suspended',
      'missed',
      'closed',
      'revoked',
      'rejected',
      'cancelled',
    ].includes(s)
  ) {
    return 'bg-[#FEE2E2] text-[#B91C1C] ring-1 ring-inset ring-[#F87171]';
  }
  // Warning — needs attention but not blocking
  if (['on_hold', 'expired', 'overdue', 'no_show'].includes(s)) {
    return 'bg-[#FEF3C7] text-[#92400E] ring-1 ring-inset ring-[#FBBF24]';
  }
  // Active / in-progress / open — saturated blue so they read clearly
  if (
    [
      'pending',
      'in_progress',
      'new',
      'open',
      'registered',
      'upcoming',
      'active',
      'live',
      'scheduled',
    ].includes(s)
  ) {
    return 'bg-[#DBEAFE] text-[#1E40AF] ring-1 ring-inset ring-[#60A5FA]';
  }
  // Positive — completed, resolved, attended, issued, approved, paid
  if (
    [
      'completed',
      'resolved',
      'attended',
      'issued',
      'approved',
      'paid',
      'succeeded',
    ].includes(s)
  ) {
    return 'bg-[#DCFCE7] text-[#15803D] ring-1 ring-inset ring-[#4ADE80]';
  }
  return 'bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)]';
}
