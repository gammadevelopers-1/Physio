import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  attendance,
  attendanceLogs,
  users,
  SESSION_STATUS,
  SESSION_TYPE,
  ATTENDANCE_LOG_EVENT,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { ZOOM_SERVICE, IZoomService } from './zoom.interface';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';

@Injectable()
export class ZoomSyncService {
  private readonly logger = new Logger(ZoomSyncService.name);

  constructor(
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly auditService: NelcAuditService,
  ) {}

  /**
   * Cron job: every 10 minutes, sync recently ended Zoom sessions.
   * Finds completed sessions with a meetingId that haven't been synced yet.
   */
  @Cron('*/10 * * * *')
  async syncRecentlyEndedSessions(): Promise<void> {
    this.logger.log('Running Zoom attendance sync cron...');

    const unsyncedSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.status, SESSION_STATUS.COMPLETED),
          isNotNull(sessions.meetingId),
          isNull(sessions.zoomSyncedAt),
          // Only sync sessions that ended in the last 24 hours
          sql`${sessions.actualEndedAt} > NOW() - INTERVAL '24 hours'`,
        ),
      )
      .limit(10);

    for (const session of unsyncedSessions) {
      try {
        await this.syncSession(session.id);
      } catch (error) {
        this.logger.error(
          `Failed to sync session ${session.id}: ${(error as Error).message}`,
        );
      }
    }

    if (unsyncedSessions.length > 0) {
      this.logger.log(
        `Zoom sync cron completed: processed ${unsyncedSessions.length} sessions`,
      );
    }
  }

  /**
   * Sync a single session's attendance from Zoom Reports API.
   * Reconciliation rules:
   * - Manual marks (markedBy IS NOT NULL) always win — never overwrite
   * - Zoom data supplements missing attendance records
   * - If attendance exists but was auto-tracked (markedBy IS NULL), update with report data
   */
  async syncSession(
    sessionId: string,
  ): Promise<{ synced: number; skipped: number }> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.meetingId) {
      throw new Error(`Session ${sessionId} has no meetingId`);
    }

    if (
      session.type !== SESSION_TYPE.ZOOM &&
      session.type !== SESSION_TYPE.HYBRID
    ) {
      throw new Error(`Session ${sessionId} is not a Zoom/hybrid session`);
    }

    // Fetch participant report from Zoom
    const participants = await this.zoomService.getParticipantReport(
      session.meetingId,
    );

    let synced = 0;
    let skipped = 0;

    for (const participant of participants) {
      // Match participant email → system user
      const matchedUser = await this.matchParticipantToUser(
        participant.userEmail,
      );

      if (!matchedUser) {
        this.logger.debug(
          `Unmatched participant: ${participant.userEmail} in session ${sessionId}`,
        );
        skipped++;
        continue;
      }

      // Check existing attendance record
      const [existing] = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.sessionId, sessionId),
            eq(attendance.studentId, matchedUser.id),
          ),
        )
        .limit(1);

      const joinTime = participant.joinTime
        ? new Date(participant.joinTime)
        : null;
      const leaveTime = participant.leaveTime
        ? new Date(participant.leaveTime)
        : null;
      const durationMinutes = Math.round(participant.duration / 60);

      if (existing) {
        // Manual marks always win
        if (existing.markedBy) {
          skipped++;
          continue;
        }

        // Update auto-tracked record with report data
        await db
          .update(attendance)
          .set({
            status: 'present',
            ...(joinTime && { joinedAt: joinTime }),
            ...(leaveTime && { leftAt: leaveTime }),
            ...(durationMinutes > 0 && { durationMinutes }),
          })
          .where(eq(attendance.id, existing.id));

        synced++;
      } else {
        // Insert new attendance record from Zoom data
        await db.insert(attendance).values({
          sessionId,
          studentId: matchedUser.id,
          status: 'present',
          joinedAt: joinTime,
          leftAt: leaveTime,
          durationMinutes: durationMinutes > 0 ? durationMinutes : null,
        });

        synced++;
      }

      // Also insert attendance log entries for historical tracking
      if (joinTime) {
        await db
          .insert(attendanceLogs)
          .values({
            sessionId,
            studentId: matchedUser.id,
            eventType: ATTENDANCE_LOG_EVENT.JOIN,
            timestamp: joinTime,
            zoomUserEmail: participant.userEmail,
            zoomParticipantId: participant.id,
            rawPayload: { source: 'zoom_report_sync', ...participant },
          })
          .onConflictDoNothing();
      }

      if (leaveTime) {
        await db
          .insert(attendanceLogs)
          .values({
            sessionId,
            studentId: matchedUser.id,
            eventType: ATTENDANCE_LOG_EVENT.LEAVE,
            timestamp: leaveTime,
            zoomUserEmail: participant.userEmail,
            zoomParticipantId: participant.id,
            rawPayload: { source: 'zoom_report_sync', ...participant },
          })
          .onConflictDoNothing();
      }
    }

    // Mark session as synced
    await db
      .update(sessions)
      .set({ zoomSyncedAt: new Date(), updatedAt: new Date() })
      .where(eq(sessions.id, sessionId));

    // Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ZOOM_SYNC_COMPLETED,
      entityType: 'session',
      entityId: sessionId,
      metadata: {
        meetingId: session.meetingId,
        totalParticipants: participants.length,
        synced,
        skipped,
      },
    });

    this.logger.log(
      `Session ${sessionId} synced: ${synced} records updated, ${skipped} skipped`,
    );

    return { synced, skipped };
  }

  /**
   * Match a Zoom participant email to a system user.
   * Matching chain: user.email → user.zoomEmail
   */
  private async matchParticipantToUser(
    email: string,
  ): Promise<{ id: string } | null> {
    if (!email) return null;

    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (byEmail) return byEmail;

    const [byZoomEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.zoomEmail, email))
      .limit(1);

    return byZoomEmail || null;
  }
}
