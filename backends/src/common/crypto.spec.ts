import { randomBytes } from 'crypto';
import { encryptPII, decryptPII } from './crypto';

// Deterministic key across the whole file so all cases share it.
process.env.PII_ENCRYPTION_KEY = randomBytes(32).toString('base64');

describe('encryptPII / decryptPII round-trip', () => {
  it('encrypts and decrypts a plain IBAN back to itself', () => {
    const iban = 'SA0380000000608010167519';
    const cipher = encryptPII(iban);
    expect(cipher).not.toBe(iban);
    expect(cipher!.startsWith('v1:')).toBe(true);
    expect(decryptPII(cipher)).toBe(iban);
  });

  it('encrypts and decrypts a Saudi national ID', () => {
    const nid = '1234567890';
    const cipher = encryptPII(nid);
    expect(decryptPII(cipher)).toBe(nid);
  });

  it('passes null through unchanged (write side)', () => {
    expect(encryptPII(null)).toBeNull();
    expect(encryptPII(undefined)).toBeUndefined();
    expect(encryptPII('')).toBe('');
  });

  it('passes null through unchanged (read side)', () => {
    expect(decryptPII(null)).toBeNull();
    expect(decryptPII(undefined)).toBeUndefined();
    expect(decryptPII('')).toBe('');
  });

  it('passes legacy plaintext through decryptPII unchanged', () => {
    // Backfill safety: rows written before the encryption cutover still
    // decrypt to their original value (they lack the `v1:` prefix and are
    // passed through). Without this behavior the migration would break
    // every historical row.
    const legacy = 'SA0380000000608010167519';
    expect(decryptPII(legacy)).toBe(legacy);
  });

  it('produces different ciphertext for the same plaintext on each call', () => {
    // Random IV per encryption — required for GCM safety. Two encrypts of
    // the same value must differ; otherwise ciphertext leaks equality
    // between records.
    const iban = 'SA0380000000608010167519';
    const a = encryptPII(iban);
    const b = encryptPII(iban);
    expect(a).not.toBe(b);
    expect(decryptPII(a)).toBe(iban);
    expect(decryptPII(b)).toBe(iban);
  });

  it('throws on tampered ciphertext', () => {
    // GCM auth tag guarantees tamper detection. A single-byte change to
    // the ciphertext portion must fail authentication loudly rather than
    // silently returning garbage.
    const original = encryptPII('SA0380000000608010167519')!;
    const parts = original.split(':');
    const encBuf = Buffer.from(parts[3], 'base64');
    encBuf[0] = encBuf[0] ^ 0xff; // flip first byte
    parts[3] = encBuf.toString('base64');
    const tampered = parts.join(':');
    expect(() => decryptPII(tampered)).toThrow();
  });
});
