#!/usr/bin/env node
/**
 * One-shot migration runner for a single hand-written SQL file.
 *
 * Why this exists: the project's drizzle journal is incomplete (stops at
 * 0017), so `drizzle-kit migrate` cannot reliably apply hand-written
 * migrations 0018+. This script bypasses drizzle-kit entirely and runs
 * exactly one .sql file via the pg client. It's intended for surgical
 * application of new tables / additive schema changes whose SQL is itself
 * idempotent (CREATE TABLE IF NOT EXISTS, etc).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node apply-single-migration.cjs <path-to-sql>
 *
 * Exit codes:
 *   0 — applied successfully (or all statements were no-ops on existing schema)
 *   1 — connection failure
 *   2 — SQL execution error
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Usage: node apply-single-migration.cjs <path-to-sql>');
    process.exit(2);
  }

  const absPath = path.resolve(sqlPath);
  if (!fs.existsSync(absPath)) {
    console.error(`SQL file not found: ${absPath}`);
    process.exit(2);
  }

  const sql = fs.readFileSync(absPath, 'utf8');
  console.log(`Loaded SQL from ${absPath} (${sql.length} bytes)`);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL env var is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to database');
  } catch (err) {
    console.error(`Failed to connect: ${err.message}`);
    process.exit(1);
  }

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`Migration failed: ${err.message}`);
    await client.end();
    process.exit(2);
  }

  // Verify: list tables containing the file's basename so the operator can
  // visually confirm the right thing got created.
  const filename = path.basename(absPath, '.sql');
  try {
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name ILIKE $1`,
      [`%${filename.replace(/^\d+_/, '').replace(/_/g, '%')}%`],
    );
    if (rows.length > 0) {
      console.log(`Verified tables matching "${filename}":`);
      for (const r of rows) console.log(`  - ${r.table_name}`);
    } else {
      console.log('(no matching table names found, but the SQL did not error)');
    }
  } catch (err) {
    console.warn(`Verification query failed (non-fatal): ${err.message}`);
  }

  await client.end();
  console.log('Done');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(2);
});
