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
