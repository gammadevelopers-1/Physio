// ===========================================
// Database Seeds - Admin User + Roles
// ===========================================
// Run with: npm run db:seed
// Idempotent: safe to run multiple times
// ===========================================

import { db, pool } from '../index';
import { users, roles, userRoles } from '../schema';
import { seedRoles } from '../seed-roles';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';

const ADMIN_EMAIL = 'admin@physioguidance.org';
const ADMIN_PASSWORD = 'Admin123!';

async function seed() {
  console.log('Seeding database...');

  try {
    // Step 1: Seed all roles (idempotent via onConflictDoNothing)
    await seedRoles();

    // Step 2: Seed admin user
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, ADMIN_EMAIL))
      .limit(1);

    if (existing) {
      console.log(`Admin user already exists (${ADMIN_EMAIL}), skipping`);
    } else {
      const passwordHash = await argon2.hash(ADMIN_PASSWORD);

      const [admin] = await db
        .insert(users)
        .values({
          email: ADMIN_EMAIL,
          passwordHash,
          firstName: 'System',
          lastName: 'Admin',
          activeRole: 'ADMIN',
          isActive: true,
          isVerified: true,
        })
        .returning({ id: users.id });

      // Get ADMIN role
      const [adminRole] = await db
        .select()
        .from(roles)
        .where(eq(roles.name, 'ADMIN'))
        .limit(1);

      if (adminRole) {
        await db.insert(userRoles).values({
          userId: admin.id,
          roleId: adminRole.id,
        });
        console.log(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
      }
    }

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
