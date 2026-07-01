/**
 * PII scrubber for Sentry events.
 *
 * SDAIA + NELC compliance requires that no personal identifying information
 * leaves Saudi data residency. Sentry is hosted in the EU (de.sentry.io)
 * which is GDPR-equivalent and SDAIA-acceptable, but we still strip every
 * known PII field before transmission as defense-in-depth.
 *
 * Scrubbed:
 *   - Object keys matching known PII names (national_id, phone, email, etc.)
 *   - String values matching PII patterns (Saudi NID, phone, email regex)
 *   - URL query parameters (might leak tokens)
 *   - Request cookies (always)
 *   - User object stripped to just `id` (UUID) + `role` tag
 */

import type { ErrorEvent, EventHint } from '@sentry/nextjs';

const PII_KEYS = [
  'password',
  'passwd',
  'token',
  'authorization',
  'auth',
  'national_id',
  'nationalid',
  'iqama',
  'iqamanumber',
  'phone',
  'phonenumber',
  'mobile',
  'email',
  'emailaddress',
  'scfhs_number',
  'scfhsnumber',
  'credit_card',
  'card_number',
  'cardnumber',
  'cvv',
  'cvc',
  'session',
  'cookie',
  'apikey',
  'api_key',
  'secret',
];

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b1\d{9}\b/g, '[redacted-nid]'],
  [/\+?\d{10,15}/g, '[redacted-phone]'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted-email]'],
  [/\b\d{13,19}\b/g, '[redacted-card]'],
];

function scrubString(s: string): string {
  let out = s;
  for (const [pattern, replacement] of PII_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function shouldRedactKey(key: string): boolean {
  const k = key.toLowerCase();
  return PII_KEYS.some((pii) => k.includes(pii));
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (shouldRedactKey(k)) {
      result[k] = '[redacted]';
    } else {
      result[k] = scrubValue(v, depth + 1);
    }
  }
  return result;
}

export function scrubEvent(
  event: ErrorEvent,
  _hint: EventHint,
): ErrorEvent | null {
  if (event.environment === 'development') return null;

  if (event.request?.url) {
    try {
      const u = new URL(event.request.url);
      event.request.url = u.origin + u.pathname;
    } catch {
      // not a parseable URL — leave alone
    }
  }

  if (event.request) {
    if (event.request.data) {
      event.request.data = scrubValue(event.request.data);
    }
    if (event.request.headers) {
      event.request.headers = scrubValue(event.request.headers) as Record<
        string,
        string
      >;
    }
    if (event.request.cookies) {
      delete event.request.cookies;
    }
    if (event.request.query_string) {
      event.request.query_string = '[redacted]';
    }
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as ErrorEvent['contexts'];
  }

  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  if (event.message) {
    event.message = scrubString(event.message);
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((bc) => ({
      ...bc,
      message: bc.message ? scrubString(bc.message) : bc.message,
      data: bc.data ? (scrubValue(bc.data) as Record<string, unknown>) : bc.data,
    }));
  }

  return event;
}
