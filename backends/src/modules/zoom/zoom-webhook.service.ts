import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  attendance,
  attendanceLogs,
  sessionAssistants,
  users,
  webinarRegistrations,
  ATTENDANCE_LOG_EVENT,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { or } from 'drizzle-orm';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { ZOOM_SERVICE, IZoomService } from './zoom.interface';
import { matchParticipantToUser, getSessionInstructorId, isParticipantHost } from './zoom.helpers';

@Injectable()
export class ZoomWebhookService {
  private readonly logger = new Logger(ZoomWebhookService.name);

  /** Cache host emails per meeting to avoid repeated Zoom API calls */
  private hostEmailCache = new Map<string, string>();

  constructor(
    private readonly auditService: NelcAuditService,
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
  ) {}

  /**
   * Get the host email for a meeting (cached per meetingId).
   */
  private async getHostEmail(meetingId: string): Promise<string | null> {
    if (this.hostEmailCache.has(meetingId)) {
      return this.hostEmailCache.get(meetingId)!;
    }
    try {
      const details = await this.zoomService.getMeeting(meetingId);
      if (details.hostEmail) {
        this.hostEmailCache.set(meetingId, details.hostEmail);
        return details.hostEmail;
      }
    } catch (e) {
      this.logger.warn(`Could not fetch host email for meeting ${meetingId}: ${(e as Error).message}`);
    }
    return null;
  }

  /**
   * Find a session by either its zoom meeting id OR its webinar id. Zoom
   * uses the same payload shape for both surfaces, so a single helper
   * dispatches participant/lifecycle events to the right session row.
   */
  private async findSessionByZoomId(zoomId: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(or(eq(sessions.meetingId, zoomId), eq(sessions.zoomWebinarId, zoomId)))
      .limit(1);
    return session;
  }

  /**
   * webinar.registration_created — fires when someone completes the
   * Zoom-hosted registration form. We mirror the registrant into our
   * webinar_registrations table so attendance correlation and the manager
   * "registrants" count don't depend on later polling.
   */
  async handleWebinarRegistrationCreated(payload: any): Promise<void> {
    const webinarId = String(payload?.id || payload?.object?.id || '');
    const registrant = payload?.registrant || payload?.object?.registrant;
    if (!webinarId || !registrant?.email) {
      this.logger.warn('webinar.registration_created: missing webinar id or registrant');
      return;
    }

    const session = await this.findSessionByZoomId(webinarId);
    if (!session) {
      this.logger.warn(`No session found for webinarId: ${webinarId}`);
      return;
    }

    const email = String(registrant.email).toLowerCase();
    // Try to match the registrant to a system user by email (excluding the
    // instructor — we don't count the host as an attendee).
    const instructorId = await getSessionInstructorId(session.id);
    const matched = await matchParticipantToUser(email, instructorId, []);

    // Pull custom-question answers if Zoom included them in the payload.
    const customByTitle = new Map<string, string>();
    const customs: Array<{ title?: string; value?: string }> =
      registrant.custom_questions || [];
    for (const q of customs) {
      if (q?.title && q?.value) customByTitle.set(q.title, q.value);
    }

    await db
      .insert(webinarRegistrations)
      .values({
        sessionId: session.id,
        userId: matched?.id || null,
        email,
        firstName: registrant.first_name || null,
        lastName: registrant.last_name || null,
        phone: registrant.phone || null,
        nationalId: customByTitle.get('ID No / Iqama') || null,
        scfhsNumber:
          customByTitle.get(
            'Saudi Health Commission License Number (write "NO" if not applicable)',
          ) || null,
        zoomRegistrantId: registrant.registrant_id || registrant.id || null,
        joinUrl: registrant.join_url || null,
        status: registrant.status || 'approved',
      })
      .onConflictDoUpdate({
        target: [webinarRegistrations.sessionId, webinarRegistrations.email],
        set: {
          zoomRegistrantId: registrant.registrant_id || registrant.id || null,
          joinUrl: registrant.join_url || null,
          firstName: registrant.first_name || null,
          lastName: registrant.last_name || null,
          phone: registrant.phone || null,
          status: registrant.status || 'approved',
          updatedAt: new Date(),
        },
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to mirror webinar registration from webhook: ${err?.message || err}`,
        ),
      );
  }

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
    const participantRole = participant?.role || '';

    if (!meetingId) {
      this.logger.warn('participant_joined: no meetingId in payload');
      return;
    }

    // Skip Zoom host by role field (if available) or by host_id match
    if (participantRole === 'host' || isParticipantHost(payload?.meeting || payload)) {
      this.logger.debug(`Skipping Zoom host join: ${participantEmail}`);
      return;
    }

    // 1. Find session by meetingId OR zoomWebinarId — Zoom uses the same
    //    payload shape for both surfaces; the id can be either.
    const session = await this.findSessionByZoomId(meetingId);

    if (!session) {
      this.logger.warn(`No session found for zoom id: ${meetingId}`);
      return;
    }

    // 2. Match participant to system user (item #5, #9: shared, case-insensitive)
    // Exclude the course instructor AND the Zoom meeting host from attendance
    const instructorId = await getSessionInstructorId(session.id);
    const hostEmail = session.meetingId ? await this.getHostEmail(session.meetingId) : null;
    const excludeEmails = hostEmail ? [hostEmail] : [];
    const matchedUser = await matchParticipantToUser(participantEmail, instructorId, excludeEmails);

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

    // 6. Promote TA to co-host if assigned with 'co_host' role
    await this.promoteIfTA(session.id, meetingId, participantId, participantEmail);
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
    const participantRole = participant?.role || '';

    if (!meetingId) {
      this.logger.warn('participant_left: no meetingId in payload');
      return;
    }

    // Skip Zoom host by role or host_id match
    if (participantRole === 'host' || isParticipantHost(payload?.meeting || payload)) {
      this.logger.debug(`Skipping Zoom host leave: ${participantEmail}`);
      return;
    }

    // Find session (matches meeting OR webinar id — same payload shape)
    const session = await this.findSessionByZoomId(meetingId);

    if (!session) {
      this.logger.warn(`No session found for zoom id: ${meetingId}`);
      return;
    }

    // Exclude course instructor AND Zoom host from attendance
    const instructorId = await getSessionInstructorId(session.id);
    const hostEmail = session.meetingId ? await this.getHostEmail(session.meetingId) : null;
    const excludeEmails = hostEmail ? [hostEmail] : [];
    const matchedUser = await matchParticipantToUser(participantEmail, instructorId, excludeEmails);

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

  /**
   * Check if a Zoom participant is a TA assigned to this session with 'co_host' role.
   * If so, promote them to co-host via the Zoom API.
   */
  private async promoteIfTA(
    sessionId: string,
    meetingId: string,
    participantId: string,
    participantEmail: string,
  ): Promise<void> {
    if (!participantEmail && !participantId) return;

    try {
      // Match participant email to a system user
      const normalizedEmail = participantEmail?.toLowerCase();
      if (!normalizedEmail) return;

      // Find user by email
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
        .limit(1);

      if (!user) {
        // Try zoomEmail
        const [byZoom] = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`LOWER(${users.zoomEmail}) = ${normalizedEmail}`)
          .limit(1);
        if (!byZoom) return;
        return this.tryPromoteUser(byZoom.id, sessionId, meetingId, participantId);
      }

      await this.tryPromoteUser(user.id, sessionId, meetingId, participantId);
    } catch (error) {
      this.logger.warn(
        `Failed to check/promote TA co-host: ${(error as Error).message}`,
      );
    }
  }

  /**
   * If the user is a session assistant with 'co_host' role, promote them.
   */
  private async tryPromoteUser(
    userId: string,
    sessionId: string,
    meetingId: string,
    participantId: string,
  ): Promise<void> {
    const [assistant] = await db
      .select({ role: sessionAssistants.role })
      .from(sessionAssistants)
      .where(
        and(
          eq(sessionAssistants.sessionId, sessionId),
          eq(sessionAssistants.userId, userId),
          eq(sessionAssistants.role, 'co_host'),
        ),
      )
      .limit(1);

    if (!assistant) return;

    this.logger.log(
      `TA ${userId} is a co_host for session ${sessionId} — promoting in Zoom meeting ${meetingId}`,
    );

    await this.zoomService.promoteToCohost(meetingId, participantId);
  }
}
