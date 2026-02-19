import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, and, or, isNull, gte, lte } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  courses,
  users,
  enrollments,
  SESSION_STATUS,
  SESSION_TYPE,
} from '../../database/schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class SessionReminderService {
  private readonly logger = new Logger(SessionReminderService.name);

  constructor(private readonly emailService: EmailService) {}

  /**
   * Runs every minute. Finds Zoom/hybrid sessions starting within
   * the next 4–6 minutes that haven't had reminders sent yet,
   * and sends email notifications to the instructor + enrolled students.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingSessionsAndNotify() {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 4 * 60 * 1000); // 4 min from now
      const windowEnd = new Date(now.getTime() + 6 * 60 * 1000); // 6 min from now

      // Find scheduled Zoom/hybrid sessions starting in ~5 minutes with no reminder sent
      const upcomingSessions = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          type: sessions.type,
          scheduledAt: sessions.scheduledAt,
          durationMinutes: sessions.durationMinutes,
          zoomLink: sessions.zoomLink,
          courseId: sessions.courseId,
          instructorId: sessions.instructorId,
          courseName: courses.title,
        })
        .from(sessions)
        .innerJoin(courses, eq(sessions.courseId, courses.id))
        .where(
          and(
            eq(sessions.status, SESSION_STATUS.SCHEDULED),
            isNull(sessions.reminderSentAt),
            gte(sessions.scheduledAt, windowStart),
            lte(sessions.scheduledAt, windowEnd),
            or(
              eq(sessions.type, SESSION_TYPE.ZOOM),
              eq(sessions.type, SESSION_TYPE.HYBRID),
            ),
          ),
        );

      if (upcomingSessions.length === 0) return;

      this.logger.log(
        `Found ${upcomingSessions.length} session(s) needing reminders`,
      );

      for (const session of upcomingSessions) {
        await this.sendRemindersForSession(session);

        // Mark reminder as sent
        await db
          .update(sessions)
          .set({ reminderSentAt: new Date() })
          .where(eq(sessions.id, session.id));
      }
    } catch (error) {
      this.logger.error('Session reminder cron failed', error);
    }
  }

  private async sendRemindersForSession(session: {
    id: string;
    title: string;
    type: string;
    scheduledAt: Date;
    durationMinutes: number;
    zoomLink: string | null;
    courseId: string;
    instructorId: string;
    courseName: string;
  }) {
    const scheduledAt = session.scheduledAt.toISOString();

    // 1. Get instructor details
    const [instructor] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, session.instructorId))
      .limit(1);

    if (instructor) {
      const instructorName =
        `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() ||
        instructor.email;

      await this.emailService.sendSessionReminder(instructor.email, {
        recipientName: instructorName,
        sessionTitle: session.title,
        courseName: session.courseName,
        scheduledAt,
        durationMinutes: session.durationMinutes,
        zoomLink: session.zoomLink,
        isInstructor: true,
      });
    }

    // 2. Get all actively enrolled students for this course
    const enrolledStudents = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(
        and(
          eq(enrollments.courseId, session.courseId),
          eq(enrollments.status, 'active'),
        ),
      );

    this.logger.log(
      `Sending reminders for "${session.title}": 1 instructor + ${enrolledStudents.length} student(s)`,
    );

    // 3. Send to each student
    for (const student of enrolledStudents) {
      const studentName =
        `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
        student.email;

      await this.emailService.sendSessionReminder(student.email, {
        recipientName: studentName,
        sessionTitle: session.title,
        courseName: session.courseName,
        scheduledAt,
        durationMinutes: session.durationMinutes,
        zoomLink: session.zoomLink,
        isInstructor: false,
      });
    }
  }
}
