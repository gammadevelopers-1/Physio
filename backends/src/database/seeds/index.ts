// ===========================================
// Database Seeds - Admin User + Roles
// ===========================================
// Run with: npm run db:seed
// Idempotent: safe to run multiple times
// ===========================================

import { db, pool } from '../index';
import { users, roles, userRoles, pointRules, pointsConfig } from '../schema';
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

    // Step 3: Seed default point rules + singleton points config (idempotent)
    await seedPointsDefaults();

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Idempotent seed for the Points System defaults.
 *
 * - Inserts default earn rules (signup / course_completed / review_approved)
 *   if they don't already exist (uses ON CONFLICT DO NOTHING via existence check)
 * - Inserts singleton points_config row if missing
 *
 * Safe to re-run on every deploy. Existing rules with edited amounts are
 * preserved (we never UPDATE here).
 */
async function seedPointsDefaults() {
  const defaultRules = [
    {
      ruleKey: 'signup',
      pointsAmount: 50,
      maxPerUser: 1,
      description: 'Welcome bonus for new student signup',
      descriptionAr: 'مكافأة ترحيبية للطلاب الجدد',
      expiresAfterDays: 365,
    },
    {
      ruleKey: 'course_completed',
      pointsAmount: 200,
      maxPerUser: null,
      description: 'Reward for completing an enrolled course',
      descriptionAr: 'مكافأة إكمال دورة مسجّل بها',
      expiresAfterDays: 365,
    },
    {
      ruleKey: 'review_approved',
      pointsAmount: 25,
      maxPerUser: null,
      description: 'Reward when your course review is approved by a manager',
      descriptionAr: 'مكافأة عند الموافقة على مراجعتك للدورة',
      expiresAfterDays: 365,
    },
  ];

  for (const rule of defaultRules) {
    const [existing] = await db
      .select({ id: pointRules.id })
      .from(pointRules)
      .where(eq(pointRules.ruleKey, rule.ruleKey))
      .limit(1);
    if (existing) {
      console.log(`Point rule '${rule.ruleKey}' already exists, skipping`);
      continue;
    }
    await db.insert(pointRules).values(rule);
    console.log(`Seeded point rule: ${rule.ruleKey} (${rule.pointsAmount} pts)`);
  }

  const [existingConfig] = await db
    .select({ id: pointsConfig.id })
    .from(pointsConfig)
    .limit(1);
  if (!existingConfig) {
    await db.insert(pointsConfig).values({ id: 1 });
    console.log('Seeded points_config singleton');
  } else {
    console.log('points_config already exists, skipping');
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
