import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, count, sql, inArray, or } from 'drizzle-orm';
import { db } from '../../database';
import {
  certificateRequests,
  courses,
  courseRatings,
  instructorRatings,
  enrollments,
  sessions,
  attendance,
  assessments,
  submissions,
  users,
  courseModules,
  moduleCompletions,
  CERTIFICATE_STATUS,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager } from '../../common/role-helpers';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { XapiService } from '../xapi/xapi.service';
import {
  formatPlatformDate as fmtPlatformDate,
  toArabicIndic,
  type PlatformLocaleSettings,
} from '../../common/platform-locale';
import { decryptPII } from '../../common/crypto';
import { RejectCertificateDto } from './dto/reject-certificate.dto';
import { HoldCertificateDto } from './dto/hold-certificate.dto';
import { RevokeCertificateDto } from './dto/revoke-certificate.dto';
import { BatchCertificateDto } from './dto/batch-certificate.dto';
import * as QRCode from 'qrcode';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly auditService: NelcAuditService,
    private readonly auditLogService: AuditLogService,
    private readonly adminSettings: AdminSettingsService,
    private readonly xapiService: XapiService,
  ) {}

  /** Fetch admin-configured locale settings — used for certificate date rendering. */
  private async getPlatformLocale(): Promise<
    Pick<PlatformLocaleSettings, 'dateFormat' | 'numberSystem'>
  > {
    try {
      const s = await this.adminSettings.getPublicLocaleSettings();
      return { dateFormat: s.dateFormat, numberSystem: s.numberSystem };
    } catch {
      return { dateFormat: 'DD-MM-YYYY', numberSystem: 'western' };
    }
  }

  // ─── Role helpers ─────────────────────────────────────────

  /**
   * Write an admin-initiated certificate action to platform audit_logs.
   * No-op when actor is not a global admin — manager actions are covered
   * by the NELC audit (regulator-facing) and the per-row reviewedBy
   * fields. This second log surfaces platform oversight in the admin
   * Logs page.
   */
  private async maybeLogAdminCertAction(
    actor: AuthenticatedUser,
    certificateId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!isGlobalAdmin(actor)) return;
    await this.auditLogService.log({
      entityType: 'certificate_request',
      entityId: certificateId,
      action,
      performedBy: actor.id,
      metadata,
    });
  }

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

  /**
   * Throw 400 if the student hasn't submitted the reviews required to request
   * a certificate. Required: course review always; instructor review only
   * when the course has an assigned instructor. Submission status only —
   * a rejected review still counts so a manager can't permanently block.
   */
  private async assertReviewsSubmitted(
    courseId: string,
    studentId: string,
  ): Promise<void> {
    const [course] = await db
      .select({ instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const [courseRow] = await db
      .select({ id: courseRatings.id })
      .from(courseRatings)
      .where(
        and(
          eq(courseRatings.courseId, courseId),
          eq(courseRatings.studentId, studentId),
        ),
      )
      .limit(1);

    if (!courseRow) {
      throw new BadRequestException(
        'Please submit a course review before requesting your certificate.',
      );
    }

    if (course?.instructorId) {
      const [instrRow] = await db
        .select({ id: instructorRatings.id })
        .from(instructorRatings)
        .where(
          and(
            eq(instructorRatings.courseId, courseId),
            eq(instructorRatings.studentId, studentId),
          ),
        )
        .limit(1);
      if (!instrRow) {
        throw new BadRequestException(
          'Please submit an instructor review before requesting your certificate.',
        );
      }
    }
  }

  // ─── Eligibility Computation ────────────────────────────────

  /**
   * Compute eligibility fields for a student in a course:
   * - attendancePercent: (present + late) / total sessions * 100
   * - assessmentPassed: student passed ALL required assessments (graded submissions with percentage >= passingMarks/totalMarks*100)
   * - courseCompleted: enrollment progress === 100
   */
  private async computeEligibility(
    courseId: string,
    studentId: string,
  ): Promise<{
    attendancePercent: string;
    assessmentPassed: boolean;
    courseCompleted: boolean;
  }> {
    // Fetch course delivery type to apply correct eligibility rules
    const [course] = await db
      .select({ deliveryType: courses.deliveryType })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const isSelfPaced = course?.deliveryType === 'self-paced';
    const isBlended = course?.deliveryType === 'blended';

    // 1. Attendance percentage
    // Self-paced: no sessions → attendance N/A (auto-pass)
    // Synchronous/Blended: (present + late) / total sessions * 100
    let attendancePercent = '0.00';

    if (isSelfPaced) {
      // Self-paced courses have no live sessions; attendance is not applicable
      attendancePercent = '100.00';
    } else {
      // Only count completed (finalized) sessions — exclude missed/cancelled/scheduled
      // Students shouldn't be penalized for sessions the instructor never started
      const courseSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.courseId, courseId),
            sql`${sessions.status} IN ('completed', 'ended')`,
          ),
        );

      if (courseSessions.length > 0) {
        const sessionIds = courseSessions.map((s) => s.id);

        const [attendedResult] = await db
          .select({ count: count() })
          .from(attendance)
          .where(
            and(
              inArray(attendance.sessionId, sessionIds),
              eq(attendance.studentId, studentId),
              sql`${attendance.status} IN ('present', 'late')`,
            ),
          );

        const attended = Number(attendedResult?.count ?? 0);
        const total = courseSessions.length;
        attendancePercent = ((attended / total) * 100).toFixed(2);
      }
    }

    // 2. Assessment passed — student must have passed ALL published assessments for this course
    const courseAssessments = await db
      .select({
        id: assessments.id,
        totalMarks: assessments.totalMarks,
        passingMarks: assessments.passingMarks,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.courseId, courseId),
          eq(assessments.status, 'published'),
        ),
      );

    let assessmentPassed = true;

    if (courseAssessments.length > 0) {
      for (const assessment of courseAssessments) {
        const [bestSubmission] = await db
          .select({ score: submissions.score })
          .from(submissions)
          .where(
            and(
              eq(submissions.assessmentId, assessment.id),
              eq(submissions.studentId, studentId),
              eq(submissions.status, 'graded'),
            ),
          )
          .orderBy(desc(submissions.score))
          .limit(1);

        if (!bestSubmission) {
          assessmentPassed = false;
          break;
        }

        const passingMarks = assessment.passingMarks ?? 0;
        if ((bestSubmission.score ?? 0) < passingMarks) {
          assessmentPassed = false;
          break;
        }
      }
    }

    // 3. Course completion
    const [enrollment] = await db
      .select({ status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    // For self-paced / blended we need to know whether ALL modules are
    // marked complete by this student. Previously this was inferred from
    // `enrollment.progress >= 100`, but progress is now a unified aggregate
    // (modules + attendance + assessments) and would yield false positives.
    // Read directly from module_completions instead.
    let allModulesDone = true;
    if (isSelfPaced || isBlended) {
      const [moduleCountRow] = await db
        .select({ c: count() })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));
      const [completedRow] = await db
        .select({ c: count() })
        .from(moduleCompletions)
        .where(
          and(
            eq(moduleCompletions.studentId, studentId),
            eq(moduleCompletions.courseId, courseId),
          ),
        );
      const totalModules = Number(moduleCountRow?.c ?? 0);
      const completedModules = Number(completedRow?.c ?? 0);
      allModulesDone = totalModules > 0 && completedModules >= totalModules;
    }

    let courseCompleted = false;

    if (isSelfPaced) {
      // Self-paced: every module must be marked complete.
      courseCompleted = allModulesDone;
    } else if (isBlended) {
      // Blended: enrollment marked completed AND every module done.
      courseCompleted = enrollment
        ? enrollment.status === 'completed' && allModulesDone
        : false;
    } else {
      // Synchronous (zoom/onsite): enrollment status is 'completed'
      courseCompleted = enrollment ? enrollment.status === 'completed' : false;
    }

    return { attendancePercent, assessmentPassed, courseCompleted };
  }

  // ─── Student Certificates ──────────────────────────────────

  /**
   * GET /certificates/my-certificates — Get student's approved and revoked certificates.
   */
  async getStudentCertificates(studentId: string) {
    return db
      .select({
        id: certificateRequests.id,
        courseId: certificateRequests.courseId,
        status: certificateRequests.status,
        certificateUrl: certificateRequests.certificateUrl,
        reviewNote: certificateRequests.reviewNote,
        createdAt: certificateRequests.createdAt,
        reviewedAt: certificateRequests.reviewedAt,
        courseName: courses.title,
        courseThumbnail: courses.thumbnail,
      })
      .from(certificateRequests)
      .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
      .where(
        and(
          eq(certificateRequests.studentId, studentId),
          sql`${certificateRequests.status} IN ('approved', 'revoked')`,
        ),
      )
      .orderBy(desc(certificateRequests.reviewedAt));
  }

  // ─── Public Certificate Verification ───────────────────────

  /**
   * GET /certificates/verify/:id — Public verification.
   * Returns limited public info about an approved certificate.
   */
  async verifyCertificate(certId: string) {
    // Support full UUID OR PG-prefixed short codes. Historically codes
    // were 8 hex chars (~4 billion combinations — brute-forceable in
    // theory, mitigated by edge rate-limiting); new certificates issue
    // 16-char codes (~1.8 quintillion — enumeration impractical). We
    // accept 8-32 hex chars on input so previously-printed certificates
    // remain verifiable while new ones are stronger.
    let lookupId = certId;
    if (certId.toUpperCase().startsWith('PG-')) {
      const shortHex = certId.slice(3).toLowerCase();
      if (!/^[0-9a-f]{8,32}$/.test(shortHex)) {
        throw new NotFoundException('Certificate not found');
      }
      // Prefix-match against the UUID's hex representation with hyphens
      // stripped (since the displayed short code uses hyphen-free hex).
      // Length of the prefix is whatever the caller sent — older 8-char
      // codes still match (8 chars from the first UUID segment), newer
      // 16-char codes match much more specifically.
      const [match] = await db
        .select({ id: certificateRequests.id })
        .from(certificateRequests)
        .where(
          sql`LEFT(REPLACE(${certificateRequests.id}::text, '-', ''), ${shortHex.length}) = ${shortHex}`,
        )
        .limit(1);
      if (match) {
        lookupId = match.id;
      } else {
        throw new NotFoundException('Certificate not found');
      }
    }

    const [cert] = await db
      .select({
        id: certificateRequests.id,
        status: certificateRequests.status,
        createdAt: certificateRequests.createdAt,
        reviewedAt: certificateRequests.reviewedAt,
        attendancePercent: certificateRequests.attendancePercent,
        courseName: courses.title,
        courseNameAr: courses.titleAr,
        accreditationNumber: courses.accreditationNumber,
        totalHours: courses.cmeHours,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(certificateRequests)
      .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
      .innerJoin(users, eq(certificateRequests.studentId, users.id))
      .where(eq(certificateRequests.id, lookupId))
      .limit(1);

    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    const isVerified = cert.status === CERTIFICATE_STATUS.APPROVED;

    return {
      id: cert.id,
      verified: isVerified,
      status: cert.status,
      studentName: `${cert.studentFirstName || ''} ${cert.studentLastName || ''}`.trim(),
      courseName: cert.courseName,
      courseNameAr: cert.courseNameAr,
      accreditationNumber: cert.accreditationNumber,
      totalHours: cert.totalHours,
      issuedDate: cert.reviewedAt || cert.createdAt,
      certificateId: `PG-${cert.id.replace(/-/g, '').slice(0, 16).toUpperCase()}`,
    };
  }

  // ─── Create Certificate Request ─────────────────────────────

  /**
   * POST /certificates — Student or instructor creates a certificate request.
   * Auto-computes eligibility fields.
   */
  async createRequest(courseId: string, studentId: string, skipEligibilityCheck = false) {
    // Verify the student is enrolled in the course
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new BadRequestException(
        'Student is not enrolled in this course',
      );
    }

    // For CPD/CME courses, SCFHS number is required. Also enforce the course
    // must be `completed` before a certificate can be requested — `ended`
    // freezes progress but stays locked until a manager clicks Mark Completed.
    // The Mark Completed path bypasses this check via `skipEligibilityCheck`.
    const [courseInfo] = await db
      .select({ isCmeAccredited: courses.isCmeAccredited, status: courses.status })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!skipEligibilityCheck && courseInfo?.status !== 'completed') {
      throw new BadRequestException(
        'Certificate can be requested only after the course is marked as completed.',
      );
    }

    if (courseInfo?.isCmeAccredited) {
      const [student] = await db
        .select({ scfhsNumber: users.scfhsNumber })
        .from(users)
        .where(eq(users.id, studentId))
        .limit(1);

      const scfhsPlain = decryptPII(student?.scfhsNumber);
      if (!scfhsPlain?.trim()) {
        throw new BadRequestException(
          'SCFHS Registration Number is required for CPD certificate issuance. Please update your profile with your Mumaris+ number.',
        );
      }
    }

    // Check for duplicate request
    const [existing] = await db
      .select({ id: certificateRequests.id, status: certificateRequests.status })
      .from(certificateRequests)
      .where(
        and(
          eq(certificateRequests.courseId, courseId),
          eq(certificateRequests.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        `A certificate request already exists with status: ${existing.status}`,
      );
    }

    // Dual-review gate — student must have submitted both course review and
    // instructor review (when course has an instructor). Submission status
    // only; rejected reviews still count, otherwise an unresponsive manager
    // could block a student forever. The points reward fires later only when
    // both are *approved*, but the cert request opens on submission.
    await this.assertReviewsSubmitted(courseId, studentId);

    // Compute eligibility
    const eligibility = await this.computeEligibility(courseId, studentId);

    // All certificate requests are accepted regardless of eligibility.
    // Eligibility data is stored for the manager to review and decide.

    const [request] = await db
      .insert(certificateRequests)
      .values({
        courseId,
        studentId,
        attendancePercent: eligibility.attendancePercent,
        assessmentPassed: eligibility.assessmentPassed,
        courseCompleted: eligibility.courseCompleted,
      })
      .returning();

    return request;
  }

  // ─── List Pending Certificates ──────────────────────────────

  /**
   * GET /instructor/certificates — List certificate requests.
   * - Instructor: only for their own courses, default status=pending.
   * - Admin: all, with optional filters.
   */
  async findPending(
    user: AuthenticatedUser,
    params: {
      courseId?: string;
      status?: string;
      page?: number;
      limit?: number;
      // Admin-only filters. Manager/instructor are already ownership-scoped
      // by the role branch below, so passing these as a non-admin would just
      // narrow further — never widen.
      managerId?: string;
      search?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    // Scope by role
    if (!isGlobalAdmin(user)) {
      const scopedCourseIds = isManager(user)
        ? await this.getManagedCourseIds(user.id)
        : await this.getInstructorCourseIds(user.id);
      if (scopedCourseIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      conditions.push(
        sql`${certificateRequests.courseId} IN (${sql.join(
          scopedCourseIds.map((id) => sql`${id}`),
          sql`, `,
        )})` as any,
      );
    }

    if (params.courseId) {
      conditions.push(eq(certificateRequests.courseId, params.courseId));
    }

    if (params.managerId) {
      conditions.push(eq(courses.managerId, params.managerId));
    }

    if (params.search) {
      const q = `%${params.search}%`;
      conditions.push(
        sql`(${users.firstName} ILIKE ${q} OR ${users.lastName} ILIKE ${q} OR ${users.email} ILIKE ${q})` as any,
      );
    }

    // Status: "all" / undefined means no status filter (admin browses across
    // statuses); manager default is still pending for back-compat with
    // existing UI which doesn't pass status on first load.
    if (params.status === 'all') {
      // no status filter
    } else {
      const statusFilter =
        params.status &&
        Object.values(CERTIFICATE_STATUS).includes(params.status as any)
          ? params.status
          : CERTIFICATE_STATUS.PENDING;
      conditions.push(eq(certificateRequests.status, statusFilter));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Performer name lookups via correlated subqueries (same pattern as
    // courses.findAll). Avoids three separate user-table joins which would
    // produce alias soup and a cartesian-product risk.
    const performerNameSql = (col: unknown) =>
      sql<string | null>`(SELECT TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) FROM users u WHERE u.id = ${col as any})`;

    const data = await db
      .select({
        id: certificateRequests.id,
        courseId: certificateRequests.courseId,
        studentId: certificateRequests.studentId,
        status: certificateRequests.status,
        attendancePercent: certificateRequests.attendancePercent,
        assessmentPassed: certificateRequests.assessmentPassed,
        courseCompleted: certificateRequests.courseCompleted,
        reviewNote: certificateRequests.reviewNote,
        certificateUrl: certificateRequests.certificateUrl,
        createdAt: certificateRequests.createdAt,
        reviewedAt: certificateRequests.reviewedAt,
        // Per-transition audit columns
        approvedBy: certificateRequests.approvedBy,
        approvedAt: certificateRequests.approvedAt,
        rejectedBy: certificateRequests.rejectedBy,
        rejectedAt: certificateRequests.rejectedAt,
        rejectionReason: certificateRequests.rejectionReason,
        revokedBy: certificateRequests.revokedBy,
        revokedAt: certificateRequests.revokedAt,
        revocationReason: certificateRequests.revocationReason,
        // Performer display names
        approvedByName: performerNameSql(certificateRequests.approvedBy),
        rejectedByName: performerNameSql(certificateRequests.rejectedBy),
        revokedByName: performerNameSql(certificateRequests.revokedBy),
        // Student
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        // Course + manager
        courseTitle: courses.title,
        courseManagerId: courses.managerId,
        courseManagerName: sql<string | null>`(SELECT TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) FROM users u WHERE u.id = ${courses.managerId})`,
      })
      .from(certificateRequests)
      .innerJoin(users, eq(certificateRequests.studentId, users.id))
      .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
      .where(whereClause)
      .orderBy(desc(certificateRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(certificateRequests)
      .innerJoin(users, eq(certificateRequests.studentId, users.id))
      .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
      .where(whereClause);

    return {
      data,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    };
  }

  // ─── Get Single Certificate Request ─────────────────────────

  /**
   * GET /certificates/:id — Get certificate request detail.
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const request = await this.verifyRequestAccess(id, user);
    return request;
  }

  // ─── Approve ────────────────────────────────────────────────

  /**
   * PATCH /certificates/:id/approve — Approve a certificate request.
   * Generates a placeholder PDF and uploads it.
   */
  async approve(id: string, user: AuthenticatedUser) {
    const request = await this.verifyRequestAccess(id, user);

    if (request.status !== CERTIFICATE_STATUS.PENDING && request.status !== CERTIFICATE_STATUS.HELD) {
      throw new BadRequestException(
        'Only pending or held certificate requests can be approved',
      );
    }

    // Eligibility is computed and stored on the certificate request
    // but NOT enforced here — the manager has full authority to approve
    // or reject regardless of eligibility. The frontend shows a
    // confirmation dialog with eligibility details before approving.

    // Check SCFHS number before issuing certificate
    const [studentForScfhs] = await db
      .select({ scfhsNumber: users.scfhsNumber })
      .from(users)
      .where(eq(users.id, request.studentId))
      .limit(1);

    const scfhsNumberPlain = decryptPII(studentForScfhs?.scfhsNumber);
    if (!scfhsNumberPlain?.trim()) {
      throw new BadRequestException(
        'Cannot issue certificate: Student has not provided their SCFHS Registration Number. The student must add their Mumaris+ number in their profile settings first.',
      );
    }

    // Generate certificate PDF
    let certificateUrl: string;
    try {
      certificateUrl = await this.generatePlaceholderPdf(
        request.id,
        request.courseId,
        request.studentId,
      );
    } catch (error) {
      const errMsg = error?.message || String(error);
      this.logger.error(`Failed to generate certificate PDF for request ${id}: ${errMsg}`);
      throw new BadRequestException(
        `Certificate PDF generation failed: ${errMsg}`,
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(certificateRequests)
      .set({
        status: CERTIFICATE_STATUS.APPROVED,
        // Legacy single-slot fields — keep populated for manager UI back-compat
        reviewedBy: user.id,
        reviewedAt: now,
        // Per-transition audit columns — preserve full history
        approvedBy: user.id,
        approvedAt: now,
        certificateUrl,
      })
      .where(eq(certificateRequests.id, id))
      .returning();

    await this.maybeLogAdminCertAction(user, id, 'certificate.approve', {
      courseId: request.courseId,
      studentId: request.studentId,
    });

    // Send email notification to student
    try {
      const studentName = `${request.studentFirstName || ''} ${request.studentLastName || ''}`.trim() || 'Student';
      const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, request.courseId)).limit(1);
      const courseName = course?.title || 'your course';
      const locale = (request.studentLanguage || 'en') as 'en' | 'ar';
      await this.emailService.sendCertificateApproved(
        request.studentEmail,
        studentName,
        courseName,
        certificateUrl,
        locale,
      );
    } catch (error) {
      this.logger.error(`Failed to send certificate approval email for request ${id}`, error);
    }

    // NELC xAPI — certificate earned. Fire-and-forget.
    void this.xapiService.emitCertificateIssued(
      request.studentId,
      request.courseId,
      id,
      certificateUrl,
    );

    return updated;
  }

  // ─── Reject ─────────────────────────────────────────────────

  /**
   * PATCH /certificates/:id/reject — Reject a certificate request.
   * Requires a rejection note.
   */
  async reject(
    id: string,
    user: AuthenticatedUser,
    dto: RejectCertificateDto,
  ) {
    const request = await this.verifyRequestAccess(id, user);

    if (request.status !== CERTIFICATE_STATUS.PENDING && request.status !== CERTIFICATE_STATUS.HELD) {
      throw new BadRequestException(
        'Only pending or held certificate requests can be rejected',
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(certificateRequests)
      .set({
        status: CERTIFICATE_STATUS.REJECTED,
        reviewedBy: user.id,
        reviewNote: dto.note,
        reviewedAt: now,
        rejectedBy: user.id,
        rejectedAt: now,
        rejectionReason: dto.note,
      })
      .where(eq(certificateRequests.id, id))
      .returning();

    await this.maybeLogAdminCertAction(user, id, 'certificate.reject', {
      courseId: request.courseId,
      studentId: request.studentId,
      reason: dto.note,
    });

    // Send email notification to student
    try {
      const studentName = `${request.studentFirstName || ''} ${request.studentLastName || ''}`.trim() || 'Student';
      const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, request.courseId)).limit(1);
      const courseName = course?.title || 'your course';
      const locale = (request.studentLanguage || 'en') as 'en' | 'ar';
      await this.emailService.sendCertificateRejected(
        request.studentEmail,
        studentName,
        courseName,
        dto.note,
        locale,
      );
    } catch (error) {
      this.logger.error(`Failed to send certificate rejection email for request ${id}`, error);
    }

    return updated;
  }

  // ─── Hold ───────────────────────────────────────────────────

  /**
   * PATCH /certificates/:id/hold — Put a certificate request on hold.
   * Requires an audit note.
   */
  async hold(
    id: string,
    user: AuthenticatedUser,
    dto: HoldCertificateDto,
  ) {
    const request = await this.verifyRequestAccess(id, user);

    if (request.status !== CERTIFICATE_STATUS.PENDING) {
      throw new BadRequestException(
        'Only pending certificate requests can be placed on hold',
      );
    }

    const [updated] = await db
      .update(certificateRequests)
      .set({
        status: CERTIFICATE_STATUS.HELD,
        reviewedBy: user.id,
        reviewNote: dto.note,
        reviewedAt: new Date(),
      })
      .where(eq(certificateRequests.id, id))
      .returning();

    // Send email notification to student
    try {
      const studentName = `${request.studentFirstName || ''} ${request.studentLastName || ''}`.trim() || 'Student';
      const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, request.courseId)).limit(1);
      const courseName = course?.title || 'your course';
      const locale = (request.studentLanguage || 'en') as 'en' | 'ar';
      await this.emailService.sendCertificateHeld(
        request.studentEmail,
        studentName,
        courseName,
        dto.note,
        locale,
      );
    } catch (error) {
      this.logger.error(`Failed to send certificate hold email for request ${id}`, error);
    }

    return updated;
  }

  // ─── Revoke ─────────────────────────────────────────────────

  /**
   * PATCH /certificates/:id/revoke — Revoke an approved certificate.
   * Only MANAGER/ADMIN can revoke. Requires a reason.
   */
  async revoke(
    id: string,
    user: AuthenticatedUser,
    dto: RevokeCertificateDto,
  ) {
    const request = await this.verifyRequestAccess(id, user);

    if (request.status !== CERTIFICATE_STATUS.APPROVED) {
      throw new BadRequestException(
        'Only approved certificates can be revoked',
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(certificateRequests)
      .set({
        status: CERTIFICATE_STATUS.REVOKED,
        reviewedBy: user.id,
        reviewNote: dto.reason,
        reviewedAt: now,
        revokedBy: user.id,
        revokedAt: now,
        revocationReason: dto.reason,
        certificateUrl: null, // Invalidate the PDF
      })
      .where(eq(certificateRequests.id, id))
      .returning();

    // NELC audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.CERTIFICATE_REVOKED,
      entityType: 'certificate_request',
      entityId: id,
      userId: user.id,
      metadata: {
        courseId: request.courseId,
        studentId: request.studentId,
        reason: dto.reason,
      },
    });

    await this.maybeLogAdminCertAction(user, id, 'certificate.revoke', {
      courseId: request.courseId,
      studentId: request.studentId,
      reason: dto.reason,
    });

    // Send email notification to student
    try {
      const studentName = `${request.studentFirstName || ''} ${request.studentLastName || ''}`.trim() || 'Student';
      const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, request.courseId)).limit(1);
      const courseName = course?.title || 'your course';
      const locale = (request.studentLanguage || 'en') as 'en' | 'ar';
      await this.emailService.sendCertificateRejected(
        request.studentEmail,
        studentName,
        courseName,
        `Certificate revoked: ${dto.reason}`,
        locale,
      );
    } catch (error) {
      this.logger.error(`Failed to send certificate revocation email for request ${id}`, error);
    }

    return updated;
  }

  // ─── Batch Processing ──────────────────────────────────────

  /**
   * POST /certificates/batch — Process multiple certificate requests.
   * Supports approve, reject, hold actions.
   */
  async batch(user: AuthenticatedUser, dto: BatchCertificateDto) {
    const results: { id: string; status: string; error?: string }[] = [];

    for (const id of dto.ids) {
      try {
        let updated;

        switch (dto.action) {
          case 'approve':
            updated = await this.approve(id, user);
            break;
          case 'reject':
            if (!dto.note) {
              results.push({
                id,
                status: 'error',
                error: 'A rejection note is required',
              });
              continue;
            }
            updated = await this.reject(id, user, { note: dto.note });
            break;
          case 'hold':
            if (!dto.note) {
              results.push({
                id,
                status: 'error',
                error: 'An audit note is required when holding',
              });
              continue;
            }
            updated = await this.hold(id, user, { note: dto.note });
            break;
        }

        results.push({ id, status: updated.status });
      } catch (error) {
        results.push({
          id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successful = results.filter((r) => r.status !== 'error').length;
    const failed = results.filter((r) => r.status === 'error').length;

    return {
      processed: dto.ids.length,
      successful,
      failed,
      results,
    };
  }

  // ─── PDF Generation with QR Code ─────────────────────────────

  /**
   * Generate a certificate PDF with QR code using PDFKit.
   * QR code links to the public verification endpoint.
   */
  /**
   * Build the certificate PDF in memory. Returns just the bytes so callers
   * can either upload it once (for the persisted approval flow) or serve
   * it inline (for language-specific downloads that shouldn't overwrite
   * the stored default).
   */
  private async generatePlaceholderPdfBuffer(
    requestId: string,
    courseId: string,
    studentId: string,
    lang: 'en' | 'ar' = 'en',
  ): Promise<Buffer> {
    const platformLocale = await this.getPlatformLocale();
    const [student] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        firstNameAr: users.firstNameAr,
        lastNameAr: users.lastNameAr,
        email: users.email,
        scfhsNumber: users.scfhsNumber,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    const [course] = await db
      .select({
        title: courses.title,
        titleAr: courses.titleAr,
        cmeHours: courses.cmeHours,
        isCmeAccredited: courses.isCmeAccredited,
        accreditationNumber: courses.accreditationNumber,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const studentNameEn =
      `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';
    const studentNameAr =
      `${student?.firstNameAr || ''} ${student?.lastNameAr || ''}`.trim() || '';
    // Check if the English name actually contains Arabic characters
    const hasArabicChars = (text: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
    // Name display: prefer the buyer's own script by requested language.
    // AR: use Arabic name when available; fall back to whatever's on the row.
    // EN: use Latin name; fall back to Arabic ONLY when no Latin name exists.
    // Never render a name in a font that can't shape its script \u2014 track
    // nameIsArabic off the ACTUAL displayed string, not off availability.
    const displayName =
      lang === 'ar'
        ? studentNameAr || studentNameEn
        : studentNameEn || studentNameAr;
    const nameIsArabic = hasArabicChars(displayName);
    // Course title: prefer the requested language, fall back to whichever
    // is populated. Instructors sometimes leave titleAr empty; showing the
    // English title on an AR cert beats showing "Course" or blank.
    const courseTitle =
      lang === 'ar'
        ? course?.titleAr || course?.title || 'Course'
        : course?.title || course?.titleAr || 'Course';
    const courseTitleIsArabic = hasArabicChars(courseTitle);
    const cmeHours = course?.cmeHours || 0;
    const issuedDate = new Date();
    // Long-form readable date (e.g. "24 DECEMBER 2026"). Apply admin's
    // numberSystem to the day/year digits.
    const longDate = issuedDate.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).toUpperCase();
    const dateFormatted =
      platformLocale.numberSystem === 'arabic_indic'
        ? toArabicIndic(longDate)
        : longDate;
    // 16-char short ID (was 8 — hardened to defeat enumeration / brute-force).
    // Strip hyphens from the UUID so we use 16 actual hex chars, not 12 chars
    // ending in a hyphen-segment. Older issued certificates still verify via
    // the 8-char path; see verifyCertificate() for the backward-compat lookup.
    const certificateId = `PG-${requestId.replace(/-/g, '').slice(0, 16).toUpperCase()}`;

    // Generate QR code as base64 data URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/en/verify/${requestId}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    // Fetch the certificate assets — primary logo (JPEG/PNG) + secondary
    // Saudi Commission accreditation mark (SVG). Both come from the
    // frontend static bucket. Cached per process. Missing assets are
    // non-fatal; the render skips them.
    const httpProto = frontendUrl.startsWith('https://')
      ? require('https')
      : require('http');
    const tryFetch = (url: string): Promise<Buffer> =>
      new Promise((res, rej) => {
        httpProto.get(url, (resp: any) => {
          if (resp.statusCode !== 200) { rej(new Error(`Asset HTTP ${resp.statusCode}`)); return; }
          const chunks: Buffer[] = [];
          resp.on('data', (c: Buffer) => chunks.push(c));
          resp.on('end', () => res(Buffer.concat(chunks)));
          resp.on('error', rej);
        }).on('error', rej);
      });

    let logoBuffer: Buffer | null = null;
    if (!(this as any)._certLogoCacheBuffer) {
      try {
        logoBuffer = await tryFetch(`${frontendUrl}/logo-certificate.jpeg`);
      } catch {
        try {
          // Fallback keeps the render working across environments where
          // the cert-branded asset isn't deployed yet.
          logoBuffer = await tryFetch(`${frontendUrl}/images/logo.png`);
        } catch { /* logo is optional */ }
      }
      if (logoBuffer) (this as any)._certLogoCacheBuffer = logoBuffer;
    } else {
      logoBuffer = (this as any)._certLogoCacheBuffer;
    }

    let secondaryLogoSvg: string | null = null;
    if (!(this as any)._secondaryLogoCacheSvg) {
      try {
        const buf = await tryFetch(`${frontendUrl}/saudi-health.svg`);
        secondaryLogoSvg = buf.toString('utf8');
        (this as any)._secondaryLogoCacheSvg = secondaryLogoSvg;
      } catch { /* secondary logo is optional */ }
    } else {
      secondaryLogoSvg = (this as any)._secondaryLogoCacheSvg;
    }

    // Load Arabic font when any rendered string needs Arabic glyphs — name,
    // course title, or the localized body labels themselves (when lang=ar).
    // Previous code loaded it only for the name; a long AR course title on
    // an EN cert would tofu-box in Helvetica-Bold.
    const needsArabicFont = nameIsArabic || courseTitleIsArabic || lang === 'ar';
    let arabicFontBuf: Buffer | null = null;
    if (needsArabicFont) {
      if (!(this as any)._arabicFontBuf) {
        const { AMIRI_BOLD_BASE64 } = require('./amiri-bold-font');
        (this as any)._arabicFontBuf = Buffer.from(AMIRI_BOLD_BASE64, 'base64');
      }
      arabicFontBuf = (this as any)._arabicFontBuf;
    }

    // Locale-aware labels — the certificate is not just a name display but
    // a legal document; when lang=ar the entire template speaks Arabic.
    const L = lang === 'ar'
      ? {
          title: 'شهادة',
          subtitle: 'حضور',
          awardedTo: 'ممنوحة بكل فخر إلى',
          forAttending: 'لحضور',
          accreditedBy: 'هذا النشاط معتمد من الهيئة السعودية للتخصصات الصحية',
          numberDate: (n: string, d: string) => `رقم الاعتماد ${n}   التاريخ: ${d}`,
          courseAccreditation: (n: string) => `اعتماد الدورة: ${n}`,
          cmeHours: (h: number) => `${h} ساعات معتمدة CME/PD`,
          cmeBadge: 'ساعات معتمدة',
          scanToVerify: 'امسح للتحقق',
        }
      : {
          title: 'CERTIFICATE',
          subtitle: 'OF ATTENDANCE',
          awardedTo: 'PROUDLY AWARDED TO',
          forAttending: 'FOR ATTENDING',
          accreditedBy: 'This activity has been accredited by the Saudi Commission for Health Specialties',
          numberDate: (n: string, d: string) => `with accreditation number ${n}   Date: ${d}`,
          courseAccreditation: (n: string) => `Course Accreditation: ${n}`,
          cmeHours: (h: number) => `${h} CME/PD Credit Hours`,
          cmeBadge: 'CME HOURS',
          scanToVerify: 'Scan to verify',
        };

    // Generate QR as buffer for PDFKit
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    const pdfBuffer = await this.renderCertificatePdfBuffer({
      displayName,
      courseTitle,
      cmeHours,
      regNumber: decryptPII(student?.scfhsNumber) || certificateId,
      dateFormatted,
      accreditationDate: fmtPlatformDate(issuedDate, platformLocale),
      courseAccreditationNumber: course?.accreditationNumber ?? null,
      logoBuffer,
      secondaryLogoSvg,
      qrBuffer,
      arabicFontBuf,
      lang,
      L,
      hasArabicChars,
    });

    return pdfBuffer;
  }

  /**
   * PURE PDF render — takes all data as inputs, no DB / no storage.
   * Kept public-ish (private, but has a stable signature) so the sample
   * generator script in scripts/ can call the exact same code path we
   * ship to production. Any layout change here shows up in both the
   * approval sample and the real download.
   */
  private async renderCertificatePdfBuffer(input: {
    displayName: string;
    courseTitle: string;
    cmeHours: number;
    regNumber: string;
    dateFormatted: string;
    accreditationDate: string;
    courseAccreditationNumber: string | null;
    logoBuffer: Buffer | null;
    /** Second brand logo alongside the primary one (e.g. Saudi Commission
     *  accreditation mark). SVG string — pdfkit needs svg-to-pdfkit to
     *  render vector content. Optional; skipped when absent. */
    secondaryLogoSvg: string | null;
    qrBuffer: Buffer;
    arabicFontBuf: Buffer | null;
    lang: 'en' | 'ar';
    L: {
      title: string;
      subtitle: string;
      awardedTo: string;
      forAttending: string;
      accreditedBy: string;
      numberDate: (n: string, d: string) => string;
      courseAccreditation: (n: string) => string;
      cmeHours: (h: number) => string;
      cmeBadge: string;
      scanToVerify: string;
    };
    hasArabicChars: (s: string | null | undefined) => boolean;
  }): Promise<Buffer> {
    const {
      displayName, courseTitle, cmeHours, regNumber, dateFormatted,
      accreditationDate, courseAccreditationNumber,
      logoBuffer, secondaryLogoSvg, qrBuffer, arabicFontBuf, L, hasArabicChars,
    } = input;
    const SVGtoPDF = require('svg-to-pdfkit');

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = doc.page.width, H = doc.page.height, cx = W / 2;
        // Palette matches the reference sample — deeper navy, muted gold,
        // pale-blue pill fills. Kept centralized so a future Strapi color
        // pipeline can override in one place.
        const navy = '#0B2A5B';
        const navyDeep = '#001B4E';
        const gold = '#C69214';
        const lightBlue = '#BFDBFE';
        const gray = '#4B5563';
        const lightGray = '#9CA3AF';
        const dark = '#1F2937';

        // Background
        doc.rect(0, 0, W, H).fill('#FFFFFF');
        // Top decorative strip — solid navy band with a thin gold accent
        // underneath. Mirrors the sample's blue-on-blue header treatment.
        doc.rect(0, 0, W, 14).fill(navy);
        doc.rect(0, 14, W, 3).fill(gold);
        // Bottom strip — reciprocates the header for a framed feel.
        doc.rect(0, H - 10, W, 10).fill(navy);

        // Watermark — faint centered logo (original design). Falls back
        // to a text watermark when the logo asset is missing so the
        // sheet never renders bare.
        doc.save();
        doc.opacity(0.05);
        if (logoBuffer) {
          const wmW = 320;
          doc.image(logoBuffer, cx - wmW / 2, H / 2 - 110, { width: wmW });
        } else {
          doc.font('Helvetica-Bold').fontSize(90).fillColor(navy)
            .text('CERTIFICATE', 0, H / 2 - 60, { align: 'center', width: W });
        }
        doc.restore();

        // RTL layout mirroring — in AR the reading direction flips, so
        // the brand-logo pair moves to the RIGHT edge and the CME badge
        // moves to the LEFT edge. QR at the bottom likewise mirrors from
        // bottom-right to bottom-left. The center block stays centered
        // (align:'center' handles that regardless).
        const rtl = input.lang === 'ar';

        // Logo pair — actual rendered widths matter here, not slot
        // estimates. Primary logo is square (1024×1024 source) so at
        // height 55 it renders 55 wide. Secondary is the SCFHS SVG
        // (195×80 viewBox); we scale it to the same height and derive
        // width from the aspect ratio so preserveAspectRatio doesn't
        // leave dead padding inside the drawn box.
        const logoY = 44;
        const logoH = 55;
        const primaryW = 55;                              // square
        const secondaryLogoW = Math.round(logoH * 195 / 80); // ~134
        const logoGap = 14;
        const pairW = primaryW + logoGap + secondaryLogoW;
        // LTR: pair sits at the left edge. RTL: mirrored to the right,
        // with the primary logo staying on the "reading-first" side.
        const pairStartX = rtl ? W - 40 - pairW : 40;
        const primaryX = rtl
          ? pairStartX + secondaryLogoW + logoGap
          : pairStartX;
        const secondaryX = rtl
          ? pairStartX
          : pairStartX + primaryW + logoGap;
        if (logoBuffer) {
          doc.image(logoBuffer, primaryX, logoY, { height: logoH });
        }
        if (secondaryLogoSvg) {
          try {
            // Fit the SVG to its natural aspect ratio inside the box —
            // no leftover padding at the sides since box matches source.
            SVGtoPDF(doc, secondaryLogoSvg, secondaryX, logoY, {
              width: secondaryLogoW,
              height: logoH,
              preserveAspectRatio: 'xMidYMid meet',
            });
          } catch {
            // Bad SVG → skip silently rather than break the whole cert.
          }
        }

        // Register Arabic font once for the whole document if needed.
        if (arabicFontBuf) {
          doc.registerFont('Amiri-Bold', arabicFontBuf);
        }
        const arFontAvailable = !!arabicFontBuf;
        // Amiri covers Arabic only; Helvetica covers Latin. Route per-string
        // so an AR document with a Latin fallback (or vice versa) never
        // renders .notdef tofu boxes.
        const fontForText = (text: string, bold = true): string => {
          if (arFontAvailable && hasArabicChars(text)) return 'Amiri-Bold';
          return bold ? 'Helvetica-Bold' : 'Helvetica';
        };
        const featuresFor = (text: string): any =>
          hasArabicChars(text) ? ['rtla'] : undefined;

        // Bidi shim — pdfkit's rtla feature reverses the entire string
        // character-by-character, including Latin digit runs embedded in
        // Arabic sentences. That's why "23456" in "رقم الاعتماد 23456"
        // would render as "65432". Pre-reversing each Latin run cancels
        // out pdfkit's naive reversal so digits + English fragments read
        // in their natural left-to-right order within the RTL flow.
        //
        // No-op on pure Arabic or pure Latin strings — only mixed
        // strings need the treatment. We apply it right before rendering
        // instead of at label-definition time so the labels stay readable
        // in source.
        const preserveLatinRuns = (s: string): string => {
          if (!hasArabicChars(s)) return s;
          return s.replace(/[A-Za-z0-9\-/.:_@#()]+/g, (run) =>
            run.split('').reverse().join(''),
          );
        };

        // Accreditation seal — two concentric rings with "Accredited /
        // N CME Hours" text stacked in the center. Clean, no background
        // artwork. Sits opposite the logo pair (top-RIGHT in LTR,
        // top-LEFT in RTL).
        {
          const cx0 = rtl ? 72 : W - 72;
          const cy0 = 78;
          const r = 52;
          // Outer ring — slightly thicker to give the seal weight.
          doc.circle(cx0, cy0, r).lineWidth(1.6).stroke(navy);
          // Inner ring — thin accent, matches the reference sample's
          // double-line rim.
          doc.circle(cx0, cy0, r - 5).lineWidth(0.5).stroke(navy);

          // Center stack — "Accredited" larger + "N CME Hours" below.
          const lineTop = 'Accredited';
          const lineBottom = cmeHours > 0
            ? `${cmeHours} CME Hours`
            : 'CME Hours';
          const topSize = 14;
          const bottomSize = 10;
          const gapY = 3;
          const blockH = topSize + gapY + bottomSize;
          const topY = cy0 - blockH / 2;
          const bottomY = topY + topSize + gapY;
          doc.font('Helvetica-Bold').fontSize(topSize).fillColor(navy)
            .text(lineTop, cx0 - r, topY, {
              width: r * 2,
              align: 'center',
              lineBreak: false,
            });
          doc.font('Helvetica-Bold').fontSize(bottomSize).fillColor(navy)
            .text(lineBottom, cx0 - r, bottomY, {
              width: r * 2,
              align: 'center',
              lineBreak: false,
            });
        }

        // ── CENTERED MAIN SECTION ──────────────────────────────────
        // Title. characterSpacing MUST stay 0 for Arabic — inserting
        // extra letter spacing breaks the cursive joining rules
        // (each Arabic glyph's shape depends on its neighbours), so
        // letters render as isolated forms and look "cut apart" like
        // the reference bug report showed.
        let y = 118;
        const titleIsArabic = hasArabicChars(L.title);
        doc.font(fontForText(L.title)).fontSize(44).fillColor(navy)
          .text(L.title, 0, y, {
            align: 'center',
            width: W,
            features: featuresFor(L.title),
            characterSpacing: titleIsArabic ? 0 : 3,
          });
        y += 50;
        const subtitleIsArabic = hasArabicChars(L.subtitle);
        doc.font(fontForText(L.subtitle)).fontSize(22).fillColor(navy)
          .text(L.subtitle, 0, y, {
            align: 'center',
            width: W,
            features: featuresFor(L.subtitle),
            characterSpacing: subtitleIsArabic ? 0 : 4,
          });

        // Helper — draws a rounded pill sized tightly to the text it
        // contains (plus a small horizontal padding). Previous version
        // used fixed widths (260/180/220) that left too much dead space
        // around short labels. Text is centered inside the pill and the
        // whole pill is centered on the page.
        const drawFittedPill = (
          text: string,
          yPos: number,
          fill: string,
          textColor: string,
          fontSize = 11,
          padX = 22,
          height = 26,
        ) => {
          doc.font(fontForText(text)).fontSize(fontSize);
          const textW = doc.widthOfString(text);
          const pillW = Math.ceil(textW) + padX * 2;
          const pillX = Math.round(cx - pillW / 2);
          doc.roundedRect(pillX, yPos, pillW, height, height / 2).fill(fill);
          doc.fillColor(textColor).text(text, pillX, yPos + (height - fontSize) / 2 - 1, {
            width: pillW,
            align: 'center',
            features: featuresFor(text),
            lineBreak: false,
          });
        };

        // PROUDLY AWARDED TO — pale-blue pill with navy text (matches
        // the reference sample where light pills accent the flow rather
        // than heavier gold-fill pills).
        y += 36;
        drawFittedPill(L.awardedTo, y, lightBlue, navy);

        // Student name
        y += 38;
        doc.font(fontForText(displayName)).fontSize(30).fillColor(dark)
          .text(displayName, 0, y, { align: 'center', width: W, features: featuresFor(displayName) });

        // Thin gold hairline divider — the sample's signature separator
        // between the name block and the course block.
        y += 42;
        doc.moveTo(cx - 210, y).lineTo(cx + 210, y).lineWidth(0.8).stroke(gold);

        // FOR ATTENDING — same pale-blue treatment
        y += 14;
        drawFittedPill(L.forAttending, y, lightBlue, navy);

        // Course title — MEASURE the actual rendered height before placing
        // the date pill so a two-line title cannot overlap. Also scale the
        // font down when the title is very long.
        y += 36;
        const titleWidth = W - 160;
        const shrinkTitle = courseTitle.length > 80 ? 16 : courseTitle.length > 50 ? 18 : 22;
        doc.font(fontForText(courseTitle)).fontSize(shrinkTitle);
        const titleHeight = doc.heightOfString(courseTitle, {
          width: titleWidth,
          align: 'center',
          features: featuresFor(courseTitle),
        });
        doc.fillColor(navy).text(courseTitle, 80, y, {
          align: 'center',
          width: titleWidth,
          features: featuresFor(courseTitle),
        });
        y += Math.max(titleHeight, 24) + 10;

        // Date pill — DARK navy fill (sample uses the deeper shade to
        // anchor this pill visually vs the pale awarded-to/for-attending).
        // Route through preserveLatinRuns for AR dates containing month
        // names alongside Latin digits.
        drawFittedPill(preserveLatinRuns(dateFormatted), y, navyDeep, '#FFFFFF');

        // Accreditation paragraph — mixed Arabic + Latin digits, so we
        // route the visible string through preserveLatinRuns() to keep
        // digit sequences right-side-up.
        y += 42;
        {
          const s = preserveLatinRuns(L.accreditedBy);
          doc.font(fontForText(L.accreditedBy, false)).fontSize(11).fillColor(gray)
            .text(s, 0, y, { align: 'center', width: W, features: featuresFor(L.accreditedBy) });
        }
        y += 16;
        {
          const s = preserveLatinRuns(L.numberDate(regNumber, accreditationDate));
          doc.font(fontForText(s, false)).fontSize(10).fillColor(gray)
            .text(s, 0, y, { align: 'center', width: W, features: featuresFor(s) });
        }
        if (courseAccreditationNumber) {
          y += 16;
          const s = preserveLatinRuns(L.courseAccreditation(courseAccreditationNumber));
          doc.font(fontForText(s)).fontSize(10).fillColor(navy)
            .text(s, 0, y, { align: 'center', width: W, features: featuresFor(s) });
        }
        if (cmeHours > 0) {
          y += 16;
          const s = preserveLatinRuns(L.cmeHours(cmeHours));
          doc.font(fontForText(s)).fontSize(11).fillColor(navy)
            .text(s, 0, y, { align: 'center', width: W, features: featuresFor(s) });
        }

        // QR code — bottom-right in LTR, bottom-left in RTL so it stays
        // on the "closing" side of the reading direction (matches where
        // the eye lands last on the sheet).
        const qrX = rtl ? 40 : W - 95;
        const qrCaptionX = rtl ? 35 : W - 100;
        doc.image(qrBuffer, qrX, H - 100, { width: 55 });
        doc.font(fontForText(L.scanToVerify, false)).fontSize(6).fillColor(lightGray)
          .text(L.scanToVerify, qrCaptionX, H - 42, { width: 65, align: 'center', features: featuresFor(L.scanToVerify) });

        doc.end();
      } catch (err) { reject(err); }
    });
  }

  /**
   * Persist the certificate PDF to public storage on approval. The stored
   * URL is the "canonical" copy — no lang param, since it goes into the
   * DB. Callers that want a specific language use the buffer helper above
   * and stream the bytes directly without touching storage.
   */
  private async generatePlaceholderPdf(
    requestId: string,
    courseId: string,
    studentId: string,
  ): Promise<string> {
    const pdfBuffer = await this.generatePlaceholderPdfBuffer(
      requestId,
      courseId,
      studentId,
    );
    const filename = `certificates/${requestId}.pdf`;
    try {
      const url = await this.storageService.uploadPublic(
        pdfBuffer,
        filename,
        'application/pdf',
      );
      this.logger.log(`Certificate PDF uploaded: ${url}`);
      return url;
    } catch (error) {
      this.logger.error('Failed to upload certificate PDF', error);
      throw new BadRequestException('Failed to generate certificate PDF');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Get course IDs for an instructor.
   */
  private async getInstructorCourseIds(
    instructorId: string,
  ): Promise<string[]> {
    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.instructorId, instructorId));
    return instructorCourses.map((c) => c.id);
  }

  /**
   * Get course IDs managed by a course manager.
   */
  private async getManagedCourseIds(
    managerId: string,
  ): Promise<string[]> {
    const managedCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(or(eq(courses.managerId, managerId), sql`${courses.managerId} IS NULL`));
    return managedCourses.map((c) => c.id);
  }

  /**
   * Verify the user can access the course.
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const conditions: any[] = [eq(courses.id, courseId)];
    this.addCourseOwnershipCondition(conditions, user);

    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  /**
   * Verify the user can access a certificate request.
   * Returns the full request row with student details.
   * - Admin: any request.
   * - Instructor: only requests for their own courses.
   */
  private async verifyRequestAccess(
    requestId: string,
    user: AuthenticatedUser,
  ) {
    const [request] = await db
      .select({
        id: certificateRequests.id,
        courseId: certificateRequests.courseId,
        studentId: certificateRequests.studentId,
        status: certificateRequests.status,
        attendancePercent: certificateRequests.attendancePercent,
        assessmentPassed: certificateRequests.assessmentPassed,
        courseCompleted: certificateRequests.courseCompleted,
        reviewedBy: certificateRequests.reviewedBy,
        reviewNote: certificateRequests.reviewNote,
        reviewedAt: certificateRequests.reviewedAt,
        certificateUrl: certificateRequests.certificateUrl,
        createdAt: certificateRequests.createdAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        studentLanguage: users.language,
      })
      .from(certificateRequests)
      .innerJoin(users, eq(certificateRequests.studentId, users.id))
      .where(eq(certificateRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new NotFoundException('Certificate request not found');
    }

    // Verify course access
    if (!isGlobalAdmin(user)) {
      const courseConditions: any[] = [eq(courses.id, request.courseId)];
      if (isManager(user)) {
        courseConditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
      } else {
        courseConditions.push(eq(courses.instructorId, user.id));
      }

      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(...courseConditions))
        .limit(1);

      if (!course) {
        throw new NotFoundException('Certificate request not found');
      }
    }

    return request;
  }

  // ─── Download Helpers ─────────────────────────────────────

  /**
   * Download a single certificate PDF.
   * If certificateUrl exists, fetch from storage. Otherwise re-generate.
   */
  async downloadCertificate(
    certId: string,
    user: AuthenticatedUser,
    lang?: 'en' | 'ar',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.findOne(certId, user);

    if (request.status !== 'approved') {
      throw new BadRequestException('Certificate is not approved');
    }

    // Language-specific downloads always regenerate in memory — we don't
    // want to permanently cache-flip the stored certificateUrl (each lang
    // is a valid legal artifact for that student). The default download
    // (no lang) keeps using the cached URL for speed.
    if (lang) {
      const buffer = await this.generatePlaceholderPdfBuffer(
        request.id,
        request.courseId,
        request.studentId,
        lang,
      );
      return { buffer, filename: `certificate-${certId.slice(0, 8)}-${lang}.pdf` };
    }

    let pdfUrl = request.certificateUrl;
    if (!pdfUrl) {
      // Re-generate
      pdfUrl = await this.generatePlaceholderPdf(
        request.id,
        request.courseId,
        request.studentId,
      );
      await db
        .update(certificateRequests)
        .set({ certificateUrl: pdfUrl })
        .where(eq(certificateRequests.id, certId));
    }

    // Fetch the PDF from storage
    const buffer = await this.storageService.downloadBuffer(pdfUrl);
    const filename = `certificate-${certId.slice(0, 8)}.pdf`;
    return { buffer, filename };
  }

  /**
   * Batch download multiple certificates as a ZIP.
   */
  async batchDownloadCertificates(
    ids: string[],
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Dynamically import archiver
    const archiver = (await import('archiver')).default;
    const { PassThrough } = await import('stream');

    const archive = archiver('zip', { zlib: { level: 5 } });
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();
    passthrough.on('data', (chunk: Buffer) => chunks.push(chunk));

    archive.pipe(passthrough);

    for (const id of ids) {
      try {
        const { buffer, filename } = await this.downloadCertificate(id, user);
        archive.append(buffer, { name: filename });
      } catch (err) {
        this.logger.warn(`Skipping cert ${id} in batch download: ${err}`);
      }
    }

    await archive.finalize();

    // Wait for all data to be collected
    await new Promise<void>((resolve) => passthrough.on('end', resolve));

    return {
      buffer: Buffer.concat(chunks),
      filename: `certificates-${new Date().toISOString().split('T')[0]}.zip`,
    };
  }

  /**
   * Student download — verifies the certificate belongs to the student
   */
  async downloadStudentCertificate(
    certId: string,
    studentId: string,
    lang?: 'en' | 'ar',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const [request] = await db
      .select()
      .from(certificateRequests)
      .where(
        and(
          eq(certificateRequests.id, certId),
          eq(certificateRequests.studentId, studentId),
          eq(certificateRequests.status, 'approved'),
        ),
      )
      .limit(1);

    if (!request) {
      throw new NotFoundException('Certificate not found');
    }

    // Same lang policy as the admin/instructor download path — bypass the
    // stored URL cache when a specific language was asked for.
    if (lang) {
      const buffer = await this.generatePlaceholderPdfBuffer(
        request.id,
        request.courseId,
        request.studentId,
        lang,
      );
      return { buffer, filename: `certificate-${certId.slice(0, 8)}-${lang}.pdf` };
    }

    let pdfUrl = request.certificateUrl;
    if (!pdfUrl) {
      pdfUrl = await this.generatePlaceholderPdf(
        request.id,
        request.courseId,
        request.studentId,
      );
      await db
        .update(certificateRequests)
        .set({ certificateUrl: pdfUrl })
        .where(eq(certificateRequests.id, certId));
    }

    const buffer = await this.storageService.downloadBuffer(pdfUrl);
    return { buffer, filename: `certificate-${certId.slice(0, 8)}.pdf` };
  }
}
