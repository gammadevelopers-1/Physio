import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { db } from '../../database';
import {
  sessions,
  attendance,
  attendanceLogs,
  sessionAssistants,
  users,
  courses,
  enrollments,
  roles,
  userRoles,
  webinarRegistrations,
  ATTENDANCE_LOG_EVENT,
  NELC_EVENT_TYPE,
  ROLE_NAMES,
} from '../../database/schema';
import { or } from 'drizzle-orm';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { PasswordSetupService } from '../auth/password-setup.service';
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
    private readonly passwordSetupService: PasswordSetupService,
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

    const nationalId = customByTitle.get('ID No / Iqama') || null;
    const scfhsNumber =
      customByTitle.get(
        'Saudi Health Commission License Number (write "NO" if not applicable)',
      ) || null;

    await db
      .insert(webinarRegistrations)
      .values({
        sessionId: session.id,
        userId: matched?.id || null,
        email,
        firstName: registrant.first_name || null,
        lastName: registrant.last_name || null,
        phone: registrant.phone || null,
        nationalId,
        scfhsNumber,
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

    // For free Webinar Course sessions: auto-create student account (if new)
    // and enroll. Outsiders who registered via the public Zoom form become
    // real students, ready to attend the webinar and claim the certificate.
    try {
      const provisioned = await this.maybeAutoEnrollWebinarRegistrant({
        sessionId: session.id,
        courseId: session.courseId,
        email,
        firstName: registrant.first_name || null,
        lastName: registrant.last_name || null,
        phone: registrant.phone || null,
        nationalId,
        scfhsNumber,
        existingUserId: matched?.id || null,
      });
      if (provisioned?.userId) {
        await db
          .update(webinarRegistrations)
          .set({ userId: provisioned.userId, updatedAt: new Date() })
          .where(
            and(
              eq(webinarRegistrations.sessionId, session.id),
              eq(webinarRegistrations.email, email),
            ),
          );
      }
    } catch (err) {
      this.logger.error(
        `Webinar auto-enroll failed for ${email} on session ${session.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * For a free Webinar Course session: ensure a student account exists for
   * the registrant (auto-create if new) and ensure they're enrolled.
   * Returns { userId, isNewUser } when the course is a free Webinar Course,
   * otherwise returns null (so the standard mirror-only behaviour applies).
   */
  private async maybeAutoEnrollWebinarRegistrant(params: {
    sessionId: string;
    courseId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    nationalId: string | null;
    scfhsNumber: string | null;
    existingUserId: string | null;
  }): Promise<{ userId: string; isNewUser: boolean } | null> {
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        deliveryType: courses.deliveryType,
        price: courses.price,
        language: courses.language,
      })
      .from(courses)
      .where(eq(courses.id, params.courseId))
      .limit(1);

    if (!course || course.deliveryType !== 'webinar') return null;
    // Paid Webinar Courses use the post-checkout auto-register flow instead.
    // Only free Webinar Courses auto-enroll on Zoom-form registration.
    const priceValue = course.price ? Number(course.price) : 0;
    if (priceValue > 0) return null;

    // Resolve user — either pre-matched, or by email lookup, or create new.
    let userId = params.existingUserId;
    let isNewUser = false;
    let registrantName =
      `${params.firstName || ''} ${params.lastName || ''}`.trim() ||
      params.email.split('@')[0];

    if (!userId) {
      const [byEmail] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.email, params.email))
        .limit(1);
      if (byEmail) {
        userId = byEmail.id;
        registrantName =
          `${byEmail.firstName || ''} ${byEmail.lastName || ''}`.trim() ||
          registrantName;
      }
    }

    if (!userId) {
      // Create a placeholder student account. The random password is
      // unguessable; the user sets a real one via the set-password email.
      const randomPassword = randomBytes(48).toString('hex');
      const passwordHash = await argon2.hash(randomPassword);
      const [created] = await db
        .insert(users)
        .values({
          email: params.email,
          passwordHash,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          nationalId: params.nationalId,
          scfhsNumber: params.scfhsNumber,
          activeRole: ROLE_NAMES.STUDENT,
          isVerified: true,
        })
        .returning({ id: users.id });
      userId = created.id;
      isNewUser = true;

      const [studentRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, ROLE_NAMES.STUDENT))
        .limit(1);
      if (studentRole) {
        await db
          .insert(userRoles)
          .values({ userId, roleId: studentRole.id })
          .onConflictDoNothing();
      } else {
        this.logger.warn(
          'STUDENT role row missing; created webinar user has no user_roles entry',
        );
      }
      this.logger.log(
        `Auto-created student ${userId} from Zoom webinar registration (${params.email})`,
      );
    }

    // Enroll (or re-activate if previously dropped). Capacity checks
    // intentionally skipped — free webinars use Zoom's capacity, not ours.
    const [existingEnrollment] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, course.id),
          eq(enrollments.studentId, userId),
        ),
      )
      .limit(1);
    if (existingEnrollment) {
      if (existingEnrollment.status !== 'active') {
        await db
          .update(enrollments)
          .set({ status: 'active' })
          .where(eq(enrollments.id, existingEnrollment.id));
      }
    } else {
      await db
        .insert(enrollments)
        .values({ courseId: course.id, studentId: userId });
    }

    // Send the set-password email only for newly created users.
    if (isNewUser) {
      const locale = (course.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar';
      this.passwordSetupService
        .sendWebinarSetupEmail({
          email: params.email,
          registrantName,
          courseTitle: course.title,
          locale,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to send webinar set-password email to ${params.email}: ${(err as Error).message}`,
          ),
        );
    }

    return { userId, isNewUser };
  }

  /**
   * For a Webinar Course session, mirror the webinar registrant's join/leave
   * into the meeting `attendance` table when the registrant matches an
   * enrolled student. The existing progress + certificate engine reads
   * attendance, so this is what makes webinars count toward CME — without
   * this mirror, webinars stay info-only (which is correct for standalone
   * non-course webinars).
   */
  private async maybeRecordWebinarCourseAttendance(params: {
    sessionId: string;
    courseId: string;
    email: string;
    participantId: string;
    payload: any;
    event: 'join' | 'leave';
  }): Promise<void> {
    const [course] = await db
      .select({ deliveryType: courses.deliveryType })
      .from(courses)
      .where(eq(courses.id, params.courseId))
      .limit(1);
    if (course?.deliveryType !== 'webinar') return;

    const [row] = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(enrollments, eq(enrollments.studentId, users.id))
      .where(
        and(
          sql`LOWER(${users.email}) = LOWER(${params.email})`,
          eq(enrollments.courseId, params.courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .limit(1);
    if (!row?.userId) return;

    const studentId = row.userId;
    const now = new Date();

    await db.insert(attendanceLogs).values({
      sessionId: params.sessionId,
      studentId,
      eventType:
        params.event === 'join'
          ? ATTENDANCE_LOG_EVENT.JOIN
          : ATTENDANCE_LOG_EVENT.LEAVE,
      timestamp: now,
      zoomParticipantId: params.participantId,
      zoomUserEmail: params.email,
      rawPayload: params.payload,
    });

    if (params.event === 'join') {
      await db
        .insert(attendance)
        .values({
          sessionId: params.sessionId,
          studentId,
          status: 'present',
          joinedAt: now,
        })
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.studentId],
          set: { status: 'present', joinedAt: now },
        });
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ATTENDANCE_ZOOM_JOIN,
        entityType: 'attendance',
        entityId: params.sessionId,
        userId: studentId,
        metadata: {
          sessionId: params.sessionId,
          source: 'webinar_course',
          participantEmail: params.email,
        },
      });
    } else {
      const totalMinutes = await this.calculateTotalDuration(
        params.sessionId,
        studentId,
      );
      await db
        .update(attendance)
        .set({
          leftAt: now,
          durationMinutes: totalMinutes,
        })
        .where(
          and(
            eq(attendance.sessionId, params.sessionId),
            eq(attendance.studentId, studentId),
          ),
        );
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ATTENDANCE_ZOOM_LEAVE,
        entityType: 'attendance',
        entityId: params.sessionId,
        userId: studentId,
        metadata: {
          sessionId: params.sessionId,
          source: 'webinar_course',
          participantEmail: params.email,
          durationMinutes: totalMinutes,
        },
      });
    }
  }

  /**
   * Handle participant joined event from Zoom webhook.
   *
   * Branches on session.isWebinar:
   *   • Webinar — write attended/joinedAt onto the matching
   *     webinar_registrations row. Do NOT touch the meeting attendance
   *     table (webinars are info-only for enrolled-student progress).
   *   • Meeting — original attendance flow: attendance_logs + attendance
   *     upsert + co-host promotion.
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

    const session = await this.findSessionByZoomId(meetingId);
    if (!session) {
      this.logger.warn(`No session found for zoom id: ${meetingId}`);
      return;
    }

    // ── Webinar branch ───────────────────────────────────────────
    if (session.isWebinar) {
      if (!participantEmail) {
        this.logger.warn(
          `webinar participant_joined without email; webinarId=${meetingId}`,
        );
        return;
      }
      await db
        .update(webinarRegistrations)
        .set({
          attended: true,
          joinedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(webinarRegistrations.sessionId, session.id),
            sql`LOWER(${webinarRegistrations.email}) = LOWER(${participantEmail})`,
          ),
        );

      // For Webinar Course sessions, also record attendance for enrolled
      // students so the existing progress + certificate engine picks them
      // up. Non-Webinar-Course webinars (legacy / standalone outreach)
      // stay info-only — same as before.
      await this.maybeRecordWebinarCourseAttendance({
        sessionId: session.id,
        courseId: session.courseId,
        email: participantEmail,
        participantId,
        payload,
        event: 'join',
      });
      return;
    }

    // ── Meeting branch (original flow) ───────────────────────────
    const instructorId = await getSessionInstructorId(session.id);
    const hostEmail = session.meetingId ? await this.getHostEmail(session.meetingId) : null;
    const excludeEmails = hostEmail ? [hostEmail] : [];
    const matchedUser = await matchParticipantToUser(participantEmail, instructorId, excludeEmails);

    await db.insert(attendanceLogs).values({
      sessionId: session.id,
      studentId: matchedUser?.id || null,
      eventType: ATTENDANCE_LOG_EVENT.JOIN,
      timestamp: new Date(),
      zoomParticipantId: participantId,
      zoomUserEmail: participantEmail,
      rawPayload: payload,
    });

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

    await this.promoteIfTA(session.id, meetingId, participantId, participantEmail);
  }

  /**
   * Handle participant left event from Zoom webhook.
   * For webinars: update webinar_registrations.leftAt + attendedDurationMinutes.
   * For meetings: original attendance flow.
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

    if (participantRole === 'host' || isParticipantHost(payload?.meeting || payload)) {
      this.logger.debug(`Skipping Zoom host leave: ${participantEmail}`);
      return;
    }

    const session = await this.findSessionByZoomId(meetingId);
    if (!session) {
      this.logger.warn(`No session found for zoom id: ${meetingId}`);
      return;
    }

    // ── Webinar branch ───────────────────────────────────────────
    if (session.isWebinar) {
      if (!participantEmail) return;
      const [reg] = await db
        .select({
          id: webinarRegistrations.id,
          joinedAt: webinarRegistrations.joinedAt,
          existing: webinarRegistrations.attendedDurationMinutes,
        })
        .from(webinarRegistrations)
        .where(
          and(
            eq(webinarRegistrations.sessionId, session.id),
            sql`LOWER(${webinarRegistrations.email}) = LOWER(${participantEmail})`,
          ),
        )
        .limit(1);
      if (!reg) return;

      const now = new Date();
      const sessionMinutes = reg.joinedAt
        ? Math.max(0, Math.round((now.getTime() - reg.joinedAt.getTime()) / 60000))
        : 0;
      const total = (reg.existing || 0) + sessionMinutes;

      await db
        .update(webinarRegistrations)
        .set({
          leftAt: now,
          attendedDurationMinutes: total,
          updatedAt: now,
        })
        .where(eq(webinarRegistrations.id, reg.id));

      // Webinar Course attendance leave — mirror duration into attendance
      // table for enrolled students so progress + certificate eligibility
      // see the same number.
      await this.maybeRecordWebinarCourseAttendance({
        sessionId: session.id,
        courseId: session.courseId,
        email: participantEmail,
        participantId,
        payload,
        event: 'leave',
      });
      return;
    }

    // ── Meeting branch (original flow) ───────────────────────────
    const instructorId = await getSessionInstructorId(session.id);
    const hostEmail = session.meetingId ? await this.getHostEmail(session.meetingId) : null;
    const excludeEmails = hostEmail ? [hostEmail] : [];
    const matchedUser = await matchParticipantToUser(participantEmail, instructorId, excludeEmails);

    await db.insert(attendanceLogs).values({
      sessionId: session.id,
      studentId: matchedUser?.id || null,
      eventType: ATTENDANCE_LOG_EVENT.LEAVE,
      timestamp: new Date(),
      zoomParticipantId: participantId,
      zoomUserEmail: participantEmail,
      rawPayload: payload,
    });

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
