import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { db } from '../../database';
import { courses, enrollments, users, NELC_EVENT_TYPE } from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { CertificatesService } from '../certificates/certificates.service';

/**
 * Auto-completes courses whose end date has passed.
 * Runs daily at midnight. Finalizes all active enrollments,
 * creates certificate requests, and notifies instructor + manager.
 */
@Injectable()
export class CourseCompletionCronService {
  private readonly logger = new Logger(CourseCompletionCronService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly notificationsService: UserNotificationsService,
    private readonly certificatesService: CertificatesService,
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

          // Get active students before finalizing
          const activeStudents = await db
            .select({ id: enrollments.id, studentId: enrollments.studentId })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.courseId, course.id),
                eq(enrollments.status, 'active'),
              ),
            );

          // Finalize all active enrollments
          if (activeStudents.length > 0) {
            await db
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
              );

            // Auto-create certificate requests for all students
            for (const student of activeStudents) {
              try {
                await this.certificatesService.createRequest(course.id, student.studentId, true);
              } catch {
                // Skip duplicates silently
              }
            }
          }

          // Audit log
          await this.auditService.log({
            eventType: NELC_EVENT_TYPE.COURSE_DEACTIVATED,
            entityType: 'course',
            entityId: course.id,
            userId: 'system',
            metadata: {
              courseTitle: course.title,
              action: 'auto_completed_end_date',
              finalizedEnrollments: activeStudents.length,
            },
          });

          // Notify instructor
          if (course.instructorId) {
            const [instructor] = await db
              .select({ language: users.language })
              .from(users)
              .where(eq(users.id, course.instructorId))
              .limit(1);
            const iIsAr = instructor?.language === 'ar';
            await this.notificationsService.create({
              recipientId: course.instructorId,
              type: 'course_auto_completed',
              title: iIsAr ? 'اكتملت الدورة تلقائياً' : 'Course Auto-Completed',
              message: iIsAr
                ? `تم إكمال دورتك "${course.title}" تلقائياً بعد انتهاء تاريخ الانتهاء. تم إنهاء ${activeStudents.length} تسجيل(ات).`
                : `Your course "${course.title}" has been automatically completed as the end date has passed. ${activeStudents.length} enrollment(s) were finalized.`,
              link: '/dashboard/instructor/courses',
              entityType: 'course',
              entityId: course.id,
            });
          }

          // Notify manager
          if (course.managerId) {
            const [manager] = await db
              .select({ language: users.language })
              .from(users)
              .where(eq(users.id, course.managerId))
              .limit(1);
            const mIsAr = manager?.language === 'ar';
            await this.notificationsService.create({
              recipientId: course.managerId,
              type: 'course_auto_completed',
              title: mIsAr ? 'اكتملت الدورة تلقائياً' : 'Course Auto-Completed',
              message: mIsAr
                ? `تم إكمال الدورة "${course.title}" تلقائياً (تم الوصول لتاريخ الانتهاء). تم إنهاء ${activeStudents.length} تسجيل(ات).`
                : `Course "${course.title}" has been automatically completed (end date reached). ${activeStudents.length} enrollment(s) were finalized.`,
              link: '/dashboard/manager/courses',
              entityType: 'course',
              entityId: course.id,
            });
          }

          this.logger.log(
            `Auto-completed course "${course.title}" (${course.id}): ${activeStudents.length} enrollments finalized`,
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
