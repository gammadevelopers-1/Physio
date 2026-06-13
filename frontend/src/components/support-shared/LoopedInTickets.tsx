"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowRight,
  Clock,
  Loader2,
  MessageSquare,
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
  const t = useTranslations("ticketDetail.loopedInInbox");
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[var(--color-text-secondary)]" />
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {t("subtitle")}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white px-6 py-12 text-center">
          <UserPlus className="w-10 h-10 mx-auto text-[var(--color-text-secondary)]/40 mb-3" />
          <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
            {t("emptyTitle")}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {t("emptyHint")}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((tk) => (
            <li key={tk.id}>
              <a
                href={`${detailBasePath}/${tk.id}`}
                className="block rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 hover:border-[var(--color-primary)] hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)]">
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
                      <span
                        className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full border ${
                          DEPT_TONE[tk.loopedInAs] ??
                          "bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
                        }`}
                      >
                        {tDept(tk.loopedInAs)}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {tk.subject}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
                      {tk.requesterName && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {tk.requesterName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmt.format(new Date(tk.loopedInAt))}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] shrink-0" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
