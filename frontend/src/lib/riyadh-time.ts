/**
 * Bidirectional helpers for binding a stored UTC timestamp to a
 * datetime-local input value. All conversions assume Asia/Riyadh
 * (AST = UTC+3, no DST), since every course on the platform runs on
 * Saudi local time.
 *
 * Use these whenever you render or read a timestamp in a form input —
 * never feed a raw ISO string into a <DateTimePicker value=…>, and
 * never send the picker's literal value to the backend without
 * appending the AST offset (otherwise `new Date()` interprets it as
 * the server's runtime timezone, usually UTC).
 */

/**
 * UTC ISO timestamp → "YYYY-MM-DDTHH:mm" Riyadh-local string for
 * binding to a <DateTimePicker value=…>.
 */
export function toRiyadhLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  // Some en-CA implementations emit "24" at midnight — normalise.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * "YYYY-MM-DDTHH:mm" Riyadh-local string → UTC ISO timestamp.
 * Appends the explicit AST offset so the Date constructor parses the
 * value as Saudi time rather than the runtime's local zone.
 */
export function fromRiyadhLocal(local: string): string {
  if (!local) return '';
  return new Date(`${local}:00+03:00`).toISOString();
}
