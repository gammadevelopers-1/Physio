"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Video } from "lucide-react";
import { taApi } from "@/lib/api";

interface TASessionJoinButtonProps {
  sessionId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  /** Compact size — used inside lecture rows */
  size?: "sm" | "md";
}

// Join window: opens 15 min before scheduled start, closes 30 min after
// scheduled end. Must match the backend gate in
// sessions.service.ts::getTAJoinUrl so the disabled label + the CTA
// tell the same story.
const OPEN_BEFORE_MS = 15 * 60_000;
const GRACE_AFTER_MS = 30 * 60_000;

/**
 * Format a "starts in" relative string. Coarse — we round to the
 * nearest whole minute / hour / day since the tick interval is 30s
 * anyway. Returns e.g. "5 min", "2 h", "3 d".
 */
function formatRelative(msUntil: number, locale: string): string {
  const abs = Math.max(0, msUntil);
  const mins = Math.round(abs / 60_000);
  if (mins < 60) {
    return locale === "ar" ? `${mins} د` : `${mins} min`;
  }
  const hours = Math.round(mins / 60);
  if (hours < 24) {
    return locale === "ar" ? `${hours} س` : `${hours} h`;
  }
  const days = Math.round(hours / 24);
  return locale === "ar" ? `${days} ي` : `${days} d`;
}

/**
 * Live "Join session" CTA for teaching-assistants.
 * - Live (within window): primary button — click hits /sessions/:id/ta-join
 *   and opens the returned panelist / meeting join URL in a new tab.
 * - Not yet: disabled with "Starts in {rel}".
 * - Ended / cancelled / past window: disabled with "Ended".
 *
 * Time gating is done client-side against `scheduledAt +
 * durationMinutes` so the button re-enables the instant the window
 * opens — no page refresh required. The backend re-checks on click.
 */
export default function TASessionJoinButton({
  sessionId,
  scheduledAt,
  durationMinutes,
  status,
  size = "sm",
}: TASessionJoinButtonProps) {
  const t = useTranslations("taDashboard.sessions");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Re-tick every 30s so "Starts in {rel}" freshens without the user
  // navigating. Also flips the CTA from disabled to primary the moment
  // the join window opens.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { isLive, isEnded, opensInMs } = useMemo(() => {
    const start = new Date(scheduledAt).getTime();
    const end = start + (durationMinutes || 60) * 60_000 + GRACE_AFTER_MS;
    const openAt = start - OPEN_BEFORE_MS;
    const t0 = now.getTime();
    const isTerminal =
      status === "cancelled" ||
      status === "ended" ||
      status === "completed" ||
      status === "missed";
    return {
      isLive: !isTerminal && t0 >= openAt && t0 < end,
      isEnded: isTerminal || t0 >= end,
      opensInMs: openAt - t0,
    };
  }, [scheduledAt, durationMinutes, status, now]);

  const handleClick = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await taApi.getSessionJoin(sessionId);
      if (result.joinable) {
        window.open(result.joinUrl, "_blank", "noopener,noreferrer");
      } else {
        // Server-side gate refused — surface the same "ended" / "not
        // yet" wording via error text so the user sees an explanation.
        setError(
          result.reason === "not_yet" ? t("startsSoon") : t("joinError"),
        );
      }
    } catch {
      setError(t("joinError"));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  const sizeClasses =
    size === "md"
      ? "px-4 py-2 text-sm"
      : "px-3 py-1.5 text-xs";

  if (isEnded) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center gap-1.5 ${sizeClasses} bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg font-medium cursor-not-allowed`}
        aria-disabled
      >
        <Video className="w-3.5 h-3.5" />
        {t("ended")}
      </button>
    );
  }

  if (!isLive) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center gap-1.5 ${sizeClasses} bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg font-medium cursor-not-allowed`}
        aria-disabled
        title={t("joinCta")}
      >
        <Video className="w-3.5 h-3.5" />
        {t("startsIn", { relative: formatRelative(opensInMs, locale) })}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 ${sizeClasses} btn-gold text-[var(--color-button-text)] rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-wait`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Video className="w-3.5 h-3.5" />
        )}
        {loading ? t("joinLoading") : t("joinCta")}
      </button>
      {error && (
        <span className="text-[10px] text-[#EF4444]" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
