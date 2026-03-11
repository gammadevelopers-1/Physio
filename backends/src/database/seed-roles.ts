import { db } from './index';
import { roles, ROLE_NAMES } from './schema';

// Predefined roles with descriptions
const PREDEFINED_ROLES = [
  {
    name: ROLE_NAMES.STUDENT,
    displayName: 'Student',
    description: 'Can access courses, submit assignments, and view learning materials',
  },
  {
    name: ROLE_NAMES.INSTRUCTOR,
    displayName: 'Instructor',
    description: 'Can create and manage courses, grade assignments, and manage students',
  },
  {
    name: ROLE_NAMES.TEACHING_ASSISTANT,
    displayName: 'Teaching Assistant',
    description: 'Can view assigned sessions, attendance, and assessment submissions in read-only mode',
  },
  {
    name: ROLE_NAMES.MANAGER,
    displayName: 'Manager',
    description: 'Can manage instructors, view reports, and oversee departments',
  },
  {
    name: ROLE_NAMES.ADMIN,
    displayName: 'Administrator',
    description: 'Can manage users, system configuration, and access all features',
  },
  {
    name: ROLE_NAMES.FINANCE,
    displayName: 'Finance',
    description: 'Can access financial reports, billing, and payment management',
  },
  {
    name: ROLE_NAMES.SUPPORT,
    displayName: 'Support',
    description: 'Can handle user support tickets and assist with account issues',
  },
  {
    name: ROLE_NAMES.SUPER_ADMIN,
    displayName: 'Super Admin',
    description: 'Full system access with no restrictions',
  },
];

export async function seedRoles() {
  console.log('Seeding roles...');

  for (const role of PREDEFINED_ROLES) {
    try {
      await db
        .insert(roles)
        .values(role)
        .onConflictDoNothing({ target: roles.name });
      console.log(`  ✓ Role "${role.name}" ready`);
    } catch (error) {
      console.error(`  ✗ Failed to seed role "${role.name}":`, error);
    }
  }

  console.log('Roles seeding complete!');
}

// Run if executed directly
if (require.main === module) {
  seedRoles()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
