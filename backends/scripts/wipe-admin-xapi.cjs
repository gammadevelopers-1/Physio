/* =========================================================================
 * One-shot wipe of super-admin login statements + provider-trigger
 * statements that polluted the transmission log during deploy/testing.
 *
 *   - super-admin logins:  actor_user_id = nelc.platform@gmail.com.id
 *   - provider triggers:    actor_user_id IS NULL (emitProviderJoined /
 *                           emitProviderLeft set actor_user_id = null)
 *
 * Does NOT touch any learner statement. Run via cloud-sql-proxy.
 * ========================================================================= */

'use strict';

const { Client } = require('pg');

const ADMIN_EMAIL = 'nelc.platform@gmail.com';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL env var is required');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('[ok] Connected to DB');

  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [ADMIN_EMAIL],
    );
    const adminId = userRes.rowCount > 0 ? userRes.rows[0].id : null;
    if (adminId) {
      console.log(`[ok] Super-admin user_id = ${adminId}`);
    } else {
      console.log(`[warn] ${ADMIN_EMAIL} not found — skipping admin login wipe`);
    }

    // Show counts BEFORE so we can sanity-check the deletes
    const before = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE actor_user_id = $1) AS admin_logins,
         COUNT(*) FILTER (WHERE actor_user_id IS NULL) AS provider_triggers,
         COUNT(*) AS total
       FROM xapi_statements`,
      [adminId],
    );
    console.log('[before]', before.rows[0]);

    if (adminId) {
      const r = await client.query(
        'DELETE FROM xapi_statements WHERE actor_user_id = $1',
        [adminId],
      );
      console.log(`[ok] Admin login statements deleted: ${r.rowCount}`);
    }

    const t = await client.query(
      'DELETE FROM xapi_statements WHERE actor_user_id IS NULL',
    );
    console.log(`[ok] Provider-trigger statements deleted: ${t.rowCount}`);

    const after = await client.query(
      'SELECT COUNT(*) AS total FROM xapi_statements',
    );
    console.log('[after] total remaining:', after.rows[0].total);

    await client.query('COMMIT');
    console.log('');
    console.log('✅ Admin / provider-trigger statements wiped.');
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
