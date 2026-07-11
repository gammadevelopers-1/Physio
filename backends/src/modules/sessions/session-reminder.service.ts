import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { eq, and, or, isNull, gte, lte, sql, isNotNull } from 'drizzle-orm';
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
import { ZOOM_SERVICE, IZoomService } from '../zoom/zoom.interface';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { NELC_EVENT_TYPE } from '../../database/schema';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { SessionNotificationService } from './session-notification.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';

@Injectable()
export class SessionReminderService {
  private readonly logger = new Logger(SessionReminderService.name);

  constructor(
    private readonly emailService: EmailService,
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly auditService: NelcAuditService,
    private readonly auditLogService: AuditLogService,
    private readonly sessionNotificationService: SessionNotificationService,
    private readonly adminSettings: AdminSettingsService,
  ) {}

  /**
   * Runs every minute. Finds Zoom/hybrid sessions starting within
   * the next 4–6 minutes that haven't had reminders sent yet,
   * and sends email notifications to the instructor + enrolled students.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingSessionsAndNotify() {
    if (isCronExternalized('sessions.reminder-notify')) return;
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 4 * 60 * 1000); // 4 min from now
      const windowEnd = new Date(now.getTime() + 6 * 60 * 1000); // 6 min from now

      // Find scheduled Zoom/hybrid sessions starting in ~5 minutes with no reminder sent.
      // Skip sessions whose course has been soft-deleted — the cascade-cancel
      // pass in CoursesService.remove() should have already marked those
      // cancelled, but this is defense-in-depth so a slow cascade doesn't
      // race the cron and email students about a vanishing course.
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
            isNull(courses.deletedAt),
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
    const localeSettings = await this.adminSettings.getPublicLocaleSettings().catch(() => ({
      numberSystem: 'western' as const,
      dateFormat: 'DD-MM-YYYY' as const,
    }));

    // 1. Get instructor details
    const [instructor] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
      })
      .from(users)
      .where(eq(users.id, session.instructorId))
      .limit(1);

    if (instructor) {
      const instructorName =
        `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() ||
        instructor.email;

      const locale = (instructor.language || 'en') as 'en' | 'ar';
      await this.emailService.sendSessionReminder(instructor.email, {
        recipientName: instructorName,
        sessionTitle: session.title,
        courseName: session.courseName,
        scheduledAt,
        durationMinutes: session.durationMinutes,
        zoomLink: session.zoomLink,
        isInstructor: true,
        numberSystem: localeSettings.numberSystem,
      }, locale);
    }

    // 2. Get all actively enrolled students for this course
    const enrolledStudents = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
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

      const studentLocale = (student.language || 'en') as 'en' | 'ar';
      await this.emailService.sendSessionReminder(student.email, {
        recipientName: studentName,
        sessionTitle: session.title,
        courseName: session.courseName,
        scheduledAt,
        durationMinutes: session.durationMinutes,
        zoomLink: session.zoomLink,
        isInstructor: false,
        numberSystem: localeSettings.numberSystem,
      }, studentLocale);
    }
  }

  /**
   * Auto-mark scheduled sessions as 'missed' if 15+ minutes past scheduled time.
   * Runs every 5 minutes.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoMarkMissedSessions() {
    if (isCronExternalized('sessions.mark-missed')) return;
    const GRACE_MINUTES = 15;
    const cutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000);

    const missedSessions = await db
      .select({ id: sessions.id, title: sessions.title, courseId: sessions.courseId })
      .from(sessions)
      .where(
        and(
          eq(sessions.status, SESSION_STATUS.SCHEDULED),
          lte(sessions.scheduledAt, cutoff),
        ),
      );

    if (missedSessions.length === 0) return;

    for (const session of missedSessions) {
      // Soft miss — we update our DB status but leave the Zoom resource
      // alive so the manager can reschedule it without losing existing
      // registrants. The UI hides Register/Copy/WhatsApp/Start-as-Host
      // buttons based on status, so attendees can't accidentally land on
      // a stale registration page through our app.
      await db
        .update(sessions)
        .set({ status: 'missed' as any, updatedAt: new Date() })
        .where(eq(sessions.id, session.id));

      this.logger.warn(`Session "${session.title}" (${session.id}) auto-marked as missed`);
    }

    if (missedSessions.length > 0) {
      this.logger.log(`Auto-marked ${missedSessions.length} session(s) as missed`);
    }
  }

  /**
   * Auto-end live sessions that have exceeded their planned duration.
   * Runs every minute. Uses actualStartedAt + durationMinutes as the cutoff.
   * Also sends a 4-minute warning email to the instructor before auto-ending.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoEndExpiredSessions() {
    if (isCronExternalized('sessions.end-expired')) return;
    try {
      const now = new Date();

      // ── Warning at 90% of duration elapsed (10% remaining) ──
      const warningSessions = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          courseId: sessions.courseId,
          instructorId: sessions.instructorId,
          actualStartedAt: sessions.actualStartedAt,
          durationMinutes: sessions.durationMinutes,
          courseName: courses.title,
        })
        .from(sessions)
        .innerJoin(courses, eq(sessions.courseId, courses.id))
        .where(
          and(
            eq(sessions.status, SESSION_STATUS.LIVE),
            isNotNull(sessions.actualStartedAt),
            isNull(sessions.autoEndWarningSentAt),
            // 90% of duration has elapsed: now >= actualStartedAt + (durationMinutes * 0.9)
            sql`${now} >= ${sessions.actualStartedAt} + (${sessions.durationMinutes} * 0.9 || ' minutes')::interval`,
            // Not yet expired: now < actualStartedAt + durationMinutes
            sql`${now} < ${sessions.actualStartedAt} + (${sessions.durationMinutes} || ' minutes')::interval`,
          ),
        );

      for (const session of warningSessions) {
        // Send warning email to instructor
        const [instructor] = await db
          .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, language: users.language })
          .from(users)
          .where(eq(users.id, session.instructorId))
          .limit(1);

        if (instructor) {
          const name = `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() || instructor.email;
          const instrLocale = (instructor.language || 'en') as 'en' | 'ar';
          await this.emailService.sendGenericNotification(
            instructor.email,
            {
              recipientName: name,
              subject: `Lecture Ending Soon: ${session.title}`,
              message: `Your lecture "${session.title}" (${session.courseName}) will auto-end in approximately ${Math.ceil(session.durationMinutes * 0.1)} minute(s).\n\nIf you need more time, please create a new session after this one ends.`,
            },
            instrLocale,
          ).catch((err) => this.logger.warn(`Failed to send auto-end warning email: ${(err as Error).message}`));
        }

        // Mark warning as sent
        await db
          .update(sessions)
          .set({ autoEndWarningSentAt: new Date() })
          .where(eq(sessions.id, session.id));

        this.logger.log(`Auto-end warning sent for session "${session.title}" (${session.id})`);
      }

      // ── Auto-end: find live sessions past their duration ──
      const expiredSessions = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          courseId: sessions.courseId,
          instructorId: sessions.instructorId,
          type: sessions.type,
          meetingId: sessions.meetingId,
          zoomLink: sessions.zoomLink,
          actualStartedAt: sessions.actualStartedAt,
          durationMinutes: sessions.durationMinutes,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.status, SESSION_STATUS.LIVE),
            isNotNull(sessions.actualStartedAt),
            // actualStartedAt + durationMinutes <= now
            sql`${sessions.actualStartedAt} + (${sessions.durationMinutes} || ' minutes')::interval <= ${now}`,
          ),
        );

      if (expiredSessions.length === 0) return;

      for (const session of expiredSessions) {
        try {
          // 1. End Zoom meeting if applicable
          if (
            session.meetingId &&
            (session.type === SESSION_TYPE.ZOOM || session.type === SESSION_TYPE.HYBRID)
          ) {
            const result = await this.zoomService.endMeeting(session.meetingId);
            if (!result.ended) {
              this.logger.warn(`Zoom meeting ${session.meetingId} could not be ended: ${result.error}`);
            }
          } else if (
            !session.meetingId &&
            session.zoomLink &&
            (session.type === SESSION_TYPE.ZOOM || session.type === SESSION_TYPE.HYBRID)
          ) {
            const extracted = session.zoomLink.match(/\/j\/(\d+)/)?.[1];
            if (extracted) {
              await this.zoomService.endMeeting(extracted);
            }
          }

          // 2. Update session status to ended
          // Use exact planned end time (actualStartedAt + duration), not now(),
          // to avoid cron delay inflating the session duration
          const plannedEnd = new Date(new Date(session.actualStartedAt!).getTime() + session.durationMinutes * 60000);
          const [updated] = await db
            .update(sessions)
            .set({
              status: SESSION_STATUS.ENDED,
              actualEndedAt: plannedEnd,
              updatedAt: new Date(),
            })
            .where(eq(sessions.id, session.id))
            .returning();

          // 3. Audit logs
          await this.auditService.log({
            eventType: NELC_EVENT_TYPE.SESSION_ENDED,
            entityType: 'session',
            entityId: updated.id,
            userId: session.instructorId,
            metadata: {
              sessionId: updated.id,
              courseId: updated.courseId,
              actualStartedAt: session.actualStartedAt,
              actualEndedAt: updated.actualEndedAt,
              autoEnded: true,
            },
          });

          await this.auditLogService.log({
            entityType: 'session',
            entityId: updated.id,
            action: 'session.auto_ended',
            performedBy: session.instructorId,
            metadata: { courseId: updated.courseId, durationMinutes: session.durationMinutes },
            ipAddress: 'system',
          }).catch(() => {});

          // 4. Notify enrolled students
          this.sessionNotificationService
            .notifySessionEvent(updated, 'session_ended')
            .catch(() => {});

          this.logger.log(
            `Auto-ended session "${session.title}" (${session.id}) — exceeded ${session.durationMinutes} min duration`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to auto-end session "${session.title}" (${session.id}): ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Auto-end expired sessions cron failed', error);
    }
  }
}
