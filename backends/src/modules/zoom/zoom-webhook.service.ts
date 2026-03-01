import { Injectable, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  attendance,
  attendanceLogs,
  ATTENDANCE_LOG_EVENT,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { matchParticipantToUser, getSessionInstructorId } from './zoom.helpers';

@Injectable()
export class ZoomWebhookService {
  private readonly logger = new Logger(ZoomWebhookService.name);

  constructor(private readonly auditService: NelcAuditService) {}

  /**
   * Handle participant joined event from Zoom webhook.
   * 1. Find session by meetingId
   * 2. Match participant email -> system user (case-insensitive via shared helper)
   * 3. Insert 'join' record in attendance_logs
   * 4. Upsert attendance record (status='present', joinedAt)
   * 5. Audit log
   */
  async handleParticipantJoined(payload: any): Promise<void> {
    const meetingId = String(payload?.meeting?.id || payload?.id || '');
    const participant = payload?.participant || payload;
    const participantEmail = participant?.email || participant?.user_email || '';
    const participantId = participant?.participant_uuid || participant?.user_id || '';

    if (!meetingId) {
      this.logger.warn('participant_joined: no meetingId in payload');
      return;
    }

    // 1. Find session by meetingId
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.meetingId, meetingId))
      .limit(1);

    if (!session) {
      this.logger.warn(`No session found for meetingId: ${meetingId}`);
      return;
    }

    // 2. Match participant to system user (item #5, #9: shared, case-insensitive)
    // Exclude the course instructor (Zoom host) from attendance tracking
    const instructorId = await getSessionInstructorId(session.id);
    const matchedUser = await matchParticipantToUser(participantEmail, instructorId);

    // 3. Insert join log
    await db.insert(attendanceLogs).values({
      sessionId: session.id,
      studentId: matchedUser?.id || null,
      eventType: ATTENDANCE_LOG_EVENT.JOIN,
      timestamp: new Date(),
      zoomParticipantId: participantId,
      zoomUserEmail: participantEmail,
      rawPayload: payload,
    });

    // 4. Upsert attendance record if user matched
    if (matchedUser) {
      await db
        .insert(attendance)
        .values({
          sessionId: session.id,
          studentId: matchedUser.id,
          status: 'present',
          joinedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.studentId],
          set: {
            status: 'present',
            joinedAt: new Date(),
          },
        });

      // 5. Audit log
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ATTENDANCE_ZOOM_JOIN,
        entityType: 'attendance',
        entityId: session.id,
        userId: matchedUser.id,
        metadata: {
          sessionId: session.id,
          meetingId,
          participantEmail,
          participantId,
        },
      });
    } else {
      this.logger.warn(
        `Unmatched Zoom participant: ${participantEmail} in meeting ${meetingId}`,
      );
    }
  }

  /**
   * Handle participant left event from Zoom webhook.
   * 1. Insert 'leave' record in attendance_logs
   * 2. Recalculate total durationMinutes from all join/leave pairs
   * 3. Update attendance record (leftAt, durationMinutes)
   * 4. Audit log
   */
  async handleParticipantLeft(payload: any): Promise<void> {
    const meetingId = String(payload?.meeting?.id || payload?.id || '');
    const participant = payload?.participant || payload;
    const participantEmail = participant?.email || participant?.user_email || '';
    const participantId = participant?.participant_uuid || participant?.user_id || '';

    if (!meetingId) {
      this.logger.warn('participant_left: no meetingId in payload');
      return;
    }

    // Find session
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.meetingId, meetingId))
      .limit(1);

    if (!session) {
      this.logger.warn(`No session found for meetingId: ${meetingId}`);
      return;
    }

    // Exclude course instructor (Zoom host) from attendance
    const instructorId = await getSessionInstructorId(session.id);
    const matchedUser = await matchParticipantToUser(participantEmail, instructorId);

    // 1. Insert leave log
    await db.insert(attendanceLogs).values({
      sessionId: session.id,
      studentId: matchedUser?.id || null,
      eventType: ATTENDANCE_LOG_EVENT.LEAVE,
      timestamp: new Date(),
      zoomParticipantId: participantId,
      zoomUserEmail: participantEmail,
      rawPayload: payload,
    });

    // 2. Recalculate duration and update attendance if matched
    if (matchedUser) {
      const totalMinutes = await this.calculateTotalDuration(
        session.id,
        matchedUser.id,
      );

      await db
        .update(attendance)
        .set({
          leftAt: new Date(),
          durationMinutes: totalMinutes,
        })
        .where(
          and(
            eq(attendance.sessionId, session.id),
            eq(attendance.studentId, matchedUser.id),
          ),
        );

      // 3. Audit log
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ATTENDANCE_ZOOM_LEAVE,
        entityType: 'attendance',
        entityId: session.id,
        userId: matchedUser.id,
        metadata: {
          sessionId: session.id,
          meetingId,
          participantEmail,
          durationMinutes: totalMinutes,
        },
      });
    }
  }

  /**
   * Calculate total attendance duration from join/leave log pairs.
   * Groups consecutive join->leave pairs and sums durations.
   * Item #4: if a JOIN arrives when lastJoinTime is already set,
   * we close the existing interval first before starting a new one.
   */
  async calculateTotalDuration(
    sessionId: string,
    studentId: string,
  ): Promise<number> {
    const logs = await db
      .select({
        eventType: attendanceLogs.eventType,
        timestamp: attendanceLogs.timestamp,
      })
      .from(attendanceLogs)
      .where(
        and(
          eq(attendanceLogs.sessionId, sessionId),
          eq(attendanceLogs.studentId, studentId),
        ),
      )
      .orderBy(attendanceLogs.timestamp);

    let totalMs = 0;
    let lastJoinTime: Date | null = null;

    for (const log of logs) {
      if (log.eventType === ATTENDANCE_LOG_EVENT.JOIN) {
        // Item #4: if already joined (duplicate JOIN without LEAVE),
        // close the existing interval first
        if (lastJoinTime) {
          totalMs += log.timestamp.getTime() - lastJoinTime.getTime();
        }
        lastJoinTime = log.timestamp;
      } else if (
        log.eventType === ATTENDANCE_LOG_EVENT.LEAVE &&
        lastJoinTime
      ) {
        totalMs += log.timestamp.getTime() - lastJoinTime.getTime();
        lastJoinTime = null;
      }
    }

    // If still joined (no final leave), count up to now
    if (lastJoinTime) {
      totalMs += Date.now() - lastJoinTime.getTime();
    }

    return Math.round(totalMs / 60000); // Convert ms to minutes
  }
}
