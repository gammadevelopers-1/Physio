import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { db } from '../../database';
import { courses, enrollments, NELC_EVENT_TYPE } from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';

/**
 * Auto-completes courses whose end date has passed.
 * Runs daily at midnight. Finalizes all active enrollments
 * and generates reports based on submitted work up to that point.
 */
@Injectable()
export class CourseCompletionCronService {
  private readonly logger = new Logger(CourseCompletionCronService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly notificationsService: UserNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoCompletePastEndDate(): Promise<void> {
    this.logger.log('Running course auto-completion cron...');

    try {
      // Find active courses whose endDate has passed
      const expiredCourses = await db
        .select({
          id: courses.id,
          title: courses.title,
          instructorId: courses.instructorId,
          managerId: courses.managerId,
        })
        .from(courses)
        .where(
          and(
            eq(courses.status, 'active'),
            isNotNull(courses.endDate),
            lte(courses.endDate, new Date().toISOString().split('T')[0]),
          ),
        );

      if (expiredCourses.length === 0) {
        this.logger.log('No expired courses found');
        return;
      }

      for (const course of expiredCourses) {
        try {
          // Mark course as completed
          await db
            .update(courses)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(eq(courses.id, course.id));

          // Finalize all active enrollments
          const finalized = await db
            .update(enrollments)
            .set({
              status: 'completed',
              completedAt: new Date(),
            })
            .where(
              and(
                eq(enrollments.courseId, course.id),
                eq(enrollments.status, 'active'),
              ),
            )
            .returning({ id: enrollments.id });

          // Audit log
          await this.auditService.log({
            eventType: NELC_EVENT_TYPE.COURSE_DEACTIVATED,
            entityType: 'course',
            entityId: course.id,
            userId: 'system',
            metadata: {
              courseTitle: course.title,
              action: 'auto_completed_end_date',
              finalizedEnrollments: finalized.length,
            },
          });

          // Notify instructor
          if (course.instructorId) {
            await this.notificationsService.create({
              recipientId: course.instructorId,
              type: 'course_auto_completed',
              title: 'Course Auto-Completed',
              message: `Your course "${course.title}" has been automatically completed as the end date has passed. ${finalized.length} enrollment(s) were finalized.`,
              link: '/dashboard/instructor/courses',
              entityType: 'course',
              entityId: course.id,
            });
          }

          // Notify manager
          if (course.managerId) {
            await this.notificationsService.create({
              recipientId: course.managerId,
              type: 'course_auto_completed',
              title: 'Course Auto-Completed',
              message: `Course "${course.title}" has been automatically completed (end date reached). ${finalized.length} enrollment(s) were finalized.`,
              link: '/dashboard/manager/courses',
              entityType: 'course',
              entityId: course.id,
            });
          }

          this.logger.log(
            `Auto-completed course "${course.title}" (${course.id}): ${finalized.length} enrollments finalized`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to auto-complete course ${course.id}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Course auto-completion cron failed: ${(error as Error).message}`,
      );
    }
  }
}
