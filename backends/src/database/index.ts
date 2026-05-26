import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Create PostgreSQL connection pool
// Use DATABASE_URL if available (production), otherwise individual vars (local dev)
// max: dashboard endpoints fan out to ~10 parallel queries each — single user
// can saturate a small pool. Allow override via DB_POOL_MAX for capacity tuning.
const POOL_MAX = Number(process.env.DB_POOL_MAX) || 25;

// keepAlive prevents NAT/firewall timeouts from silently killing idle
// connections. Without it, the first query after a stale period throws
// "Failed query" with no PG-level cause (connection severed mid-query) —
// classic Cloud Run + Cloud SQL flake under low traffic.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      max: POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT) || 5432,
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'physioguidance',
      max: POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

const pool = new Pool(poolConfig);

// Surface pool errors instead of swallowing them — without this, a dropped idle
// connection can crash the process or leave the pool in an unexplained bad state.
pool.on('error', (err) => {
  console.error('[pg pool] idle client error:', err.message);
});

// ── Retry-once-on-transient ──────────────────────────────────────────
// Wrap pool.query so a single read that hits a transient failure
// (dropped connection, brief connection-limit blip, idle-killed
// socket) gets one automatic retry instead of bubbling up as a
// "Failed query" 500 to the user. Drizzle uses this query() under the
// hood, so all ORM reads inherit the retry.
//
// We only retry on a known-transient error code/message set — never
// retry on real SQL errors (unique violation, FK, syntax), since
// those are deterministic and retrying would just waste a roundtrip.
//
// Reads-only: pg `Pool.query` is used for both reads and writes, but
// retrying a write that *might* have committed before the error is
// unsafe. We narrow retries to SELECT statements only.
const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '53300', // too_many_connections
]);
const TRANSIENT_PATTERN =
  /Connection terminated|connection terminated unexpectedly|connection ended|socket closed|read ECONNRESET|getaddrinfo|too many connections|server closed the connection/i;

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code && TRANSIENT_CODES.has(e.code)) return true;
  if (e.message && TRANSIENT_PATTERN.test(e.message)) return true;
  return false;
}

const originalQuery = pool.query.bind(pool);
(pool as unknown as { query: (...a: unknown[]) => unknown }).query = async function (
  ...args: unknown[]
) {
  try {
    return await (originalQuery as (...a: unknown[]) => Promise<unknown>)(...args);
  } catch (err) {
    if (!isTransient(err)) throw err;
    const sql =
      typeof args[0] === 'string'
        ? args[0]
        : ((args[0] as { text?: string })?.text ?? '');
    // Only retry reads — never writes (already-committed write would dupe).
    if (!/^\s*(select|with)\b/i.test(String(sql))) throw err;
    console.warn(
      `[pg pool] transient error on read — retrying once: ${(err as Error).message}`,
    );
    return await (originalQuery as (...a: unknown[]) => Promise<unknown>)(...args);
  }
};

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export pool for raw queries if needed
export { pool };

// Export schema for use in other files
export * from './schema';

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}
