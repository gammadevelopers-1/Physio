/**
 * One-shot script to seed 30 test reviews for a single course.
 * Creates 30 fake students with completed enrollments and a review each.
 * All seeded rows are marked with email prefix `seed-review-` and a tagged
 * suffix in reviewText so they can be cleanly removed later.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx src/seed-test-reviews.ts <courseId>
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import {
  users,
  enrollments,
  courseRatings,
  roles,
  userRoles,
  courses,
} from './database/schema';

const SEED_TAG = '[SEED_TEST_REVIEW]';

const FIRST_NAMES = [
  ['Ahmed', 'أحمد'], ['Mohammed', 'محمد'], ['Sara', 'سارة'], ['Fatima', 'فاطمة'],
  ['Omar', 'عمر'], ['Layla', 'ليلى'], ['Khalid', 'خالد'], ['Noura', 'نورة'],
  ['Yousef', 'يوسف'], ['Amina', 'أمينة'], ['Hassan', 'حسن'], ['Mariam', 'مريم'],
  ['Abdullah', 'عبدالله'], ['Aisha', 'عائشة'], ['Faisal', 'فيصل'], ['Reem', 'ريم'],
  ['Sami', 'سامي'], ['Huda', 'هدى'], ['Tariq', 'طارق'], ['Salma', 'سلمى'],
  ['Nasser', 'ناصر'], ['Lina', 'لينا'], ['Bandar', 'بندر'], ['Maha', 'مها'],
  ['Sultan', 'سلطان'], ['Rana', 'رنا'], ['Saud', 'سعود'], ['Hala', 'هلا'],
  ['Mansour', 'منصور'], ['Dalia', 'داليا'],
];

const LAST_NAMES = [
  ['Al-Saud', 'آل سعود'], ['Al-Otaibi', 'العتيبي'], ['Al-Qahtani', 'القحطاني'],
  ['Al-Harbi', 'الحربي'], ['Al-Ghamdi', 'الغامدي'], ['Al-Zahrani', 'الزهراني'],
  ['Al-Dossary', 'الدوسري'], ['Al-Shahrani', 'الشهراني'], ['Al-Mutairi', 'المطيري'],
  ['Al-Anazi', 'العنزي'], ['Al-Rashid', 'الراشد'], ['Al-Mansour', 'المنصور'],
];

const REVIEW_TEMPLATES_EN = [
  'Excellent course! The instructor explained everything clearly and the content was very practical.',
  'Really helpful for my work in clinical settings. Highly recommended.',
  'Great learning experience. The case studies were especially valuable.',
  'Well-structured and easy to follow. Earned my CME hours without hassle.',
  'Comprehensive coverage of the topic. I learned a lot in a short time.',
  'The lectures were engaging and the material was up-to-date.',
  'Useful refresher on essential skills. Would take more courses from this instructor.',
  'Solid course content. The Zoom sessions were well-organized.',
  'Loved the interactive elements. Made the material stick.',
  'Good balance of theory and practice. The quizzes helped reinforce key concepts.',
  'The materials were excellent. Some sections could be expanded.',
  'I appreciated how concise yet thorough the lessons were.',
  'Met my expectations completely. Worth the time invested.',
  'Helpful for accreditation purposes. The certificate process was smooth.',
];

const REVIEW_TEMPLATES_AR = [
  'دورة ممتازة! المدرب شرح كل شيء بوضوح والمحتوى عملي جداً.',
  'مفيدة جداً لعملي في البيئة السريرية. أنصح بها بشدة.',
  'تجربة تعلم رائعة. الدراسات الحالة كانت ذات قيمة كبيرة.',
  'منظمة بشكل جيد وسهلة المتابعة. حصلت على ساعات CME دون عناء.',
  'تغطية شاملة للموضوع. تعلمت الكثير في وقت قصير.',
  'المحاضرات كانت ممتعة والمواد محدثة.',
  'مراجعة مفيدة للمهارات الأساسية. سأشارك في دورات أخرى لهذا المدرب.',
  'محتوى الدورة قوي. جلسات Zoom كانت منظمة.',
  'أحببت العناصر التفاعلية. جعلت المادة تترسخ في الذهن.',
  'توازن جيد بين النظرية والتطبيق. الاختبارات ساعدت على تعزيز المفاهيم.',
];

// Weighted distribution: more 4s and 5s, some 3s, few 2s, very few 1s
const RATING_WEIGHTS: Array<[number, number]> = [
  [5, 50], [4, 30], [3, 12], [2, 6], [1, 2],
];

function pickWeighted<T>(items: Array<[T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[0][0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const courseId = process.argv[2];
  if (!courseId) {
    console.error('Usage: tsx src/seed-test-reviews.ts <courseId>');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL env var required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  // Confirm course exists
  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) {
    console.error(`Course ${courseId} not found`);
    process.exit(1);
  }
  console.log(`Seeding 30 reviews for course: "${course.title}" (${course.id})`);

  // Get STUDENT role id
  const [studentRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, 'STUDENT'))
    .limit(1);
  if (!studentRole) {
    console.error('STUDENT role not found in roles table');
    process.exit(1);
  }

  // Default password (hashed once for efficiency) — these accounts are test-only
  const passwordHash = await argon2.hash('SeedReviewTest123!');

  let createdCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < 30; i++) {
    const [firstEn, firstAr] = pick(FIRST_NAMES);
    const [lastEn, lastAr] = pick(LAST_NAMES);
    const tag = `${Date.now()}-${i}`;
    const email = `seed-review-${tag}@physioguidance.test`;

    try {
      // 1. Create user
      const [user] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          firstName: firstEn,
          lastName: lastEn,
          firstNameAr: firstAr,
          lastNameAr: lastAr,
          activeRole: 'STUDENT',
          isActive: true,
          isVerified: true,
          twoFactorEnabled: false,
          language: Math.random() > 0.5 ? 'en' : 'ar',
        })
        .returning({ id: users.id });

      // 2. Attach STUDENT role
      await db.insert(userRoles).values({
        userId: user.id,
        roleId: studentRole.id,
      });

      // 3. Completed enrollment (backdated)
      const completedAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000);
      await db.insert(enrollments).values({
        courseId,
        studentId: user.id,
        status: 'completed',
        progress: 100,
        completedAt,
        enrolledAt: new Date(completedAt.getTime() - 30 * 86400000),
      });

      // 4. Review
      const rating = pickWeighted(RATING_WEIGHTS);
      const useArabic = Math.random() < 0.4;
      const baseText = useArabic ? pick(REVIEW_TEMPLATES_AR) : pick(REVIEW_TEMPLATES_EN);
      const includeText = Math.random() > 0.15; // 85% leave text
      const reviewText = includeText ? `${baseText} ${SEED_TAG}` : null;
      // Backdate review createdAt to spread across ~60 days
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000);

      await db.insert(courseRatings).values({
        courseId,
        studentId: user.id,
        rating,
        reviewText,
        createdAt,
        updatedAt: createdAt,
      });

      createdCount++;
      process.stdout.write('.');
    } catch (err) {
      skippedCount++;
      process.stdout.write('x');
      console.error(`\n  failed for ${email}:`, (err as Error).message);
    }
  }

  console.log(`\n\nDone. Created ${createdCount} reviews, skipped ${skippedCount}.`);
  console.log(`\nTo remove all seeded data later:`);
  console.log(`  DELETE FROM course_ratings WHERE review_text LIKE '%${SEED_TAG}%';`);
  console.log(`  DELETE FROM enrollments WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'seed-review-%@physioguidance.test');`);
  console.log(`  DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'seed-review-%@physioguidance.test');`);
  console.log(`  DELETE FROM users WHERE email LIKE 'seed-review-%@physioguidance.test';`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
