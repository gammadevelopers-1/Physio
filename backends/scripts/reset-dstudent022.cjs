/* =========================================================================
 * Reset dstudent022@gmail.com for clean NELC validation re-run
 * =========================================================================
 *
 * Run via cloud_sql_proxy. Reads PII_ENCRYPTION_KEY + DATABASE_URL from
 * GCP Secret Manager (Cloud Run env) — the same values the backend uses,
 * so the rotated National ID encrypts correctly and decrypts at runtime.
 *
 * Usage (from machine with gcloud + cloud_sql_proxy installed):
 *
 *   # 1. Start proxy in another terminal:
 *   cloud_sql_proxy --port 5433 \
 *     nelc-elearning-platform-479319:me-central2:physioguidance-db-me
 *
 *   # 2. Pull the secrets:
 *   export PII_ENCRYPTION_KEY=$(gcloud secrets versions access latest \
 *     --secret=PII_ENCRYPTION_KEY)
 *   export DATABASE_URL=$(gcloud secrets versions access latest \
 *     --secret=DATABASE_URL)
 *   # Rewrite the host to localhost:5433 so the proxy handles it:
 *   export DATABASE_URL=$(echo "$DATABASE_URL" | sed -E \
 *     's#@[^:/]+(:5432)?#@localhost:5433#')
 *
 *   # 3. Run from backends/ so node_modules resolves pg:
 *   cd backends
 *   node ../path/to/reset-dstudent022.cjs
 * ========================================================================= */

'use strict';

const { Client } = require('pg');
const { createCipheriv, randomBytes } = require('crypto');

const TARGET_EMAIL = 'dstudent022@gmail.com';
const NEW_NATIONAL_ID = '1013049234';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getEncryptionKey() {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('PII_ENCRYPTION_KEY env var is required');
  }
  let key;
  if (/^[0-9a-f]{64}$/i.test(raw.trim())) {
    key = Buffer.from(raw.trim(), 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `PII_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`,
    );
  }
  return key;
}

/** Mirror backends/src/common/crypto.ts::encryptPII */
function encryptPII(value) {
  if (!value) return value;
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL env var is required');
  }

  // Sanity-check the encryption key produces a valid v1:... blob BEFORE
  // touching any DB rows. If the key is wrong the new NID would be
  // unrecoverable and dstudent022 couldn't log NELC statements.
  const encryptedNid = encryptPII(NEW_NATIONAL_ID);
  if (!encryptedNid || !encryptedNid.startsWith('v1:')) {
    throw new Error('Encryption did not produce a v1: ciphertext — key issue?');
  }
  console.log(`[ok] Encrypted new NID — preview: ${encryptedNid.slice(0, 30)}...`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('[ok] Connected to DB');

  try {
    await client.query('BEGIN');

    // 1. Locate the user
    const userRes = await client.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [TARGET_EMAIL],
    );
    if (userRes.rowCount === 0) {
      throw new Error(`User ${TARGET_EMAIL} not found`);
    }
    const targetUserId = userRes.rows[0].id;
    console.log(`[ok] Target user_id = ${targetUserId}`);

    // 2. Wipe learning history (order matters less since FKs are by uuid,
    //    but enrollments goes LAST so any dangling FK is from a row
    //    we've already deleted).
    const deletes = [
      ['xapi_statements', 'actor_user_id'],
      ['webinar_registrations', 'user_id'],
      ['video_watch_events', 'student_id'],
      ['course_ratings', 'student_id'],
      ['instructor_ratings', 'student_id'],
      ['assessment_overrides', 'student_id'],
      ['assessment_retake_grants', 'student_id'],
      ['submissions', 'student_id'],
      ['attendance_logs', 'student_id'],
      ['attendance', 'student_id'],
      ['material_progress', 'student_id'],
      ['module_completions', 'student_id'],
      ['certificate_requests', 'student_id'],
      ['enrollments', 'student_id'],
    ];

    for (const [table, col] of deletes) {
      const r = await client.query(
        `DELETE FROM ${table} WHERE ${col} = $1`,
        [targetUserId],
      );
      console.log(`[ok] ${table}: ${r.rowCount} rows deleted`);
    }

    // 3. Rotate the national_id so NELC sees a brand-new learner.
    const updRes = await client.query(
      'UPDATE users SET national_id = $1, updated_at = NOW() WHERE id = $2',
      [encryptedNid, targetUserId],
    );
    console.log(`[ok] users.national_id rotated — ${updRes.rowCount} row updated`);

    await client.query('COMMIT');
    console.log('');
    console.log('============================================================');
    console.log(`✅ Reset complete for ${TARGET_EMAIL}`);
    console.log(`   New National ID (UNENCRYPTED, for Amna): ${NEW_NATIONAL_ID}`);
    console.log('============================================================');
    console.log('');
    console.log('Amna should now:');
    console.log(`  1. Login as ${TARGET_EMAIL} / A123123a@ (same password)`);
    console.log('  2. Run a single-course learner journey');
    console.log(`  3. Run NELC validator with NID: ${NEW_NATIONAL_ID}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[FAIL] Rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
