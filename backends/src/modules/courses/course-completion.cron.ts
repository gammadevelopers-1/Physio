import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { eq, and, lte, isNotNull, count } from 'drizzle-orm';
import { db } from '../../database';
import { courses, enrollments, NELC_EVENT_TYPE, COURSE_STATUS } from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';

/**
 * Auto-END-date sweep for courses.
 *
 * Runs daily at midnight. Finds `active` courses whose endDate has passed
 * and flips them to `ended` — a transitional state that means "done
 * teaching, awaiting manager review". NO downstream fanout fires here:
 * certificate requests, CME/CPD points, xAPI course-completed statements,
 * and student reviews all stay locked until a manager or admin explicitly
 * clicks Mark Completed (which calls CoursesService.complete()).
 *
 * Rationale (Amna spec, 2026-07): the previous behavior auto-fanned out
 * irreversible compliance artefacts the second the calendar rolled past
 * the end date, which meant a course that still needed grading, review,
 * or a rescheduled make-up session was already stamped completed with
 * certificates issued. Deferring to a manual click gives ownership of
 * the compliance timing to the people who actually run the course.
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
    if (isCronExternalized('courses.completion')) return;
    this.logger.log('Running course end-date sweep (active → ended)...');

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
            eq(courses.status, COURSE_STATUS.ACTIVE),
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
          // Flip status → ended. No enrolment finalization here — those
          // stay `active` so students can still open the course to review
          // material they paid for. The manager's Mark Completed click
          // is what finalizes enrolments + fires certificate + CME fanout.
          await db
            .update(courses)
            .set({ status: COURSE_STATUS.ENDED, updatedAt: new Date() })
            .where(eq(courses.id, course.id));

          // Head-count of learners still enrolled — used only for the
          // notification copy ("N enrolments awaiting completion").
          const [enrolCount] = await db
            .select({ c: count() })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.courseId, course.id),
                eq(enrollments.status, 'active'),
              ),
            );
          const enrolments = Number(enrolCount?.c || 0);

          // NELC audit — records the transition (not a completion event).
          await this.auditService.log({
            eventType: NELC_EVENT_TYPE.COURSE_ENDED_AUTO,
            entityType: 'course',
            entityId: course.id,
            userId: 'system',
            metadata: {
              courseTitle: course.title,
              trigger: 'end_date_reached',
              activeEnrolments: enrolments,
            },
          });

          // Notify manager (primary owner of the Mark Completed action)
          // — link straight to the course detail so one click gets them
          // to the button.
          if (course.managerId) {
            await this.notificationsService.create({
              recipientId: course.managerId,
              type: 'course_ended_needs_review',
              title: 'Course Ended — Ready for Review',
              message: `Course "${course.title}" reached its end date. ${enrolments} enrolment(s) are waiting — click Mark Completed to unlock certificates and CME awards.`,
              titleKey: 'notifications.types.course_ended_needs_review.title',
              messageKey: 'notifications.types.course_ended_needs_review.messageManager',
              messageParams: { courseTitle: course.title, count: enrolments },
              link: `/dashboard/manager/courses/${course.id}`,
              entityType: 'course',
              entityId: course.id,
            });
          }

          // Notify instructor as an FYI — instructors don't own the
          // Mark Completed action but do want to know the calendar rolled
          // past their teaching window.
          if (course.instructorId) {
            await this.notificationsService.create({
              recipientId: course.instructorId,
              type: 'course_ended_needs_review',
              title: 'Course Ended',
              message: `Your course "${course.title}" reached its end date. A manager will mark it completed to release certificates.`,
              titleKey: 'notifications.types.course_ended_needs_review.title',
              messageKey: 'notifications.types.course_ended_needs_review.messageInstructor',
              messageParams: { courseTitle: course.title, count: enrolments },
              link: '/dashboard/instructor/courses',
              entityType: 'course',
              entityId: course.id,
            });
          }

          this.logger.log(
            `Ended course "${course.title}" (${course.id}) — ${enrolments} enrolment(s) awaiting manager Mark Completed`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to end course ${course.id}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Course end-date sweep failed: ${(error as Error).message}`,
      );
    }
  }
}
