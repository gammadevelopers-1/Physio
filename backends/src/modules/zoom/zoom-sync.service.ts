import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, and, or, isNull, isNotNull, sql } from 'drizzle-orm';
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
import { XapiService } from '../xapi/xapi.service';
import { matchParticipantToUser, matchParticipantByPlatformId, getSessionInstructorId, parseTAId } from './zoom.helpers';
import { courseAssistants } from '../../database/schema/course-assistants';
import { users } from '../../database/schema';

@Injectable()
export class ZoomSyncService {
  private readonly logger = new Logger(ZoomSyncService.name);

  /** Concurrency guard: prevent overlapping cron runs (item #10) */
  private isSyncing = false;

  constructor(
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly auditService: NelcAuditService,
    private readonly xapiService: XapiService,
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
            or(
              eq(sessions.status, SESSION_STATUS.ENDED),
              eq(sessions.status, SESSION_STATUS.COMPLETED),
            ),
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
  ): Promise<{
    synced: number;
    skipped: number;
    details: Array<{
      name: string;
      email: string;
      joinTime: string | null;
      leaveTime: string | null;
      durationMinutes: number;
      action: 'synced' | 'updated_times' | 'skipped';
      reason?: string;
      matchMethod?: 'platform_id' | 'email';
    }>;
  }> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.meetingId) {
      throw new Error(
        'This session has no Zoom meeting linked. Please create a Zoom meeting first.',
      );
    }

    if (
      session.type !== SESSION_TYPE.ZOOM &&
      session.type !== SESSION_TYPE.HYBRID
    ) {
      throw new Error('This session is not a Zoom or hybrid session');
    }

    if (session.status !== SESSION_STATUS.ENDED && session.status !== SESSION_STATUS.COMPLETED) {
      throw new Error(
        'Zoom attendance can only be synced after the session has ended. Zoom reports typically become available 10-30 minutes after a meeting ends.',
      );
    }

    // Fetch participant report from Zoom
    const participants = await this.zoomService.getParticipantReport(
      session.meetingId,
    );

    // Log raw participant data for debugging
    this.logger.log(
      `Raw Zoom participants for session ${sessionId}: ${JSON.stringify(
        participants.map((p) => ({
          name: p.name,
          email: p.userEmail,
          role: p.role,
          duration: p.duration,
        })),
      )}`,
    );

    let synced = 0;
    let skipped = 0;
    const details: Array<{
      name: string;
      email: string;
      joinTime: string | null;
      leaveTime: string | null;
      durationMinutes: number;
      action: 'synced' | 'updated_times' | 'skipped';
      reason?: string;
      matchMethod?: 'platform_id' | 'email';
    }> = [];

    // Get course instructor to exclude from attendance (Zoom host)
    const instructorId = await getSessionInstructorId(sessionId);

    // Get Teaching Assistants assigned to this course — they should not appear in student attendance
    const taUserIds = new Set<string>();
    const taEmails = new Set<string>();
    if (session.courseId) {
      const tas = await db
        .select({
          userId: courseAssistants.userId,
          email: users.email,
        })
        .from(courseAssistants)
        .innerJoin(users, eq(courseAssistants.userId, users.id))
        .where(
          and(
            eq(courseAssistants.courseId, session.courseId),
            or(
              eq(courseAssistants.status, 'approved'),
              eq(courseAssistants.status, 'pre_assigned'),
            ),
          ),
        );
      for (const ta of tas) {
        taUserIds.add(ta.userId);
        if (ta.email) taEmails.add(ta.email.toLowerCase());
      }
      if (taUserIds.size > 0) {
        this.logger.debug(
          `Found ${taUserIds.size} TAs for course ${session.courseId} — will exclude from attendance (emails: ${[...taEmails].join(', ')})`,
        );
      }
    }

    // Get the Zoom meeting host email to exclude from attendance
    // The Reports API often returns the host with role='participant', so role check alone is not enough
    let hostEmail: string | null = null;
    try {
      const meetingDetails = await this.zoomService.getMeeting(session.meetingId);
      hostEmail = meetingDetails.hostEmail || null;
    } catch (e) {
      this.logger.warn(`Could not fetch host email for meeting ${session.meetingId}: ${(e as Error).message}`);
    }
    const excludeEmails = hostEmail ? [hostEmail.toLowerCase()] : [];
    // Also exclude TA emails from the email-matching path
    for (const taEmail of taEmails) {
      excludeEmails.push(taEmail);
    }

    // ── Pre-aggregate participants ──────────────────────────
    // Zoom creates separate entries per join/leave. Consolidate by
    // (name + email) so each person appears once with earliest join,
    // latest leave, and total duration.
    interface AggregatedParticipant {
      name: string;
      userEmail: string;
      role: string;
      joinTime: string | null;
      leaveTime: string | null;
      duration: number; // seconds
      id: string;
    }

    const aggregatedMap = new Map<string, AggregatedParticipant>();
    for (const p of participants) {
      const key = `${(p.name || '').toLowerCase()}||${(p.userEmail || '').toLowerCase()}`;
      const existing = aggregatedMap.get(key);
      if (existing) {
        // Merge: earliest join, latest leave, sum duration
        if (p.joinTime && (!existing.joinTime || p.joinTime < existing.joinTime)) {
          existing.joinTime = p.joinTime;
        }
        if (p.leaveTime && (!existing.leaveTime || p.leaveTime > existing.leaveTime)) {
          existing.leaveTime = p.leaveTime;
        }
        existing.duration += p.duration || 0;
        // Keep host role if any entry has it
        if (p.role === 'host') existing.role = 'host';
      } else {
        aggregatedMap.set(key, {
          name: p.name,
          userEmail: p.userEmail,
          role: p.role,
          joinTime: p.joinTime,
          leaveTime: p.leaveTime,
          duration: p.duration || 0,
          id: p.id,
        });
      }
    }
    const aggregatedParticipants = Array.from(aggregatedMap.values());

    this.logger.debug(
      `Aggregated ${participants.length} raw → ${aggregatedParticipants.length} unique participants`,
    );

    for (const participant of aggregatedParticipants) {
      // Skip Zoom host — by role OR by email match
      const isHost = participant.role === 'host'
        || (participant.userEmail && excludeEmails.includes(participant.userEmail.toLowerCase()));
      if (isHost) {
        this.logger.debug(
          `Skipping Zoom host: ${participant.userEmail} in session ${sessionId}`,
        );
        skipped++;
        details.push({
          name: participant.name,
          email: participant.userEmail,
          joinTime: participant.joinTime,
          leaveTime: participant.leaveTime,
          durationMinutes: Math.round(participant.duration / 60),
          action: 'skipped',
          reason: 'host',
        });
        continue;
      }

      // Skip Teaching Assistants by platform ID prefix (TA-xxxxxxxx in display name)
      const taPrefix = parseTAId(participant.name || '');
      if (taPrefix) {
        this.logger.debug(
          `Skipping TA by platform ID: name="${participant.name}" (TA-${taPrefix}) in session ${sessionId}`,
        );
        skipped++;
        details.push({
          name: participant.name,
          email: participant.userEmail,
          joinTime: participant.joinTime,
          leaveTime: participant.leaveTime,
          durationMinutes: Math.round(participant.duration / 60),
          action: 'skipped',
          reason: 'teaching_assistant',
        });
        continue;
      }

      // Skip Teaching Assistants by Zoom email (catches TAs before user matching)
      if (participant.userEmail && taEmails.has(participant.userEmail.toLowerCase())) {
        this.logger.debug(
          `Skipping TA by email: ${participant.userEmail} in session ${sessionId}`,
        );
        skipped++;
        details.push({
          name: participant.name,
          email: participant.userEmail,
          joinTime: participant.joinTime,
          leaveTime: participant.leaveTime,
          durationMinutes: Math.round(participant.duration / 60),
          action: 'skipped',
          reason: 'teaching_assistant',
        });
        continue;
      }

      // Try platform ID match first (Platform-Controlled Join Flow)
      // Format: "Full Name | PG-xxxxxxxx" in display name
      let matchedUser: { id: string } | null = null;
      let matchMethod: 'platform_id' | 'email' | null = null;

      const platformMatch = await matchParticipantByPlatformId(participant.name, instructorId);
      if (platformMatch) {
        matchedUser = platformMatch;
        matchMethod = 'platform_id';
        this.logger.debug(
          `Matched by platform ID: name="${participant.name}" → userId=${matchedUser.id}`,
        );
      }

      // Fall back to email matching if platform ID not found
      if (!matchedUser) {
        const emailMatch = await matchParticipantToUser(
          participant.userEmail,
          instructorId,
          hostEmail ? [hostEmail] : [],
        );
        if (emailMatch) {
          matchedUser = emailMatch;
          matchMethod = 'email';
        }
      }

      // Skip Teaching Assistants — they join sessions but are not students
      if (matchedUser && taUserIds.has(matchedUser.id)) {
        this.logger.debug(
          `Skipping TA: ${participant.name} (userId=${matchedUser.id}) in session ${sessionId}`,
        );
        skipped++;
        details.push({
          name: participant.name,
          email: participant.userEmail,
          joinTime: participant.joinTime,
          leaveTime: participant.leaveTime,
          durationMinutes: Math.round(participant.duration / 60),
          action: 'skipped',
          reason: 'teaching_assistant',
        });
        continue;
      }

      if (!matchedUser) {
        const reason = !participant.userEmail && !participant.name
          ? 'no_identity'
          : 'unmatched';
        this.logger.warn(
          `Unmatched participant: name="${participant.name}", email="${participant.userEmail || '(empty)'}" in session ${sessionId}`,
        );

        // Persist unmatched participants in attendance_logs with null studentId
        // so instructors can see and manually assign them
        if (reason === 'unmatched') {
          const zoomEmail = participant.userEmail || participant.name || 'unknown';
          // Check if already logged to avoid duplicates
          const [existingLog] = await db
            .select({ id: attendanceLogs.id })
            .from(attendanceLogs)
            .where(
              and(
                eq(attendanceLogs.sessionId, sessionId),
                isNull(attendanceLogs.studentId),
                eq(attendanceLogs.zoomUserEmail, zoomEmail),
                eq(attendanceLogs.eventType, ATTENDANCE_LOG_EVENT.JOIN),
              ),
            )
            .limit(1);

          if (!existingLog) {
            await db.insert(attendanceLogs).values({
              sessionId,
              studentId: null,
              eventType: ATTENDANCE_LOG_EVENT.JOIN,
              timestamp: participant.joinTime ? new Date(participant.joinTime) : new Date(),
              zoomParticipantId: participant.id || null,
              zoomUserEmail: zoomEmail,
              rawPayload: {
                name: participant.name,
                email: participant.userEmail,
                duration: participant.duration,
                leaveTime: participant.leaveTime,
              },
            });
          }
        }

        skipped++;
        details.push({
          name: participant.name,
          email: participant.userEmail,
          joinTime: participant.joinTime,
          leaveTime: participant.leaveTime,
          durationMinutes: Math.round(participant.duration / 60),
          action: 'skipped',
          reason,
        });
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
        // Manual marks: keep status but supplement timing data from Zoom
        if (existing.markedBy) {
          const timingUpdates: Record<string, unknown> = {};
          if (joinTime && !existing.joinedAt) timingUpdates.joinedAt = joinTime;
          if (leaveTime && !existing.leftAt) timingUpdates.leftAt = leaveTime;
          if (durationMinutes > 0 && !existing.durationMinutes) {
            timingUpdates.durationMinutes = durationMinutes;
          }

          if (Object.keys(timingUpdates).length > 0) {
            await db
              .update(attendance)
              .set(timingUpdates)
              .where(eq(attendance.id, existing.id));
          }

          synced++;
          details.push({
            name: participant.name,
            email: participant.userEmail,
            joinTime: participant.joinTime,
            leaveTime: participant.leaveTime,
            durationMinutes,
            action: 'updated_times',
            matchMethod: matchMethod ?? undefined,
          });
          continue;
        }

        // Auto present/absent based on 70% presence threshold
        // Credit lobby wait: if student joined within 2 min of session start, add the gap
        const actualDurationMin = session.actualStartedAt && session.actualEndedAt
          ? Math.round((new Date(session.actualEndedAt).getTime() - new Date(session.actualStartedAt).getTime()) / 60000)
          : null;
        const sessionDuration = actualDurationMin && actualDurationMin > 0 ? actualDurationMin : (session.durationMinutes || 60);
        let effectiveDuration = durationMinutes;
        if (joinTime && session.actualStartedAt) {
          const lobbyDelay = joinTime.getTime() - new Date(session.actualStartedAt).getTime();
          if (lobbyDelay > 0 && lobbyDelay <= 2 * 60000) {
            effectiveDuration += Math.round(lobbyDelay / 60000);
          }
        }
        const presencePercent = sessionDuration > 0 ? (effectiveDuration / sessionDuration) * 100 : 0;
        const autoStatus = presencePercent >= 70 ? 'present' : 'absent';

        // Update auto-tracked record with report data
        await db
          .update(attendance)
          .set({
            status: autoStatus,
            ...(joinTime && { joinedAt: joinTime }),
            ...(leaveTime && { leftAt: leaveTime }),
            ...(durationMinutes > 0 && { durationMinutes }),
          })
          .where(eq(attendance.id, existing.id));

        synced++;
      } else {
        // Auto present/absent based on 70% presence threshold
        // Credit lobby wait: if student joined within 2 min of session start, add the gap
        const actualDurationMin = session.actualStartedAt && session.actualEndedAt
          ? Math.round((new Date(session.actualEndedAt).getTime() - new Date(session.actualStartedAt).getTime()) / 60000)
          : null;
        const sessionDuration = actualDurationMin && actualDurationMin > 0 ? actualDurationMin : (session.durationMinutes || 60);
        let effectiveDuration = durationMinutes;
        if (joinTime && session.actualStartedAt) {
          const lobbyDelay = joinTime.getTime() - new Date(session.actualStartedAt).getTime();
          if (lobbyDelay > 0 && lobbyDelay <= 2 * 60000) {
            effectiveDuration += Math.round(lobbyDelay / 60000);
          }
        }
        const presencePercent = sessionDuration > 0 ? (effectiveDuration / sessionDuration) * 100 : 0;
        const autoStatus = presencePercent >= 70 ? 'present' : 'absent';

        // Insert new attendance record from Zoom data
        await db.insert(attendance).values({
          sessionId,
          studentId: matchedUser.id,
          status: autoStatus,
          joinedAt: joinTime,
          leftAt: leaveTime,
          durationMinutes: durationMinutes > 0 ? durationMinutes : null,
        });

        // NELC xAPI — emit when the auto-sync determines the learner
        // was actually present (≥70% of session). Absences are skipped
        // (no meaningful xAPI event for "did not attend").
        if (autoStatus === 'present') {
          void this.xapiService.emitWebinarAttended(matchedUser.id, sessionId);
        }

        synced++;
      }

      details.push({
        name: participant.name,
        email: participant.userEmail,
        joinTime: participant.joinTime,
        leaveTime: participant.leaveTime,
        durationMinutes,
        action: 'synced',
        matchMethod: matchMethod ?? undefined,
      });

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

    return { synced, skipped, details };
  }
}
