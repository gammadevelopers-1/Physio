"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowRight,
  Clock,
  Inbox,
  Loader2,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { supportApi } from "@/lib/api";

interface Props {
  /** Where to link to when the user clicks a ticket. Differs per
   *  dashboard (e.g. "/dashboard/instructor/support" for instructor,
   *  "/dashboard/support/agent" for support agents). */
  detailBasePath: string;
}

type LoopedInTicket = Awaited<
  ReturnType<typeof supportApi.getLoopedInTickets>
>[number];

const DEPT_TONE: Record<string, string> = {
  finance: "bg-amber-50 text-amber-900 border-amber-200",
  course_manager: "bg-indigo-50 text-indigo-900 border-indigo-200",
  instructor: "bg-emerald-50 text-emerald-900 border-emerald-200",
  ta: "bg-emerald-50 text-emerald-900 border-emerald-200",
  admin: "bg-red-50 text-red-900 border-red-200",
  supervisor: "bg-sky-50 text-sky-900 border-sky-200",
};

const STATUS_TONE: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  on_hold: "bg-zinc-50 text-zinc-700 border-zinc-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

/**
 * Generic "Looped In" inbox — used on every staff dashboard's Support
 * section. Shows tickets where the caller is currently an active
 * collaborator (added via Support's "Loop in" button on the ticket
 * detail). Clicking a row deep-links to the role-appropriate detail
 * page.
 */
export default function LoopedInTickets({ detailBasePath }: Props) {
  const t = useTranslations("supportDashboard.ticketDetail.loopedInInbox");
  const tDept = useTranslations("support.departments");
  const locale = useLocale();
  const [tickets, setTickets] = useState<LoopedInTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supportApi
      .getLoopedInTickets()
      .then((rows) => {
        if (!cancelled) setTickets(rows);
      })
      .catch(() => {
        if (!cancelled) setTickets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Group by department so the inbox reads like "Finance asked me about
  // 3 tickets, Course Manager about 1" — the looped-in user usually
  // wears one hat per department and this matches their mental model.
  const grouped = tickets.reduce<Record<string, LoopedInTicket[]>>(
    (acc, tk) => {
      (acc[tk.loopedInAs] = acc[tk.loopedInAs] || []).push(tk);
      return acc;
    },
    {},
  );
  const groupOrder = Object.keys(grouped);

  return (
    <div className="space-y-5">
      {/* Hero — gives the page a proper header card instead of bare
          text-on-page like the old version */}
      <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/8 to-[var(--color-primary)]/0 border border-[var(--color-border)] px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-white ring-1 ring-inset ring-[var(--color-border)] flex items-center justify-center shadow-sm flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl sm:text-2xl font-semibold text-[var(--color-text-primary)] mb-1">
              {t("title")}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-xl">
              {t("subtitle")}
            </p>
          </div>
          {!loading && tickets.length > 0 && (
            <div className="text-end">
              <div className="text-2xl font-semibold text-[var(--color-text-primary)] leading-none">
                {tickets.length}
              </div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)] mt-1">
                {t("ticketCountLabel", { count: tickets.length })}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white px-6 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--color-surface-page)] flex items-center justify-center">
            <Inbox className="w-7 h-7 text-[var(--color-text-secondary)]/60" />
          </div>
          <div className="text-base font-semibold text-[var(--color-text-primary)] mb-1.5">
            {t("emptyTitle")}
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
            {t("emptyHint")}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groupOrder.map((dept) => (
            <section key={dept}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase font-semibold tracking-wide rounded-full border ${
                    DEPT_TONE[dept] ??
                    "bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
                  }`}
                >
                  {tDept(dept)}
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  {grouped[dept].length}
                </span>
              </div>
              <ul className="space-y-2">
                {grouped[dept].map((tk) => (
                  <li key={tk.id}>
                    <a
                      href={`${detailBasePath}/${tk.id}`}
                      className="block rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 hover:border-[var(--color-primary)] hover:shadow-md hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wide font-semibold font-mono text-[var(--color-text-secondary)]">
                              {tk.referenceNumber}
                            </span>
                            <span
                              className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full border ${
                                STATUS_TONE[tk.status] ??
                                "bg-zinc-50 text-zinc-700 border-zinc-200"
                              }`}
                            >
                              {t(`status.${tk.status}`)}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors mb-1.5">
                            {tk.subject}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)] flex-wrap">
                            {tk.requesterName && (
                              <span className="inline-flex items-center gap-1">
                                <UserPlus className="w-3 h-3" />
                                {tk.requesterName}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fmt.format(new Date(tk.loopedInAt))}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
