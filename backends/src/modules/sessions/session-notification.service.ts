import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database';
import {
  enrollments,
  users,
  courses,
} from '../../database/schema';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';

type SessionEventType =
  | 'session_scheduled'
  | 'session_started'
  | 'session_ended'
  | 'session_cancelled'
  | 'session_rescheduled';

interface SessionContext {
  id: string;
  title: string;
  courseId: string;
  zoomLink: string | null;
  scheduledAt?: Date | string | null;
  type?: string | null;
}

interface EventConfigEntry {
  title: string;
  messageFn: (sessionTitle: string, extra?: string) => string;
}

const EVENT_CONFIG: Record<SessionEventType, { en: EventConfigEntry; ar: EventConfigEntry }> = {
  session_scheduled: {
    en: {
      title: 'New Lecture Scheduled',
      messageFn: (t, extra) =>
        extra
          ? `A new lecture "${t}" has been scheduled for ${extra}.`
          : `A new lecture "${t}" has been scheduled.`,
    },
    ar: {
      title: 'تمت جدولة محاضرة جديدة',
      messageFn: (t, extra) =>
        extra
          ? `تمت جدولة محاضرة جديدة "${t}" في ${extra}.`
          : `تمت جدولة محاضرة جديدة "${t}".`,
    },
  },
  session_started: {
    en: {
      title: 'Lecture Started',
      messageFn: (t) => `"${t}" is now live. Join now!`,
    },
    ar: {
      title: 'بدأت المحاضرة',
      messageFn: (t) => `"${t}" مباشرة الآن. انضم الآن!`,
    },
  },
  session_ended: {
    en: {
      title: 'Lecture Ended',
      messageFn: (t) => `"${t}" has ended.`,
    },
    ar: {
      title: 'انتهت المحاضرة',
      messageFn: (t) => `"${t}" انتهت.`,
    },
  },
  session_cancelled: {
    en: {
      title: 'Lecture Cancelled',
      messageFn: (t) => `"${t}" has been cancelled.`,
    },
    ar: {
      title: 'تم إلغاء المحاضرة',
      messageFn: (t) => `تم إلغاء "${t}".`,
    },
  },
  session_rescheduled: {
    en: {
      title: 'Lecture Rescheduled',
      messageFn: (t) => `"${t}" has been rescheduled.`,
    },
    ar: {
      title: 'تمت إعادة جدولة المحاضرة',
      messageFn: (t) => `تمت إعادة جدولة "${t}".`,
    },
  },
};

@Injectable()
export class SessionNotificationService {
  private readonly logger = new Logger(SessionNotificationService.name);

  constructor(
    private readonly userNotificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Notify all enrolled students about a session lifecycle event.
   * Fire-and-forget — caller uses .catch(() => {}).
   */
  async notifySessionEvent(
    session: SessionContext,
    eventType: SessionEventType,
    extraContext?: { cancelReason?: string },
  ) {
    try {
      // 1. Get course name
      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, session.courseId))
        .limit(1);

      const courseName = course?.title || 'Unknown Course';

      // 2. Get enrolled students
      const enrolledStudents = await db
        .select({
          studentId: enrollments.studentId,
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

      if (enrolledStudents.length === 0) {
        this.logger.log(
          `No enrolled students for session "${session.title}" — skipping notifications`,
        );
        return;
      }

      const config = EVENT_CONFIG[eventType];

      // Format scheduled date for messages
      const scheduledDateStr = session.scheduledAt
        ? new Date(session.scheduledAt).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : '';

      // 3. In-app notifications — group by language for localized messages
      const enIds = enrolledStudents
        .filter((s) => (s.language || 'en') !== 'ar')
        .map((s) => s.studentId);
      const arIds = enrolledStudents
        .filter((s) => s.language === 'ar')
        .map((s) => s.studentId);

      const bulkPromises: Promise<void>[] = [];
      for (const [lang, ids] of [['en', enIds], ['ar', arIds]] as const) {
        if (ids.length === 0) continue;
        const localized = config[lang];
        bulkPromises.push(
          this.userNotificationsService.createBulk(ids, {
            type: eventType,
            title: localized.title,
            message: localized.messageFn(session.title, scheduledDateStr),
            link: `/dashboard/student/courses/${session.courseId}`,
            entityType: 'session',
            entityId: session.id,
          }),
        );
      }
      await Promise.all(bulkPromises);

      // 4. Email notifications (fire-and-forget per student)
      for (const student of enrolledStudents) {
        const recipientName =
          `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
          student.email;

        const emailParams = {
          recipientName,
          sessionTitle: session.title,
          courseName,
        };

        const locale = (student.language || 'en') as 'en' | 'ar';

        switch (eventType) {
          case 'session_scheduled':
            this.emailService
              .sendSessionScheduled(student.email, {
                ...emailParams,
                scheduledDate: scheduledDateStr,
                sessionType: session.type || 'zoom',
                zoomLink: session.zoomLink,
              }, locale)
              .catch(() => {});
            break;
          case 'session_started':
            this.emailService
              .sendSessionStarted(student.email, {
                ...emailParams,
                zoomLink: session.zoomLink,
              }, locale)
              .catch(() => {});
            break;
          case 'session_ended':
            this.emailService
              .sendSessionEnded(student.email, emailParams, locale)
              .catch(() => {});
            break;
          case 'session_cancelled':
            this.emailService
              .sendSessionCancelled(student.email, {
                ...emailParams,
                cancelReason: extraContext?.cancelReason || null,
              }, locale)
              .catch(() => {});
            break;
          case 'session_rescheduled':
            this.emailService
              .sendSessionScheduled(student.email, {
                ...emailParams,
                isRescheduled: true,
              } as any, locale)
              .catch(() => {});
            break;
        }
      }

      this.logger.log(
        `Sent ${eventType} notifications to ${enrolledStudents.length} student(s) for "${session.title}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${eventType} notifications for session "${session.title}"`,
        error,
      );
    }
  }
}
