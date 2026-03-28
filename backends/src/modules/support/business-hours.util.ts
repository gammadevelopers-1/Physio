/**
 * Business Hours Utility for SLA calculations
 *
 * Business Hours: Sunday–Thursday, 9:00 AM – 6:00 PM AST (UTC+3)
 * Saudi Arabia does NOT observe DST — UTC+3 is constant year-round.
 *
 * Rules:
 * - 9:00 AM is inclusive (start of business)
 * - 6:00 PM is exclusive (end of business)
 * - Friday (5) and Saturday (6) are weekends
 * - All calculations use business minutes only
 */

const AST_OFFSET_HOURS = 3; // UTC+3
const BIZ_START_HOUR = 9; // 9 AM
const BIZ_END_HOUR = 18; // 6 PM
const BIZ_MINUTES_PER_DAY = (BIZ_END_HOUR - BIZ_START_HOUR) * 60; // 540

// Business days: Sunday(0), Monday(1), Tuesday(2), Wednesday(3), Thursday(4)
function isBusinessDay(dayOfWeek: number): boolean {
  return dayOfWeek >= 0 && dayOfWeek <= 4;
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
  const astMs = date.getTime() + AST_OFFSET_HOURS * 60 * 60 * 1000;
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
  const utc = Date.UTC(year, month, day, hour - AST_OFFSET_HOURS, minute);
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
  return timeMinutes >= BIZ_START_HOUR * 60 && timeMinutes < BIZ_END_HOUR * 60;
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
    timeMinutes >= BIZ_START_HOUR * 60 &&
    timeMinutes < BIZ_END_HOUR * 60
  ) {
    return date;
  }

  // If before business hours on a business day
  if (isBusinessDay(ast.dayOfWeek) && timeMinutes < BIZ_START_HOUR * 60) {
    return fromAST(ast.year, ast.month, ast.day, BIZ_START_HOUR, 0);
  }

  // After business hours or on a weekend — find next business day
  let nextDay = new Date(
    Date.UTC(
      ast.year,
      ast.month,
      ast.day,
      BIZ_START_HOUR - AST_OFFSET_HOURS,
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
        BIZ_START_HOUR,
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
        BIZ_START_HOUR,
        0,
      );
      const dayEnd = fromAST(ast.year, ast.month, ast.day, BIZ_END_HOUR, 0);

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
      BIZ_START_HOUR,
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
    const endOfBizMinute = BIZ_END_HOUR * 60;
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
      BIZ_START_HOUR,
      0,
    );
    current = getNextBusinessOpen(current); // skip weekends
  }

  return current; // fallback
}
