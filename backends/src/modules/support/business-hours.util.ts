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
