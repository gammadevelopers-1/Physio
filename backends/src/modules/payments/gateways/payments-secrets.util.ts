import { encryptPII, decryptPII } from '../../../common/crypto';

/**
 * Secret-field handling for `system_settings.payments`.
 *
 * Background: gateway secrets (Moyasar secret_key, Tamara apiToken +
 * notificationToken, Tabby secret_key, webhook signing secret) were
 * previously stored as plaintext in the JSONB row. That's a real risk —
 * DB backups, query logs, and read replicas all expose the value.
 *
 * Policy:
 *   - Secrets are encrypted with AES-256-GCM (encryptPII) before persist
 *   - Reads decrypt transparently via decryptPII (which also passes legacy
 *     plaintext through, so migration is a no-op)
 *   - The HTTP read projection never returns the decrypted value — only
 *     `lastFour` (the trailing 4 chars). Eye-toggle reveal in the form
 *     can therefore never expose a stored secret
 *   - Save flow: if the form submits an EMPTY string for a secret, the
 *     existing encrypted value is preserved (admin saving non-secret
 *     fields doesn't accidentally clear keys). To explicitly clear a
 *     secret, the form must send `null` (not "")
 *   - Defense against double-encryption: we reject already-encrypted
 *     payload values (they'd have the `v1:` prefix)
 */

/** Paths to encrypted secret fields inside the payments JSONB row.
 *  Keep in sync with PaymentsSettings shape on the UI side.
 *
 *  Note Tamara has TWO secrets: `merchantToken` (Tamara's apiToken — used
 *  for outgoing API calls) and `secretKeyRef` (Tamara's notificationToken
 *  — used to verify incoming webhooks). Both must be encrypted. */
const SECRET_PATHS = [
  ['moyasar', 'secretKeyRef'],
  ['tamara', 'merchantToken'],
  ['tamara', 'secretKeyRef'],
  ['tabby', 'secretKeyRef'],
  ['__top__', 'webhookSecretRef'],
] as const;

const ENCRYPTED_PREFIX = 'v1:';

function getPath(
  obj: Record<string, any> | undefined,
  scope: string,
  field: string,
): unknown {
  if (!obj) return undefined;
  if (scope === '__top__') return obj[field];
  return obj[scope]?.[field];
}

function setPath(
  obj: Record<string, any>,
  scope: string,
  field: string,
  value: unknown,
): void {
  if (scope === '__top__') {
    obj[field] = value;
    return;
  }
  if (!obj[scope] || typeof obj[scope] !== 'object') {
    obj[scope] = {};
  }
  obj[scope][field] = value;
}

/**
 * Merge incoming PATCH payload with the existing stored payments row,
 * encrypting any newly-supplied secret values. Empty strings on secret
 * fields mean "preserve existing"; explicit `null` means "clear".
 *
 * Throws if an incoming secret value looks already-encrypted (i.e. starts
 * with the `v1:` prefix) — that would double-encrypt on save and create
 * an undecryptable blob.
 */
export function normalizePaymentsForSave(
  input: Record<string, any>,
  existing: Record<string, any> | undefined,
): Record<string, any> {
  // Shallow merge: deep-merge would surprise admins (e.g. saving a partial
  // bankTransfer overwrites missing fields with undefined). Top-level keys
  // get replaced wholesale where the input provides them; secrets are the
  // exception (handled below).
  const out: Record<string, any> = { ...(existing ?? {}), ...input };

  // Reconstruct nested objects from existing where input partial-updated them
  for (const nested of ['moyasar', 'tamara', 'tabby', 'bankTransfer'] as const) {
    if (input[nested] !== undefined) {
      out[nested] = { ...(existing?.[nested] ?? {}), ...input[nested] };
    }
  }

  for (const [scope, field] of SECRET_PATHS) {
    const incoming = getPath(input, scope, field);
    const previous = getPath(existing, scope, field);

    if (incoming === undefined) {
      // Field not present in payload — preserve whatever was there.
      setPath(out, scope, field, previous ?? null);
      continue;
    }
    if (incoming === null) {
      // Explicit clear (rare — form would have to send null).
      setPath(out, scope, field, null);
      continue;
    }
    if (typeof incoming !== 'string') {
      throw new Error(
        `Invalid secret value for ${scope}.${field} — expected string, got ${typeof incoming}`,
      );
    }
    if (incoming === '') {
      // Empty string = "didn't rotate this one, keep existing"
      setPath(out, scope, field, previous ?? null);
      continue;
    }
    if (incoming.startsWith(ENCRYPTED_PREFIX)) {
      // Client tried to re-submit an already-encrypted value. Either a UI
      // bug or a forgery — refuse rather than risk double-encryption.
      throw new Error(
        `Refusing to accept already-encrypted secret for ${scope}.${field}`,
      );
    }
    setPath(out, scope, field, encryptPII(incoming));
  }

  return out;
}

/**
 * Trailing-4 of a decrypted secret, for "•••• abcd" display. Returns
 * null when the field is empty. Never returns the full value.
 */
export function lastFourOfSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const plain = decryptPII(stored);
  if (!plain || typeof plain !== 'string' || plain.length < 4) return null;
  return plain.slice(-4);
}

/**
 * Detect the live/test mode of a Moyasar or Tabby key from its prefix.
 *
 * Moyasar follows Stripe's convention exactly: `sk_live_*` vs `sk_test_*`.
 *
 * Tabby is different — sandbox keys have `_test_` in the middle
 * (`pk_test_<uuid>`), but PRODUCTION keys drop the marker entirely and
 * are just `pk_<uuid>` / `sk_<uuid>`. So absence of `_test_` on an
 * otherwise-well-formed `pk_`/`sk_` key means live.
 *
 * Returns null for empty / unrecognized shapes.
 */
export function modeFromKeyPrefix(
  stored: string | null | undefined,
): 'test' | 'live' | null {
  if (!stored) return null;
  const plain = decryptPII(stored);
  if (!plain || typeof plain !== 'string') return null;
  if (/^[a-z]+_test_/i.test(plain)) return 'test';
  if (/^[a-z]+_live_/i.test(plain)) return 'live';
  // Tabby live: `pk_<uuid>` / `sk_<uuid>` — no `_live_` marker.
  if (/^[ps]k_[0-9a-f-]{20,}$/i.test(plain)) return 'live';
  return null;
}

/**
 * Decrypt a stored secret for runtime use. Returns empty string on missing
 * input so gateway services can treat "no key" uniformly.
 */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return '';
  const plain = decryptPII(stored);
  return typeof plain === 'string' ? plain : '';
}
