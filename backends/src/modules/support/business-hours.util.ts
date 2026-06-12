/**
 * Business Hours Utility for SLA calculations
 *
 * Default (Saudi Arabia): Sunday–Thursday, 9:00 AM – 6:00 PM AST (UTC+3).
 * Admins can change the working days / open / close time / timezone via
 * the support_config table — the SupportService bootstraps the cache on
 * startup and refreshes it whenever the config is updated.
 *
 * Rules:
 * - openTime is inclusive (start of business)
 * - closeTime is exclusive (end of business)
 * - All calculations operate in business minutes only
 */

export interface BusinessHoursConfig {
  /** Day-of-week indices that count as business days (0=Sun … 6=Sat). */
  workingDays: number[];
  /** "HH:MM" 24-hour format, inclusive. */
  openTime: string;
  /** "HH:MM" 24-hour format, exclusive. */
  closeTime: string;
  /** Offset in hours from UTC. Saudi Arabia = 3 (UTC+3, no DST). */
  timezoneOffsetHours: number;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  workingDays: [0, 1, 2, 3, 4],
  openTime: '09:00',
  closeTime: '18:00',
  timezoneOffsetHours: 3,
};

// Module-level mutable cache. Defaults are seeded immediately so any
// callsite that fires before the DB-backed value is loaded still gets
// reasonable behaviour. The SupportService refreshes this on boot and
// whenever an admin saves a new config.
let currentConfig: BusinessHoursConfig = { ...DEFAULT_BUSINESS_HOURS };

// Last time the cache was refreshed from DB. Used by
// refreshBusinessHoursConfigIfStale() to bound how stale the in-memory
// value can get on instances that didn't handle the admin PATCH —
// critical for multi-instance Cloud Run deployments where the SLA cron
// may fire on a process that never saw the save.
let lastRefreshAt = 0;
const REFRESH_TTL_MS = 60_000;

export function getBusinessHoursConfig(): BusinessHoursConfig {
  return { ...currentConfig, workingDays: [...currentConfig.workingDays] };
}

/**
 * Replace the in-memory business-hours config. The SupportService
 * calls this on boot and after every admin save so SLA math reflects
 * the latest settings without requiring a process restart.
 */
export function setBusinessHoursConfig(next: Partial<BusinessHoursConfig>) {
  currentConfig = {
    workingDays:
      next.workingDays && next.workingDays.length > 0
        ? [...next.workingDays].sort((a, b) => a - b)
        : currentConfig.workingDays,
    openTime: next.openTime || currentConfig.openTime,
    closeTime: next.closeTime || currentConfig.closeTime,
    timezoneOffsetHours:
      typeof next.timezoneOffsetHours === 'number'
        ? next.timezoneOffsetHours
        : currentConfig.timezoneOffsetHours,
  };
  lastRefreshAt = Date.now();
}

/**
 * Reload the cache from the supplied loader if it hasn't been refreshed
 * in the last REFRESH_TTL_MS. Pass the SupportService's getBusinessHours
 * method as the loader. Safe to call frequently — bounded by the TTL and
 * by the loader's own caching. Use at the top of cron ticks and hot
 * paths that must respect admin edits made on other instances.
 */
export async function refreshBusinessHoursConfigIfStale(
  loader: () => Promise<BusinessHoursConfig>,
): Promise<void> {
  if (Date.now() - lastRefreshAt < REFRESH_TTL_MS) return;
  try {
    const next = await loader();
    setBusinessHoursConfig(next);
  } catch {
    // Best-effort. Leave the cache as-is on transient DB hiccups.
  }
}

function parseHMToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map((s) => parseInt(s, 10));
  return (h || 0) * 60 + (m || 0);
}

function isBusinessDay(dayOfWeek: number): boolean {
  return currentConfig.workingDays.includes(dayOfWeek);
}

function bizStartHour(): number {
  return Math.floor(parseHMToMinutes(currentConfig.openTime) / 60);
}
function bizEndHour(): number {
  return Math.floor(parseHMToMinutes(currentConfig.closeTime) / 60);
}

/**
 * Convert a UTC Date to AST components
 */
function toAST(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  const astMs = date.getTime() + currentConfig.timezoneOffsetHours * 60 * 60 * 1000;
  const ast = new Date(astMs);
  return {
    year: ast.getUTCFullYear(),
    month: ast.getUTCMonth(),
    day: ast.getUTCDate(),
    hour: ast.getUTCHours(),
    minute: ast.getUTCMinutes(),
    dayOfWeek: ast.getUTCDay(),
  };
}

/**
 * Create a UTC Date from AST components
 */
function fromAST(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const utc = Date.UTC(year, month, day, hour - currentConfig.timezoneOffsetHours, minute);
  return new Date(utc);
}

/**
 * Check if a date falls within business hours
 * BH-07: 9:00 AM inclusive, 6:00 PM exclusive
 */
export function isWithinBusinessHours(date: Date): boolean {
  const ast = toAST(date);
  if (!isBusinessDay(ast.dayOfWeek)) return false;
  const timeMinutes = ast.hour * 60 + ast.minute;
  return timeMinutes >= bizStartHour() * 60 && timeMinutes < bizEndHour() * 60;
}

/**
 * Get the next business day open time (9:00 AM AST)
 * If already within business hours, returns the input date
 * BH-02: Saturday 11:45 PM → Sunday 9:00 AM
 */
export function getNextBusinessOpen(date: Date): Date {
  const ast = toAST(date);
  const timeMinutes = ast.hour * 60 + ast.minute;

  // If within business hours, return as-is
  if (
    isBusinessDay(ast.dayOfWeek) &&
    timeMinutes >= bizStartHour() * 60 &&
    timeMinutes < bizEndHour() * 60
  ) {
    return date;
  }

  // If before business hours on a business day
  if (isBusinessDay(ast.dayOfWeek) && timeMinutes < bizStartHour() * 60) {
    return fromAST(ast.year, ast.month, ast.day, bizStartHour(), 0);
  }

  // After business hours or on a weekend — find next business day
  let nextDay = new Date(
    Date.UTC(
      ast.year,
      ast.month,
      ast.day,
      bizStartHour() - currentConfig.timezoneOffsetHours,
      0,
    ),
  );
  // Advance to next day
  nextDay = new Date(nextDay.getTime() + 24 * 60 * 60 * 1000);

  // Skip weekends (Friday=5, Saturday=6)
  for (let i = 0; i < 7; i++) {
    const nextAst = toAST(nextDay);
    if (isBusinessDay(nextAst.dayOfWeek)) {
      return fromAST(
        nextAst.year,
        nextAst.month,
        nextAst.day,
        bizStartHour(),
        0,
      );
    }
    nextDay = new Date(nextDay.getTime() + 24 * 60 * 60 * 1000);
  }

  return nextDay; // fallback (shouldn't reach here)
}

/**
 * Returns the last moment within business hours at or before `date`.
 * If `date` is already within business hours, returns `date` unchanged.
 * Otherwise walks back to the previous business day's close timestamp.
 *
 * Use this when computing display values that must be frozen during
 * off-hours: clamp `now` to this value so the SLA remaining-minutes
 * snapshot anchors at the moment business hours ended, instead of
 * drifting forward with wall-clock time. Without the clamp, callers
 * relying on `calculateBusinessMinutesElapsed` already get a stable
 * answer (off-hours add nothing), but the deadline/elapsed math used
 * for the UI is more transparent when `now` is explicitly capped.
 */
export function clampToBusinessHours(date: Date): Date {
  const ast = toAST(date);
  const timeMinutes = ast.hour * 60 + ast.minute;
  const open = bizStartHour() * 60;
  const close = bizEndHour() * 60;

  if (isBusinessDay(ast.dayOfWeek) && timeMinutes >= open && timeMinutes < close) {
    return date;
  }

  // After close on a business day → that day's close.
  if (isBusinessDay(ast.dayOfWeek) && timeMinutes >= close) {
    return fromAST(ast.year, ast.month, ast.day, bizEndHour(), 0);
  }

  // Before open on a business day, or weekend → previous business close.
  // Walk back day-by-day until we hit a business day, then return its
  // close timestamp.
  let prev = new Date(date.getTime());
  for (let i = 0; i < 14; i++) {
    prev = new Date(prev.getTime() - 24 * 60 * 60 * 1000);
    const prevAst = toAST(prev);
    if (isBusinessDay(prevAst.dayOfWeek)) {
      return fromAST(prevAst.year, prevAst.month, prevAst.day, bizEndHour(), 0);
    }
  }
  // Fallback — shouldn't reach here with any sane config.
  return date;
}

/**
 * Effective business minutes elapsed on a ticket, with on-hold time
 * subtracted — including the IN-FLIGHT hold period when the ticket is
 * currently on hold.
 *
 * The previous code path subtracted only `onHoldTotalMinutes`, which is
 * only updated when a ticket transitions OFF hold. While a ticket sat
 * in ON_HOLD, the SLA counter still ticked because the live elapsed
 * grew but the deduction did not. Result: agents reported tickets
 * that were on hold still breaching SLA. This helper closes that gap
 * by adding the running `onHoldAt → now` delta when status='on_hold'.
 *
 * Use this everywhere SLA math runs (detail view, breach detection,
 * 75% warning, reports). Never subtract `onHoldTotalMinutes` raw.
 */
export function effectiveBusinessMinutesElapsed(
  ticket: {
    createdAt: Date;
    status: string;
    onHoldAt: Date | null;
    onHoldTotalMinutes: number | null;
  },
  now: Date,
): number {
  const totalElapsed = calculateBusinessMinutesElapsed(ticket.createdAt, now);
  let holdMinutes = ticket.onHoldTotalMinutes || 0;
  if (ticket.status === 'on_hold' && ticket.onHoldAt) {
    holdMinutes += calculateBusinessMinutesElapsed(ticket.onHoldAt, now);
  }
  return Math.max(0, totalElapsed - holdMinutes);
}

/**
 * The total on-hold minutes including the in-flight hold period — used
 * when callers need the "deduction" amount (e.g. computing a moving
 * deadline that should slide right as a ticket stays on hold).
 */
export function effectiveOnHoldMinutes(
  ticket: {
    status: string;
    onHoldAt: Date | null;
    onHoldTotalMinutes: number | null;
  },
  now: Date,
): number {
  let holdMinutes = ticket.onHoldTotalMinutes || 0;
  if (ticket.status === 'on_hold' && ticket.onHoldAt) {
    holdMinutes += calculateBusinessMinutesElapsed(ticket.onHoldAt, now);
  }
  return holdMinutes;
}

/**
 * Calculate business minutes elapsed between two timestamps
 * Only counts minutes that fall within business hours (Sun-Thu 9AM-6PM AST)
 *
 * BH-03: 5:55 PM → only 5 business minutes that day
 * BH-04: Thursday 5:30 PM to Sunday 10:30 AM → skips Fri/Sat
 */
export function calculateBusinessMinutesElapsed(
  start: Date,
  end: Date,
): number {
  if (end.getTime() <= start.getTime()) return 0;

  let totalMinutes = 0;
  let current = new Date(start.getTime());

  // Walk day-by-day
  while (current.getTime() < end.getTime()) {
    const ast = toAST(current);

    if (isBusinessDay(ast.dayOfWeek)) {
      // Determine the business window for this day
      const dayStart = fromAST(
        ast.year,
        ast.month,
        ast.day,
        bizStartHour(),
        0,
      );
      const dayEnd = fromAST(ast.year, ast.month, ast.day, bizEndHour(), 0);

      // Clamp current and end to this day's business window
      const windowStart = Math.max(current.getTime(), dayStart.getTime());
      const windowEnd = Math.min(end.getTime(), dayEnd.getTime());

      if (windowEnd > windowStart) {
        totalMinutes += (windowEnd - windowStart) / (60 * 1000);
      }
    }

    // Move to next day's start of business
    const nextDayAst = toAST(current);
    const nextDayStart = fromAST(
      nextDayAst.year,
      nextDayAst.month,
      nextDayAst.day + 1,
      bizStartHour(),
      0,
    );
    current = nextDayStart;
  }

  return Math.floor(totalMinutes);
}

/**
 * Calculate the deadline timestamp by adding N business minutes to a start time
 * Returns the exact timestamp when those minutes are exhausted
 *
 * BH-03: 30 min FRT at 5:55 PM → 5 min today + 25 min next biz day = next day 9:25 AM
 */
export function calculateBusinessDeadline(
  start: Date,
  minutes: number,
): Date {
  if (minutes <= 0) return start;

  let remaining = minutes;
  let current = getNextBusinessOpen(start);

  while (remaining > 0) {
    const ast = toAST(current);

    if (!isBusinessDay(ast.dayOfWeek)) {
      // Skip to next business day
      current = getNextBusinessOpen(current);
      continue;
    }

    // Calculate remaining business minutes in this day
    const currentMinuteOfDay = ast.hour * 60 + ast.minute;
    const endOfBizMinute = bizEndHour() * 60;
    const availableMinutes = Math.max(0, endOfBizMinute - currentMinuteOfDay);

    if (remaining <= availableMinutes) {
      // Deadline falls within this day
      return fromAST(
        ast.year,
        ast.month,
        ast.day,
        ast.hour + Math.floor((ast.minute + remaining) / 60),
        (ast.minute + remaining) % 60,
      );
    }

    // Consume all remaining business minutes in this day
    remaining -= availableMinutes;

    // Move to next business day
    const nextDay = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    const nextAst = toAST(nextDay);
    current = fromAST(
      nextAst.year,
      nextAst.month,
      nextAst.day,
      bizStartHour(),
      0,
    );
    current = getNextBusinessOpen(current); // skip weekends
  }

  return current; // fallback
}

/**
 * Human-readable phrasing for "expected first response" used in emails,
 * in-app notifications, and the dashboard pill. The output is locale-
 * sensitive but English-only today — Arabic is computed on the FE from
 * the structured `mode` + `deadline` fields.
 *
 * Two branches:
 *   - Created in business hours → "X hours" / "X minutes" (duration)
 *   - Created off-hours        → "Sunday at 9:00 AM AST"  (resume time)
 *
 * Returning the structured fields too lets the FE re-render in Arabic
 * without re-running this util.
 */
export function describeExpectedResponse(
  createdAt: Date,
  frtMinutes: number,
): {
  mode: 'in_hours' | 'queued_until_resume';
  /** Duration of FRT in minutes (in_hours) or wait-then-FRT total (queued). */
  durationMinutes: number;
  /** Absolute deadline timestamp (business-minute aware). */
  deadline: Date;
  /** Resume timestamp — only set when queued. */
  resumeAt: Date | null;
  /** English phrasing for emails ("4 hours" or "Sunday at 9:00 AM AST"). */
  phrasing: string;
} {
  const inHours = isWithinBusinessHours(createdAt);
  const deadline = calculateBusinessDeadline(createdAt, frtMinutes);

  if (inHours) {
    const minutes = frtMinutes;
    const phrasing =
      minutes >= 60
        ? `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) === 1 ? '' : 's'}`
        : `${minutes} minute${minutes === 1 ? '' : 's'}`;
    return {
      mode: 'in_hours',
      durationMinutes: minutes,
      deadline,
      resumeAt: null,
      phrasing,
    };
  }

  // Off-hours: phrase as "{Weekday} at {h:mm} {AM/PM} AST".
  const resumeAt = getNextBusinessOpen(createdAt);
  const ast = toASTPublic(resumeAt);
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const hour12 = ast.hour % 12 === 0 ? 12 : ast.hour % 12;
  const ampm = ast.hour < 12 ? 'AM' : 'PM';
  const minuteStr = ast.minute.toString().padStart(2, '0');
  const tzLabel = currentConfig.timezoneOffsetHours === 3 ? 'AST' : `UTC+${currentConfig.timezoneOffsetHours}`;
  const phrasing = `${days[ast.dayOfWeek]} at ${hour12}:${minuteStr} ${ampm} ${tzLabel}`;

  return {
    mode: 'queued_until_resume',
    durationMinutes: frtMinutes,
    deadline,
    resumeAt,
    phrasing,
  };
}

/**
 * Exposed AST helper for callers that need to format their own date
 * strings (the dashboard pill in Arabic uses this on the FE).
 */
export function toASTPublic(date: Date) {
  const astMs =
    date.getTime() + currentConfig.timezoneOffsetHours * 60 * 60 * 1000;
  const ast = new Date(astMs);
  return {
    year: ast.getUTCFullYear(),
    month: ast.getUTCMonth(),
    day: ast.getUTCDate(),
    hour: ast.getUTCHours(),
    minute: ast.getUTCMinutes(),
    dayOfWeek: ast.getUTCDay(),
  };
}
