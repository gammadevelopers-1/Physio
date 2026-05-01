import { Injectable, Logger } from '@nestjs/common';
import { eq, sql, and, desc, isNotNull } from 'drizzle-orm';
import { db } from '../../database';
import {
  users,
  userRoles,
  roles,
  courses,
  courseRatings,
  ROLE_NAMES,
  COURSE_STATUS,
} from '../../database/schema';

@Injectable()
export class PublicStatsService {
  private readonly logger = new Logger(PublicStatsService.name);

  /**
   * Live counts for the home-page stats block.
   *   - totalStudents: distinct users with the STUDENT role assigned, active accounts only
   *   - totalCourses: courses that are public-visible AND active or completed
   *   - totalInstructors: distinct users with the INSTRUCTOR role assigned, active accounts only
   *
   * All three are fast indexed counts (a few ms). Cached on the client via
   * a route-level cache; no need for a Redis layer here.
   */
  async getStats(): Promise<{
    totalStudents: number;
    totalCourses: number;
    totalInstructors: number;
  }> {
    try {
      const [studentRow, courseRow, instructorRow] = await Promise.all([
        db
          .select({ c: sql<number>`COUNT(DISTINCT ${userRoles.userId})` })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .innerJoin(users, eq(userRoles.userId, users.id))
          .where(
            and(
              eq(roles.name, ROLE_NAMES.STUDENT),
              eq(users.isActive, true),
            ),
          ),
        db
          .select({ c: sql<number>`COUNT(*)` })
          .from(courses)
          .where(
            and(
              eq(courses.visibleOnPublicSite, true),
              sql`${courses.status} IN ('${sql.raw(COURSE_STATUS.ACTIVE)}', '${sql.raw(COURSE_STATUS.COMPLETED)}')`,
            ),
          ),
        db
          .select({ c: sql<number>`COUNT(DISTINCT ${userRoles.userId})` })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .innerJoin(users, eq(userRoles.userId, users.id))
          .where(
            and(
              eq(roles.name, ROLE_NAMES.INSTRUCTOR),
              eq(users.isActive, true),
            ),
          ),
      ]);

      return {
        totalStudents: Number(studentRow?.[0]?.c ?? 0),
        totalCourses: Number(courseRow?.[0]?.c ?? 0),
        totalInstructors: Number(instructorRow?.[0]?.c ?? 0),
      };
    } catch (err) {
      this.logger.error('Failed to compute public stats', err);
      return { totalStudents: 0, totalCourses: 0, totalInstructors: 0 };
    }
  }

  /**
   * Recent published student reviews across all courses, for the homepage
   * "Client Reviews" carousel. Same source the course detail page uses,
   * just aggregated.
   */
  async getRecentReviews(limit = 10): Promise<
    Array<{
      id: string;
      rating: number;
      reviewText: string;
      studentName: string;
      studentAvatar: string | null;
      courseTitle: string;
      createdAt: string;
    }>
  > {
    try {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const rows = await db
        .select({
          id: courseRatings.id,
          rating: courseRatings.rating,
          reviewText: courseRatings.reviewText,
          createdAt: courseRatings.createdAt,
          firstName: users.firstName,
          lastName: users.lastName,
          avatar: users.avatar,
          courseTitle: courses.title,
        })
        .from(courseRatings)
        .innerJoin(users, eq(courseRatings.studentId, users.id))
        .innerJoin(courses, eq(courseRatings.courseId, courses.id))
        .where(
          and(
            eq(courseRatings.isPublished, true),
            isNotNull(courseRatings.reviewText),
            sql`length(${courseRatings.reviewText}) > 0`,
          ),
        )
        .orderBy(desc(courseRatings.createdAt))
        .limit(safeLimit);

      return rows.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        reviewText: r.reviewText || '',
        studentName: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Anonymous',
        studentAvatar: r.avatar,
        courseTitle: r.courseTitle,
        createdAt: r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
      }));
    } catch (err) {
      this.logger.error('Failed to fetch recent reviews', err);
      return [];
    }
  }
}
