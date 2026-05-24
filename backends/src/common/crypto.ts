/**
 * Application-layer encryption for PII fields stored in the database.
 * AES-256-GCM with a per-encryption random IV. Output format:
 *
 *   v1:<base64-iv>:<base64-authTag>:<base64-ciphertext>
 *
 * Storing the version prefix lets us rotate algorithms/keys later
 * without breaking existing rows. Adding the auth tag (GCM's built-in
 * tamper-detection) means a row whose ciphertext was modified outside
 * our app will fail decryption noisily instead of returning garbage.
 *
 * Key source: `PII_ENCRYPTION_KEY` env var. In production this is
 * injected from GCP Secret Manager into Cloud Run; locally it should
 * be set in `.env.local` (32 random bytes, base64-encoded).
 *
 * Backward-compat: encryptPII/decryptPII are null-safe. If the env key
 * is missing OR the input lacks the `v1:` prefix, we pass the value
 * through unchanged. That makes the migration safe: the column can
 * hold a mix of plaintext (legacy) and `v1:...` (new) rows, and the
 * service can read both without branching at every call site.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard
const KEY_BYTES = 32;

let cachedKey: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    cachedKey = null;
    return null;
  }
  // Accept base64 (preferred — `openssl rand -base64 32`) or raw 32-byte
  // hex (`openssl rand -hex 32`). Hex must be exactly 64 chars.
  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw.trim())) {
    key = Buffer.from(raw.trim(), 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `PII_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`,
    );
  }
  cachedKey = key;
  return key;
}

/**
 * Encrypt a PII string. Returns the input unchanged when:
 *   - the value is null/undefined/empty (nothing to encrypt)
 *   - no encryption key is configured (dev fallback)
 * This means the column type stays the same (varchar/text) and
 * older rows continue to read correctly via decryptPII().
 */
export function encryptPII<T extends string | null | undefined>(value: T): T {
  if (value === null || value === undefined || value === '') return value;
  const key = getKey();
  if (!key) return value; // dev mode: store plaintext

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(value as string, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}` as unknown as T;
}

/**
 * Decrypt a value written by encryptPII(). Returns input unchanged when:
 *   - value is null/empty
 *   - value lacks the `v1:` prefix (it's legacy plaintext — return as-is)
 *   - no key is configured
 *
 * Throws if a `v1:`-prefixed value fails authentication (tampered).
 * Callers that don't care about tamper detection on per-row reads can
 * wrap in try/catch, but the default should be loud failure.
 */
export function decryptPII<T extends string | null | undefined>(value: T): T {
  if (value === null || value === undefined || value === '') return value;
  const s = value as string;
  if (!s.startsWith(`${VERSION}:`)) return value; // legacy plaintext
  const key = getKey();
  if (!key) return value;

  const parts = s.split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted PII value (expected 4 parts)');
  }
  const [, ivB64, tagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8') as unknown as T;
}

/**
 * Generate a fresh 32-byte key, base64-encoded. Used once to create the
 * value that goes into Secret Manager. Run via `ts-node` or paste into
 * the secret form on GCP.
 */
export function generateNewKey(): string {
  return randomBytes(KEY_BYTES).toString('base64');
}

/**
 * Convenience wrapper: take any object that might carry the encrypted
 * user PII fields and return a copy with those fields decrypted. Safe
 * to call when fields are absent (partial selections) — they just stay
 * undefined.
 *
 * Use this at the boundary where data leaves a service to the
 * controller / response. Keeps the encryption transparent to every
 * read site instead of decrypting field-by-field at each call.
 */
export function decryptUserPII<
  T extends {
    phone?: string | null;
    nationalId?: string | null;
    scfhsNumber?: string | null;
  } | null | undefined,
>(obj: T): T {
  if (!obj) return obj;
  return {
    ...obj,
    ...(obj.phone !== undefined ? { phone: decryptPII(obj.phone) } : {}),
    ...(obj.nationalId !== undefined ? { nationalId: decryptPII(obj.nationalId) } : {}),
    ...(obj.scfhsNumber !== undefined ? { scfhsNumber: decryptPII(obj.scfhsNumber) } : {}),
  };
}
