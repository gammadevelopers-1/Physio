import { db } from './index';
import { users, userRoles, roles } from './schema';
import { eq, isNull, and, sql } from 'drizzle-orm';

/**
 * Assign auto-generated SCFHS registration numbers to existing students
 * who don't have one. Format: PG-YYYY-NNNNN (e.g., PG-2026-00001)
 *
 * Run: npx ts-node src/database/seed-scfhs-numbers.ts
 * Or inside Docker: docker exec physio-backend npx ts-node src/database/seed-scfhs-numbers.ts
 */
async function seedScfhsNumbers() {
  console.log('Assigning SCFHS registration numbers to existing students...\n');

  // Find the STUDENT role ID
  const [studentRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, 'STUDENT'))
    .limit(1);

  if (!studentRole) {
    console.error('STUDENT role not found. Run db:seed:roles first.');
    process.exit(1);
  }

  // Get all users with STUDENT role who have no scfhsNumber
  const studentsWithoutNumber = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(userRoles, eq(users.id, userRoles.userId))
    .where(
      and(
        eq(userRoles.roleId, studentRole.id),
        sql`(${users.scfhsNumber} IS NULL OR ${users.scfhsNumber} = '')`,
      ),
    )
    .orderBy(users.createdAt);

  if (studentsWithoutNumber.length === 0) {
    console.log('All students already have an SCFHS registration number.');
    return;
  }

  console.log(`Found ${studentsWithoutNumber.length} student(s) without a registration number.\n`);

  // Get the current highest PG-number to continue from
  const year = new Date().getFullYear();
  const prefix = `PG-${year}-`;

  const [existing] = await db
    .select({ scfhsNumber: users.scfhsNumber })
    .from(users)
    .where(sql`${users.scfhsNumber} LIKE ${prefix + '%'}`)
    .orderBy(sql`${users.scfhsNumber} DESC`)
    .limit(1);

  let counter = 1;
  if (existing?.scfhsNumber) {
    const num = parseInt(existing.scfhsNumber.replace(prefix, ''), 10);
    if (!isNaN(num)) counter = num + 1;
  }

  // Assign numbers
  for (const student of studentsWithoutNumber) {
    const regNumber = `${prefix}${String(counter).padStart(5, '0')}`;
    await db
      .update(users)
      .set({ scfhsNumber: regNumber, updatedAt: new Date() })
      .where(eq(users.id, student.id));

    const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email;
    console.log(`  ✓ ${name} → ${regNumber}`);
    counter++;
  }

  console.log(`\nDone! Assigned ${studentsWithoutNumber.length} registration number(s).`);
}

// Run if executed directly
if (require.main === module) {
  seedScfhsNumbers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

export { seedScfhsNumbers };
