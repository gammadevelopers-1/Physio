// ===========================================
// Database Seeds - Test Data
// ===========================================
// Run with: npm run db:seed
// ===========================================

import { db, pool } from '../index';
import * as schema from '../schema';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Add your seed data here
    // Example:
    // await db.insert(schema.users).values([
    //   { email: 'admin@physioguidance.org', name: 'Admin User' },
    //   { email: 'user@example.com', name: 'Test User' },
    // ]);

    // Seed health check table (example)
    await db.insert(schema.healthCheck).values({
      status: 'seeded',
    });

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seed
seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
