import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  attendance,
  attendanceLogs,
  SESSION_STATUS,
  SESSION_TYPE,
  ATTENDANCE_LOG_EVENT,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { ZOOM_SERVICE, IZoomService } from './zoom.interface';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { matchParticipantToUser } from './zoom.helpers';

@Injectable()
export class ZoomSyncService {
  private readonly logger = new Logger(ZoomSyncService.name);

  /** Concurrency guard: prevent overlapping cron runs (item #10) */
  private isSyncing = false;

  constructor(
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly auditService: NelcAuditService,
  ) {}

  /**
   * Cron job: every 10 minutes, sync recently ended Zoom sessions.
   * Finds completed sessions with a meetingId that haven't been synced yet.
   * Item #11: extended sync window to 7 days for sessions that failed sync.
   */
  @Cron('*/10 * * * *')
  async syncRecentlyEndedSessions(): Promise<void> {
    // Item #10: concurrency guard
    if (this.isSyncing) {
      this.logger.debug('Zoom sync already in progress, skipping this run');
      return;
    }

    this.isSyncing = true;
    try {
      this.logger.log('Running Zoom attendance sync cron...');

      const unsyncedSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.status, SESSION_STATUS.COMPLETED),
            isNotNull(sessions.meetingId),
            isNull(sessions.zoomSyncedAt),
            // Item #11: extended window to 7 days (covers weekends, failures)
            sql`${sessions.actualEndedAt} > NOW() - INTERVAL '7 days'`,
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
    } finally {
      this.isSyncing = false;
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
      // Item #5, #9: shared case-insensitive email matching
      const matchedUser = await matchParticipantToUser(
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
}
