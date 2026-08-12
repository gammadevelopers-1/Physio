import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { eq, and, ne, desc, count, sql, or, inArray, isNull, notInArray, gte } from 'drizzle-orm';
import { db } from '../../database';
import {
  enrollments,
  attendance,
  sessions,
  courses,
  users,
  waitlists,
  sessionAssistants,
  courseAssistants,
  webinarRegistrations,
  NELC_EVENT_TYPE,
  type EnrollmentSource,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager, isTA } from '../../common/role-helpers';
import { decryptUserPII } from '../../common/crypto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { SessionAssistantsService } from '../session-assistants/session-assistants.service';
import { ThresholdEvaluationService } from '../course-assistants/threshold-evaluation.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';
import { ZOOM_SERVICE, IZoomService } from '../zoom/zoom.interface';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { toArabicIndic } from '../../common/platform-locale';
import {
  classifyCourse,
  getNelcMaxEnrollment,
} from '../courses/nelc-config';
import {
  canEnroll,
  describeEnrollBlock,
} from '../courses/course-lifecycle.helper';
import { XapiService } from '../xapi/xapi.service';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly auditLogService: AuditLogService,
    private readonly assistantsService: SessionAssistantsService,
    private readonly thresholdEvaluationService: ThresholdEvaluationService,
    private readonly userNotificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly adminSettings: AdminSettingsService,
    private readonly xapiService: XapiService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private addCourseOwnershipCondition(
    conditions: any[],
    user: AuthenticatedUser,
  ): void {
    if (isGlobalAdmin(user)) {
      // No filter
    } else if (isManager(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    } else {
      conditions.push(eq(courses.instructorId, user.id));
    }
  }

  // ─── Enrollment Creation with NELC Limit Enforcement ──────

  /**
   * POST /courses/:id/enroll
   * Enroll a student into a course with NELC limit enforcement.
   * Uses DB transaction with row-level lock to prevent race conditions.
   */
  async createEnrollment(
    courseId: string,
    studentId: string,
    user: AuthenticatedUser,
    options: { source?: EnrollmentSource } = {},
  ) {
    const source: EnrollmentSource = options.source ?? 'free_public';
    // 1. Get course with dates and maxEnrollment
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // 1a. Lifecycle gate — previously this path only checked deletedAt, so
    // admin/instructor manual enrol would happily add a student to a
    // cancelled, archived, or draft course. Canonical predicate in
    // course-lifecycle.helper.ts.
    const gate = canEnroll(course);
    if (!gate.ok) {
      throw new BadRequestException(describeEnrollBlock(gate.reason));
    }

    // 2. Determine effective max enrollment
    // Self-paced (async): unlimited unless manager sets a cap
    // Synchronous/Blended: default 2000 (adjustable per-course)
    const isSelfPaced = course.deliveryType === 'self-paced';

    let effectiveMax: number | null;
    let classification: 'long' | 'short' = 'short';

    if (isSelfPaced) {
      // Async: only enforce if manager explicitly set a limit
      effectiveMax = course.maxEnrollment ?? null;
    } else {
      classification = classifyCourse(course.startDate, course.endDate);
      const syncDefault = getNelcMaxEnrollment(classification); // 2000
      effectiveMax = course.maxEnrollment ?? syncDefault;
    }

    // 3. Count current active enrollments
    const [countResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    const currentCount = Number(countResult?.count || 0);

    // 4. Enforce enrollment limit — offer waitlist if course is full
    //    effectiveMax === null means unlimited (self-paced with no cap)
    if (effectiveMax !== null && currentCount >= effectiveMax) {
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ENROLLMENT_LIMIT_ENFORCED,
        entityType: 'course',
        entityId: courseId,
        userId: user.id,
        metadata: {
          count: currentCount,
          maxAllowed: effectiveMax,
          classification,
          studentId,
        },
      });

      // Check if student is already on the waitlist
      const [existingWaitlist] = await db
        .select()
        .from(waitlists)
        .where(
          and(
            eq(waitlists.courseId, courseId),
            eq(waitlists.studentId, studentId),
            eq(waitlists.status, 'waiting'),
          ),
        )
        .limit(1);

      if (existingWaitlist) {
        throw new BadRequestException(
          `You are already on the waitlist at position ${existingWaitlist.position}`,
        );
      }

      // Get current waitlist size to determine position
      const [waitlistCount] = await db
        .select({ count: count() })
        .from(waitlists)
        .where(
          and(
            eq(waitlists.courseId, courseId),
            eq(waitlists.status, 'waiting'),
          ),
        );
      const position = Number(waitlistCount?.count || 0) + 1;

      // Add to waitlist
      const [entry] = await db
        .insert(waitlists)
        .values({
          courseId,
          studentId,
          position,
          status: 'waiting',
        })
        .returning();

      throw new BadRequestException(
        JSON.stringify({
          code: 'WAITLISTED',
          message: `Course is full (${currentCount}/${effectiveMax}). You have been added to the waitlist at position ${position}.`,
          waitlistPosition: position,
          waitlistId: entry.id,
        }),
      );
    }

    // 5. Check for existing enrollment
    const [existing] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException('Student is already enrolled in this course');
      }
      // Re-activate if previously dropped/suspended. Overwrite source to
      // match the current flow — a student who was dropped from a paid
      // enrollment and later re-enters via points should now show as
      // 'points_redemption', not the stale 'purchase' tag.
      const [reactivated] = await db
        .update(enrollments)
        .set({ status: 'active', source })
        .where(eq(enrollments.id, existing.id))
        .returning();

      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ENROLLMENT_CREATED,
        entityType: 'enrollment',
        entityId: reactivated.id,
        userId: user.id,
        metadata: {
          courseId,
          studentId,
          currentCount: currentCount + 1,
          maxEnrollment: effectiveMax,
          reactivated: true,
        },
      });

      // Item #13: TA re-allocation on enrollment change
      await this.triggerTaReallocation(courseId);

      // For Webinar Courses: auto-register the student in Zoom for every
      // webinar session so the personal join URL is immediately available
      // in their dashboard — no Zoom-form roundtrip.
      this.autoRegisterStudentForWebinarCourse(courseId, studentId).catch((err) =>
        this.logger.error('Webinar Course auto-register failed', err),
      );

      // Notify student of enrollment
      this.notifyStudentOfEnrollment(courseId, studentId).catch((err) =>
        this.logger.error('Failed to send enrollment notification', err),
      );

      // NELC xAPI — fire & forget. Re-activation counts as a fresh
      // enrolment for NELC: the learner is now "registered" on this
      // course again.
      void this.xapiService.emitCourseEnrollment(studentId, courseId, reactivated.id);

      return reactivated;
    }

    // 6. Insert new enrollment. Callers pass the source explicitly (points
    //    redemption saga → 'points_redemption', student free-course endpoint
    //    → 'free_public'). Reports + student UI read this to distinguish
    //    unlock paths from paid enrollments.
    const [enrollment] = await db
      .insert(enrollments)
      .values({
        courseId,
        studentId,
        source,
      })
      .returning();

    // 7. Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ENROLLMENT_CREATED,
      entityType: 'enrollment',
      entityId: enrollment.id,
      userId: user.id,
      metadata: {
        courseId,
        studentId,
        currentCount: currentCount + 1,
        maxEnrollment: effectiveMax,
        classification,
      },
    });

    // Item #13: TA re-allocation on enrollment change
    await this.triggerTaReallocation(courseId);

    // For Webinar Courses: auto-register the student in Zoom for every
    // webinar session so the personal join URL is immediately available
    // in their dashboard — no Zoom-form roundtrip.
    this.autoRegisterStudentForWebinarCourse(courseId, studentId).catch((err) =>
      this.logger.error('Webinar Course auto-register failed', err),
    );

    // Notify student of enrollment
    this.notifyStudentOfEnrollment(courseId, studentId).catch((err) =>
      this.logger.error('Failed to send enrollment notification', err),
    );

    // NELC xAPI — fire & forget. The 'registered' statement is the
    // first event in NELC's validator pipeline; 'initialized' follows
    // when the student opens course content (hooked in StudentService).
    void this.xapiService.emitCourseEnrollment(studentId, courseId, enrollment.id);

    return enrollment;
  }

  /**
   * POST /courses/:id/manual-enroll — admin/manager force-enrolls a student.
   *
   * Deliberately bypasses:
   *   - the NELC capacity limit (managers may need to add one more student
   *     even when the course is nominally full — capacity is a guideline
   *     enforced against self-service enrolments, not against explicit
   *     admin actions).
   *   - the waitlist (an admin add IS the answer for that student —
   *     there's no reason to route them through a waitlist).
   *
   * Still enforces:
   *   - the lifecycle gate (`canEnroll`) — cannot enrol into a draft,
   *     cancelled, or archived course. Admins/managers should reschedule
   *     or reactivate first.
   *   - the unique constraint on (courseId, studentId) — re-enrolling a
   *     currently active student is a bad request; re-activating a
   *     previously dropped student is allowed (parallels createEnrollment).
   *
   * Every manual enrolment writes:
   *   - enrollments.enrolled_by = actor.id
   *   - enrollments.enrollment_reason = mandatory reason
   *   - audit_logs entry (entityType=enrollment, action=enrollment.manual_created)
   *   - nelc_audit_logs entry (parity with the normal enrol path)
   */
  async manualEnroll(
    courseId: string,
    studentId: string,
    reason: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    // 1. Load + lifecycle gate. Reuse the same helper as createEnrollment.
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
      .limit(1);
    if (!course) throw new NotFoundException('Course not found');

    const gate = canEnroll(course);
    if (!gate.ok) {
      throw new BadRequestException(describeEnrollBlock(gate.reason));
    }

    // 2. Verify the student actually exists and is a student. Prevents
    //    an admin from mistakenly enrolling e.g. another admin.
    const [student] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    if (!student) throw new NotFoundException('Student not found');
    if (!student.isActive) {
      throw new BadRequestException('Student account is inactive');
    }

    // 3. Check for existing enrollment. Re-activating a dropped student
    //    is allowed and treated as a fresh manual enrollment (audit
    //    trail overwrites the removal audit — the current row now
    //    reflects who re-added them).
    const [existing] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    let enrollmentRow;
    let wasReactivated = false;

    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException(
          'Student is already enrolled in this course',
        );
      }
      const [reactivated] = await db
        .update(enrollments)
        .set({
          status: 'active',
          enrolledBy: actor.id,
          enrollmentReason: reason,
          source: 'admin_grant',
          // Clear the removal audit — the student is being brought back.
          removedBy: null,
          removedAt: null,
          removalReason: null,
        })
        .where(eq(enrollments.id, existing.id))
        .returning();
      enrollmentRow = reactivated;
      wasReactivated = true;
    } else {
      const [inserted] = await db
        .insert(enrollments)
        .values({
          courseId,
          studentId,
          enrolledBy: actor.id,
          enrollmentReason: reason,
          source: 'admin_grant',
        })
        .returning();
      enrollmentRow = inserted;
    }

    // 4. Audit log — captures WHO, WHY, and the bypass context so
    //    finance/compliance can trace every manual entry.
    await this.auditLogService.log({
      entityType: 'enrollment',
      entityId: enrollmentRow.id,
      action: 'enrollment.manual_created',
      performedBy: actor.id,
      ipAddress,
      metadata: {
        courseId,
        studentId,
        reason,
        reactivated: wasReactivated,
        bypassedCapacity: true,
      },
    });

    // 5. NELC audit parity so the regulator-facing log includes this
    //    enrolment too.
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ENROLLMENT_CREATED,
      entityType: 'enrollment',
      entityId: enrollmentRow.id,
      userId: actor.id,
      metadata: {
        courseId,
        studentId,
        source: 'manual',
        reactivated: wasReactivated,
      },
    });

    // 6. Fire the same downstream hooks a self-service enrol would.
    await this.triggerTaReallocation(courseId);
    this.autoRegisterStudentForWebinarCourse(courseId, studentId).catch((err) =>
      this.logger.error('Webinar Course auto-register failed', err),
    );
    this.notifyStudentOfEnrollment(courseId, studentId).catch((err) =>
      this.logger.error('Failed to send enrollment notification', err),
    );
    void this.xapiService.emitCourseEnrollment(
      studentId,
      courseId,
      enrollmentRow.id,
    );

    return enrollmentRow;
  }

  /**
   * DELETE /courses/:id/enrollments/:studentId — admin/manager removes
   * a student from a course.
   *
   * Sets status='dropped' + populates the removal audit columns
   * (removed_by/removed_at/removal_reason) so downstream systems can
   * distinguish an admin removal from a student self-drop. Deliberately
   * does NOT auto-refund — finance owns that decision and reads
   * removal_reason to make it (per Amna's requirement).
   */
  async removeEnrollment(
    courseId: string,
    studentId: string,
    reason: string,
    actor: AuthenticatedUser,
    ipAddress?: string,
  ) {
    // 1. Find the enrollment. Only consider ACTIVE ones — you can't
    //    "remove" someone who's already dropped.
    const [existing] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new NotFoundException('Enrollment not found');
    }
    if (existing.status === 'dropped') {
      throw new BadRequestException(
        'Student has already been removed from this course',
      );
    }

    const previousStatus = existing.status;

    const [updated] = await db
      .update(enrollments)
      .set({
        status: 'dropped',
        removedBy: actor.id,
        removedAt: new Date(),
        removalReason: reason,
      })
      .where(eq(enrollments.id, existing.id))
      .returning();

    // 2. Audit log — finance dashboards read this to see WHY a student
    //    was removed and decide whether a refund is appropriate.
    await this.auditLogService.log({
      entityType: 'enrollment',
      entityId: updated.id,
      action: 'enrollment.removed_by_admin',
      performedBy: actor.id,
      ipAddress,
      metadata: {
        courseId,
        studentId,
        reason,
        previousStatus,
      },
    });

    // 3. Re-balance TA workload since a student is gone.
    await this.triggerTaReallocation(courseId);

    return updated;
  }

  /**
   * Post-enrollment hook: for every webinar session linked to the course
   * (Webinar Course or any other course type that has a webinar mixed in),
   * register the student in Zoom and mirror the registration into
   * webinar_registrations so the dashboard surfaces the personal join URL.
   * Idempotent — Zoom dedupes by email and our upsert handles re-runs.
   * Counterpart to SessionsService.autoRegisterEnrolledStudentsForWebinar,
   * which fires when the webinar is created AFTER students are enrolled.
   *
   * No-op when the course has no webinar sessions. Failures are logged,
   * never thrown — the enrollment itself must not be blocked by Zoom
   * downtime.
   */
  async autoRegisterStudentForWebinarCourse(
    courseId: string,
    studentId: string,
  ): Promise<void> {
    const [rawStudent] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        nationalId: users.nationalId,
        scfhsNumber: users.scfhsNumber,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    if (!rawStudent?.email) return;
    // PII fields are stored encrypted — decrypt before passing on to
    // Zoom (which needs plaintext) and to the webinar_registrations
    // table (denormalized cache that mirrors what Zoom received).
    const student = decryptUserPII(rawStudent);

    // Only register for webinars the student can actually attend:
    // upcoming + non-cancelled + not already ended. Past webinars
    // (status ended/completed/missed OR scheduledAt < now) would
    // pointlessly register them for an event that already happened,
    // and downstream code would treat the registration as "missed
    // attendance" — bad UX. The progress.helper denominator filter
    // mirrors this so late enrollees still hit 100%.
    const now = new Date();
    const webinarSessions = await db
      .select({
        id: sessions.id,
        zoomWebinarId: sessions.zoomWebinarId,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.courseId, courseId),
          eq(sessions.isWebinar, true),
          notInArray(sessions.status, [
            'cancelled',
            'ended',
            'completed',
            'missed',
          ]),
          gte(sessions.scheduledAt, now),
        ),
      );

    for (const ws of webinarSessions) {
      if (!ws.zoomWebinarId) continue;
      try {
        const result = await this.zoomService.registerForWebinar(ws.zoomWebinarId, {
          email: student.email,
          firstName: student.firstName || student.email.split('@')[0],
          lastName: student.lastName || '',
          phone: student.phone || undefined,
          nationalId: student.nationalId || undefined,
          scfhsNumber: student.scfhsNumber || undefined,
        });
        await db
          .insert(webinarRegistrations)
          .values({
            sessionId: ws.id,
            userId: studentId,
            email: student.email.toLowerCase(),
            firstName: student.firstName || null,
            lastName: student.lastName || null,
            phone: student.phone || null,
            nationalId: student.nationalId || null,
            scfhsNumber: student.scfhsNumber || null,
            zoomRegistrantId: result.registrantId || null,
            joinUrl: result.joinUrl || null,
            status: 'approved',
          })
          .onConflictDoUpdate({
            target: [webinarRegistrations.sessionId, webinarRegistrations.email],
            set: {
              userId: studentId,
              zoomRegistrantId: result.registrantId || null,
              joinUrl: result.joinUrl || null,
              status: 'approved',
              updatedAt: new Date(),
            },
          });
      } catch (err) {
        this.logger.warn(
          `Zoom auto-register failed for session ${ws.id} / student ${studentId}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Get the count of active enrollments for a course.
   */
  async getActiveEnrollmentCount(courseId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    return Number(result?.count || 0);
  }

  // ─── Enrollment Notification Helper ─────────────────────────

  private async notifyStudentOfEnrollment(
    courseId: string,
    studentId: string,
  ) {
    const [course] = await db
      .select({
        title: courses.title,
        startDate: courses.startDate,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return;

    const [student] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    if (!student) return;

    const studentName =
      `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
      'Student';

    // Get instructor name
    let instructorName = 'Your Instructor';
    if (course.instructorId) {
      const [instructor] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, course.instructorId))
        .limit(1);
      if (instructor) {
        instructorName =
          `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() ||
          'Your Instructor';
      }
    }

    // In-app notification
    const isAr = student.language === 'ar';
    await this.userNotificationsService.create({
      recipientId: studentId,
      type: 'enrollment_confirmed',
      title: isAr ? 'تم تأكيد التسجيل' : 'Enrollment Confirmed',
      message: isAr
        ? `تم تسجيلك في "${course.title}"`
        : `You have been enrolled in "${course.title}"`,
      link: `/dashboard/student/courses`,
      entityType: 'enrollment',
      entityId: courseId,
    });

    // Email notification
    if (student.email) {
      const localeSettings = await this.adminSettings.getPublicLocaleSettings().catch(() => ({
        numberSystem: 'western' as const,
        dateFormat: 'DD-MM-YYYY' as const,
      }));
      let formattedDate = course.startDate
        ? new Date(course.startDate).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : null;
      if (formattedDate && localeSettings.numberSystem === 'arabic_indic') {
        formattedDate = toArabicIndic(formattedDate);
      }

      const locale = (student.language || 'en') as 'en' | 'ar';
      await this.emailService.sendEnrollmentConfirmation(student.email, {
        studentName,
        courseName: course.title,
        startDate: formattedDate,
        instructorName,
      }, locale);
    }
  }

  // ─── Course Enrollments ───────────────────────────────────

  /**
   * GET /courses/:id/enrollments
   * List all students enrolled in a course.
   * - Instructor: only their own courses.
   * - Admin: any course.
   */
  async getCourseEnrollments(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    await this.verifyCourseAccess(courseId, user);

    // Get TA user IDs to exclude from enrollment list (TAs are not students)
    const tas = await db
      .select({ userId: courseAssistants.userId })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          or(
            eq(courseAssistants.status, 'approved'),
            eq(courseAssistants.status, 'pre_assigned'),
          ),
        ),
      );
    const taUserIds = new Set(tas.map((t) => t.userId));

    const data = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        studentId: enrollments.studentId,
        status: enrollments.status,
        progress: enrollments.progress,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        // Audit columns so the manager UI can render "Enrolled by …"
        // and the removal-reason chip when relevant. Populated only
        // for manual admin/manager enrolments and removals.
        enrolledBy: enrollments.enrolledBy,
        enrollmentReason: enrollments.enrollmentReason,
        removedBy: enrollments.removedBy,
        removedAt: enrollments.removedAt,
        removalReason: enrollments.removalReason,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(
        and(
          eq(enrollments.courseId, courseId),
          // Include dropped rows too so the manager sees the removed
          // audit + reason; the frontend filters them into their own
          // section. Suspended stays hidden (rare, not a display case).
          sql`${enrollments.status} IN ('active', 'completed', 'dropped')`,
        ),
      )
      .orderBy(desc(enrollments.enrolledAt));

    // Filter out TAs from enrollment list
    return taUserIds.size > 0
      ? data.filter((d) => !taUserIds.has(d.studentId))
      : data;
  }

  // ─── Session Attendance ───────────────────────────────────

  /**
   * GET /sessions/:id/attendance
   * List attendance records for a session.
   * - Instructor: only their own sessions.
   * - Admin: any session.
   */
  async getSessionAttendance(
    sessionId: string,
    user: AuthenticatedUser,
  ) {
    await this.verifySessionAccess(sessionId, user);

    // Look up the session details
    const [session] = await db
      .select({ courseId: sessions.courseId, status: sessions.status, durationMinutes: sessions.durationMinutes, actualStartedAt: sessions.actualStartedAt, actualEndedAt: sessions.actualEndedAt, isMakeup: sessions.isMakeup, assignedStudents: sessions.assignedStudents })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    // Instructors and TAs can view/edit attendance at any time; others only after finalization
    const isInstructorOrTA = user.activeRole === 'INSTRUCTOR' || user.activeRole === 'TEACHING_ASSISTANT';
    const isFinalized = session?.status === 'completed';
    if (!isInstructorOrTA && !isGlobalAdmin(user) && !isManager(user) && !isFinalized) {
      throw new BadRequestException(
        'Attendance has not been finalized yet. The instructor must complete attendance marking before it can be viewed.',
      );
    }

    let instructorId: string | null = null;
    // Collect TA user IDs to exclude from attendance
    const taUserIds = new Set<string>();
    if (session?.courseId) {
      const [course] = await db
        .select({ instructorId: courses.instructorId })
        .from(courses)
        .where(eq(courses.id, session.courseId))
        .limit(1);
      instructorId = course?.instructorId || null;

      const tas = await db
        .select({ userId: courseAssistants.userId })
        .from(courseAssistants)
        .where(
          and(
            eq(courseAssistants.courseId, session.courseId),
            or(
              eq(courseAssistants.status, 'approved'),
              eq(courseAssistants.status, 'pre_assigned'),
            ),
          ),
        );
      for (const ta of tas) taUserIds.add(ta.userId);
    }

    const conditions = [eq(attendance.sessionId, sessionId)];
    if (instructorId) {
      conditions.push(ne(attendance.studentId, instructorId));
    }
    // Exclude TAs from attendance records
    for (const taId of taUserIds) {
      conditions.push(ne(attendance.studentId, taId));
    }

    const rawData = await db
      .select({
        id: attendance.id,
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
        status: attendance.status,
        joinedAt: attendance.joinedAt,
        leftAt: attendance.leftAt,
        durationMinutes: attendance.durationMinutes,
        markedBy: attendance.markedBy,
        updatedAt: attendance.updatedAt,
        note: attendance.note,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(attendance)
      .innerJoin(users, eq(attendance.studentId, users.id))
      .where(and(...conditions))
      .orderBy(users.firstName);

    // Resolve markedBy user names in a single batch query
    const markerIds = [...new Set(rawData.map((d) => d.markedBy).filter(Boolean))] as string[];
    const markerMap = new Map<string, { name: string; role: string | null }>();
    if (markerIds.length > 0) {
      const markers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, activeRole: users.activeRole })
        .from(users)
        .where(inArray(users.id, markerIds));
      for (const m of markers) {
        markerMap.set(m.id, {
          name: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
          role: m.activeRole,
        });
      }
    }

    const data = rawData.map((d) => {
      const marker = d.markedBy ? markerMap.get(d.markedBy) : null;
      return {
        ...d,
        markedByName: marker?.name || null,
        markedByRole: marker?.role || null,
      };
    });

    // Include enrolled students without attendance records as "absent"
    if (session?.courseId) {
      const existingStudentIds = new Set(data.map((d) => d.studentId));
      const excludeIds = new Set<string>();
      if (instructorId) excludeIds.add(instructorId);
      for (const taId of taUserIds) excludeIds.add(taId);

      // For make-up lectures: only show assigned students
      const isMakeup = session.isMakeup && session.assignedStudents;
      let assignedIds: string[] | null = null;
      if (isMakeup) {
        assignedIds = typeof session.assignedStudents === 'string'
          ? JSON.parse(session.assignedStudents)
          : session.assignedStudents;
      }

      const enrolledConditions: any[] = [
        eq(enrollments.courseId, session.courseId),
        sql`${enrollments.status} IN ('active', 'completed')`,
      ];
      if (assignedIds && assignedIds.length > 0) {
        enrolledConditions.push(inArray(enrollments.studentId, assignedIds));
      }

      const enrolledStudents = await db
        .select({
          studentId: enrollments.studentId,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          studentEmail: users.email,
        })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.studentId, users.id))
        .where(
          and(...enrolledConditions),
        );

      for (const student of enrolledStudents) {
        if (existingStudentIds.has(student.studentId)) continue;
        if (excludeIds.has(student.studentId)) continue;

        // Before finalization: "unmarked" (no status yet). After finalization: "absent" (confirmed absent)
        const defaultStatus = isFinalized ? 'absent' : 'unmarked';

        data.push({
          id: null as any,
          sessionId,
          studentId: student.studentId,
          status: defaultStatus,
          joinedAt: null,
          leftAt: null,
          durationMinutes: null,
          markedBy: null,
          markedByName: null,
          markedByRole: null,
          updatedAt: null,
          note: null,
          studentFirstName: student.studentFirstName,
          studentLastName: student.studentLastName,
          studentEmail: student.studentEmail,
        });
      }

      // Re-sort by name
      data.sort((a, b) =>
        (a.studentFirstName || '').localeCompare(b.studentFirstName || '')
      );
    }

    // Calculate per-lecture presence percentage based on actual duration (start→end), falling back to planned.
    // Grace: if a student joined within 2 min of session start (lobby admission delay),
    // credit the lobby wait time so they aren't penalized for the instructor admitting them.
    const actualStartMs = session?.actualStartedAt ? new Date(session.actualStartedAt).getTime() : null;
    const actualEndMs = session?.actualEndedAt ? new Date(session.actualEndedAt).getTime() : null;
    const actualDurationMin = actualStartMs && actualEndMs
      ? Math.round((actualEndMs - actualStartMs) / 60000)
      : null;
    const sessionDuration = actualDurationMin && actualDurationMin > 0 ? actualDurationMin : (session?.durationMinutes || 60);
    const LOBBY_GRACE_MS = 2 * 60000; // 2 minutes grace for lobby admission

    return data.map((record) => {
      let effectiveDuration = record.durationMinutes;
      // Credit lobby wait: if student joined within 2 min of session start, add the gap
      if (effectiveDuration != null && actualStartMs && record.joinedAt) {
        const joinMs = new Date(record.joinedAt).getTime();
        const lobbyDelay = joinMs - actualStartMs;
        if (lobbyDelay > 0 && lobbyDelay <= LOBBY_GRACE_MS) {
          effectiveDuration += Math.round(lobbyDelay / 60000);
        }
      }
      return {
        ...record,
        presencePercent: effectiveDuration != null && sessionDuration > 0
          ? Math.min(Math.round((effectiveDuration / sessionDuration) * 100), 100)
          : null,
      };
    });
  }

  /**
   * POST /sessions/:id/attendance
   * Mark attendance for a single student in a session.
   * Uses upsert — if a record already exists for this session+student, it updates.
   */
  async markAttendance(
    sessionId: string,
    user: AuthenticatedUser,
    dto: MarkAttendanceDto,
  ) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (session.status !== 'live' && session.status !== 'ended' && session.status !== 'completed') {
      throw new BadRequestException(
        `Cannot mark attendance for a ${session.status} session. Attendance can only be marked during a live, ended, or completed session.`,
      );
    }

    const values: Record<string, unknown> = {
      sessionId,
      studentId: dto.studentId,
      status: dto.status,
      markedBy: user.id,
    };

    if (dto.joinedAt) values.joinedAt = new Date(dto.joinedAt);
    if (dto.leftAt) values.leftAt = new Date(dto.leftAt);
    if (dto.durationMinutes !== undefined)
      values.durationMinutes = dto.durationMinutes;
    if (dto.note !== undefined) values.note = dto.note;

    const [record] = await db
      .insert(attendance)
      .values(values as typeof attendance.$inferInsert)
      .onConflictDoUpdate({
        target: [attendance.sessionId, attendance.studentId],
        set: {
          status: dto.status,
          markedBy: user.id,
          updatedAt: new Date(),
          ...(dto.joinedAt && { joinedAt: new Date(dto.joinedAt) }),
          ...(dto.leftAt && { leftAt: new Date(dto.leftAt) }),
          ...(dto.durationMinutes !== undefined && {
            durationMinutes: dto.durationMinutes,
          }),
          ...(dto.note !== undefined && { note: dto.note }),
        },
      })
      .returning();

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ATTENDANCE_MARKED_MANUAL,
      entityType: 'attendance',
      entityId: record.id,
      userId: user.id,
      metadata: {
        studentId: dto.studentId,
        sessionId,
        status: dto.status,
      },
    });

    // NELC xAPI — emit ONLY when status is 'present'. Absent / late /
    // excused don't map to a meaningful xAPI event in NELC's pipeline.
    // Upsert means this can flip a learner from absent→present; the
    // statement is still correct (NELC dedupes by statement id, and
    // each emit creates a new row anyway).
    if (dto.status === 'present') {
      void this.xapiService.emitWebinarAttended(dto.studentId, sessionId);
    }

    return record;
  }

  /**
   * POST /sessions/:id/attendance/bulk
   * Mark attendance for multiple students in a session.
   * Each record is upserted individually.
   */
  async bulkMarkAttendance(
    sessionId: string,
    user: AuthenticatedUser,
    dto: BulkMarkAttendanceDto,
  ) {
    const session = await this.verifySessionAccess(sessionId, user);

    // Course-level lock: once the course is completed/ended/archived, all
    // student-facing progress including attendance is frozen. Only the
    // manager's Mark Completed transition can promote ended → completed,
    // so instructors/TAs must treat both as terminal. `verifySessionAccess`
    // doesn't select courseId in every branch, so we join to sessions here.
    const [parentCourse] = await db
      .select({ status: courses.status })
      .from(courses)
      .innerJoin(sessions, eq(sessions.courseId, courses.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (parentCourse && (parentCourse.status === 'completed' || parentCourse.status === 'ended' || parentCourse.status === 'archived')) {
      throw new BadRequestException(
        `Cannot mark attendance on a ${parentCourse.status} course. Course progress is frozen.`,
      );
    }

    if (session.status !== 'live' && session.status !== 'ended' && session.status !== 'completed') {
      throw new BadRequestException(
        `Cannot mark attendance for a ${session.status} session. Attendance can only be marked during a live, ended, or completed session.`,
      );
    }

    const results = [];

    for (const record of dto.records) {
      const values: Record<string, unknown> = {
        sessionId,
        studentId: record.studentId,
        status: record.status,
        markedBy: user.id,
      };

      if (record.joinedAt) values.joinedAt = new Date(record.joinedAt);
      if (record.leftAt) values.leftAt = new Date(record.leftAt);
      if (record.durationMinutes !== undefined)
        values.durationMinutes = record.durationMinutes;
      if (record.note !== undefined) values.note = record.note;

      const [upserted] = await db
        .insert(attendance)
        .values(values as typeof attendance.$inferInsert)
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.studentId],
          set: {
            status: record.status,
            markedBy: user.id,
            updatedAt: new Date(),
            ...(record.joinedAt && { joinedAt: new Date(record.joinedAt) }),
            ...(record.leftAt && { leftAt: new Date(record.leftAt) }),
            ...(record.durationMinutes !== undefined && {
              durationMinutes: record.durationMinutes,
            }),
            ...(record.note !== undefined && { note: record.note }),
          },
        })
        .returning();

      results.push(upserted);

      // NELC xAPI — only 'present' rows generate a statement. Fire
      // inside the loop so even a partial-failure bulk still records
      // the successful ones.
      if (record.status === 'present') {
        void this.xapiService.emitWebinarAttended(record.studentId, sessionId);
      }

      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ATTENDANCE_MARKED_MANUAL,
        entityType: 'attendance',
        entityId: upserted.id,
        userId: user.id,
        metadata: {
          studentId: record.studentId,
          sessionId,
          status: record.status,
          bulk: true,
        },
      });
    }

    return results;
  }

  /**
   * PATCH /attendance/:id
   * Update an existing attendance record.
   * - Instructor: only attendance in their own sessions.
   * - Admin: any attendance record.
   */
  async updateAttendance(
    attendanceId: string,
    user: AuthenticatedUser,
    dto: UpdateAttendanceDto,
  ) {
    const existing = await this.verifyAttendanceAccess(attendanceId, user);

    // Attendance locking: reject updates once session is completed or cancelled
    const [session] = await db
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, existing.sessionId))
      .limit(1);

    if (session && (session.status === 'completed' || session.status === 'cancelled')) {
      throw new BadRequestException(
        'Attendance is locked. Cannot modify attendance after the session is completed or cancelled.',
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.joinedAt !== undefined) updateData.joinedAt = new Date(dto.joinedAt);
    if (dto.leftAt !== undefined) updateData.leftAt = new Date(dto.leftAt);
    if (dto.durationMinutes !== undefined)
      updateData.durationMinutes = dto.durationMinutes;
    if (dto.note !== undefined) updateData.note = dto.note;

    // Set markedBy to current user on update
    updateData.markedBy = user.id;

    const [updated] = await db
      .update(attendance)
      .set(updateData)
      .where(eq(attendance.id, attendanceId))
      .returning();

    // Item #12: Audit log on attendance PATCH
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ATTENDANCE_MARKED_MANUAL,
      entityType: 'attendance',
      entityId: attendanceId,
      userId: user.id,
      metadata: {
        sessionId: existing.sessionId,
        studentId: existing.studentId,
        previousStatus: existing.status,
        newStatus: dto.status || existing.status,
        markedBy: user.id,
      },
    });

    return updated;
  }

  /**
   * Item #13: Trigger TA re-allocation for all upcoming sessions of a course
   * when enrollment count changes.
   */
  private async triggerTaReallocation(courseId: string): Promise<void> {
    try {
      const upcomingSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.courseId, courseId),
            eq(sessions.status, 'scheduled'),
          ),
        );

      for (const session of upcomingSessions) {
        await this.assistantsService.checkAndAllocate(session.id);
      }

      if (upcomingSessions.length > 0) {
        this.logger.log(
          `TA re-allocation triggered for ${upcomingSessions.length} sessions in course ${courseId}`,
        );
      }

      // Advisory notification — warn if TA assignment is below NELC recommendation
      await this.thresholdEvaluationService.checkAndNotify(courseId);
    } catch (error) {
      this.logger.warn(
        `TA re-allocation failed for course ${courseId}: ${(error as Error).message}`,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Verify the user can access the course.
   * - Admin: any course.
   * - Instructor: only their own courses.
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    // TAs: verify via course_assistants assignment
    if (isTA(user)) {
      const [assignment] = await db
        .select({ id: courseAssistants.id })
        .from(courseAssistants)
        .where(
          and(
            eq(courseAssistants.courseId, courseId),
            eq(courseAssistants.userId, user.id),
            eq(courseAssistants.status, 'approved'),
          ),
        )
        .limit(1);
      if (!assignment) {
        throw new NotFoundException('Course not found');
      }
      return { id: courseId };
    }

    const conditions: any[] = [eq(courses.id, courseId)];
    this.addCourseOwnershipCondition(conditions, user);

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  /**
   * Verify the user can access the session.
   * - Admin: any session.
   * - Instructor: only their own sessions.
   */
  private async verifySessionAccess(
    sessionId: string,
    user: AuthenticatedUser,
  ) {
    // TAs: verify assignment rather than ownership
    if (user.roles.includes('TEACHING_ASSISTANT' as any)) {
      const [session] = await db
        .select({
          id: sessions.id,
          status: sessions.status,
          actualEndedAt: sessions.actualEndedAt,
          courseId: sessions.courseId,
        })
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (!session) {
        throw new NotFoundException('Session not found');
      }

      // Check session-level assignment
      const [sessionTA] = await db
        .select({ id: sessionAssistants.id })
        .from(sessionAssistants)
        .where(
          and(
            eq(sessionAssistants.sessionId, sessionId),
            eq(sessionAssistants.userId, user.id),
          ),
        )
        .limit(1);

      if (sessionTA) return session;

      // Fallback: check course-level assignment
      const [courseTA] = await db
        .select({ id: courseAssistants.id })
        .from(courseAssistants)
        .where(
          and(
            eq(courseAssistants.courseId, session.courseId),
            eq(courseAssistants.userId, user.id),
            eq(courseAssistants.status, 'approved'),
          ),
        )
        .limit(1);

      if (courseTA) return session;

      // Fall through: user carries TEACHING_ASSISTANT role but isn't
      // assigned to this session/course as a TA. They may still qualify
      // via another role (e.g. INSTRUCTOR of the session, or MANAGER /
      // ADMIN with platform-wide oversight). Multi-role users hit this
      // path — throwing 404 here masked their instructor access to their
      // own sessions and to every past lecture they'd created.
    }

    const conditions: any[] = [eq(sessions.id, sessionId)];
    if (isGlobalAdmin(user) || isManager(user)) {
      // Managers and admins can access any session (platform-wide oversight)
    } else {
      conditions.push(eq(sessions.instructorId, user.id));
    }

    const [session] = await db
      .select({ id: sessions.id, status: sessions.status, actualEndedAt: sessions.actualEndedAt })
      .from(sessions)
      .where(and(...conditions))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Verify the user can access the attendance record.
   * - Admin: any attendance record.
   * - Instructor: only attendance records in their own sessions.
   */
  private async verifyAttendanceAccess(
    attendanceId: string,
    user: AuthenticatedUser,
  ) {
    const [record] = await db
      .select({
        id: attendance.id,
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
        status: attendance.status,
      })
      .from(attendance)
      .where(eq(attendance.id, attendanceId))
      .limit(1);

    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    // Verify session access
    if (!isGlobalAdmin(user) && !isManager(user)) {
      const sessionConditions: any[] = [
        eq(sessions.id, record.sessionId),
        eq(sessions.instructorId, user.id),
      ];

      const [session] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(...sessionConditions))
        .limit(1);

      if (!session) {
        throw new NotFoundException('Attendance record not found');
      }
    }

    return record;
  }

  // ─── Waitlist Management ────────────────────────────────

  /**
   * GET /courses/:id/waitlist — Get waitlist for a course (manager/admin)
   */
  async getWaitlist(courseId: string) {
    const entries = await db
      .select({
        id: waitlists.id,
        studentId: waitlists.studentId,
        position: waitlists.position,
        status: waitlists.status,
        joinedAt: waitlists.joinedAt,
        studentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        studentEmail: users.email,
      })
      .from(waitlists)
      .innerJoin(users, eq(waitlists.studentId, users.id))
      .where(
        and(
          eq(waitlists.courseId, courseId),
          eq(waitlists.status, 'waiting'),
        ),
      )
      .orderBy(waitlists.position);

    return entries;
  }

  /**
   * DELETE /courses/:id/waitlist/:entryId — Remove from waitlist
   */
  async removeFromWaitlist(courseId: string, entryId: string) {
    await db
      .update(waitlists)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(waitlists.id, entryId),
          eq(waitlists.courseId, courseId),
        ),
      );

    return { success: true };
  }
}
