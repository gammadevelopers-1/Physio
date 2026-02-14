import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Schema location
  schema: './src/database/schema/index.ts',

  // Migrations output directory
  out: './src/database/migrations',

  // Database dialect
  dialect: 'postgresql',

  // Database connection
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DATABASE_HOST || 'localhost',
        port: Number(process.env.DATABASE_PORT) || 5432,
        user: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'postgres',
        database: process.env.DATABASE_NAME || 'physioguidance',
        ssl: false,
      },

  // Verbose logging
  verbose: true,

  // Strict mode
  strict: true,
});
