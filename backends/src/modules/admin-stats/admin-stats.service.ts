import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  ne,
  notLike,
  sql,
} from 'drizzle-orm';
import { db } from '../../database';
import { users, courses, roles, userRoles } from '../../database/schema';

export interface AdminOverviewStats {
  totalUsers: number;
  totalCourses: number;
  activeToday: number;
}

export interface FilterPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

@Injectable()
export class AdminStatsService {
  /**
   * Sidebar profile-card stats. Cheap aggregate queries — safe to call
   * on every admin page mount.
   */
  async getOverview(): Promise<AdminOverviewStats> {
    // Beginning of today in the server's TZ. Acceptable for a sidebar
    // counter — the discrepancy with Riyadh midnight is at most a few
    // hours and self-corrects.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalUsersResult, totalCoursesResult, activeTodayResult] =
      await Promise.all([
        // Total users — exclude soft-deleted (email rewritten on delete)
        db
          .select({ value: count() })
          .from(users)
          .where(notLike(users.email, 'deleted-%@deleted.local')),
        // Total courses — exclude archived
        db
          .select({ value: count() })
          .from(courses)
          .where(ne(courses.status, 'archived')),
        // Distinct users who logged in today
        db
          .select({
            value: sql<number>`cast(count(distinct ${users.id}) as int)`,
          })
          .from(users)
          .where(
            and(
              isNotNull(users.lastLoginAt),
              gte(users.lastLoginAt, startOfToday),
            ),
          ),
      ]);

    return {
      totalUsers: Number(totalUsersResult[0].value),
      totalCourses: Number(totalCoursesResult[0].value),
      activeToday: Number(activeTodayResult[0].value),
    };
  }

  /**
   * Lightweight list of users who hold the given role(s). Used to
   * populate admin-side filter dropdowns (instructor/manager picker on
   * the admin Courses page). Excludes soft-deleted users. Sorted by
   * first then last name so the dropdown is browseable.
   */
  private async getUsersByRoleNames(roleNames: string[]): Promise<FilterPerson[]> {
    if (roleNames.length === 0) return [];

    // 1. Resolve role names → role IDs
    const roleRows = await db
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.name, roleNames));
    if (roleRows.length === 0) return [];
    const roleIds = roleRows.map((r) => r.id);

    // 2. Distinct users having any of those roles
    const userIdRows = await db
      .selectDistinct({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.roleId, roleIds));
    if (userIdRows.length === 0) return [];
    const userIds = userIdRows.map((r) => r.userId);

    // 3. Fetch the minimal profile fields, exclude soft-deleted
    return db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(
        and(
          inArray(users.id, userIds),
          notLike(users.email, 'deleted-%@deleted.local'),
        ),
      )
      .orderBy(asc(users.firstName), asc(users.lastName));
  }

  async getInstructorsList(): Promise<FilterPerson[]> {
    return this.getUsersByRoleNames(['INSTRUCTOR']);
  }

  async getManagersList(): Promise<FilterPerson[]> {
    return this.getUsersByRoleNames(['MANAGER']);
  }
}
