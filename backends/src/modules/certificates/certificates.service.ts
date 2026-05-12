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
  CERTIFICATE_STATUS,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager } from '../../common/role-helpers';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
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
      .select({ status: enrollments.status, progress: enrollments.progress })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    let courseCompleted = false;

    if (isSelfPaced) {
      // Self-paced: 100% module completion required
      courseCompleted = enrollment ? enrollment.progress >= 100 : false;
    } else if (isBlended) {
      // Blended: enrollment completed AND 100% module progress
      courseCompleted = enrollment
        ? enrollment.status === 'completed' && enrollment.progress >= 100
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
    // Support both full UUID and exact PG-XXXXXXXX (8 hex chars) format
    let lookupId = certId;
    if (certId.toUpperCase().startsWith('PG-')) {
      const shortHex = certId.slice(3).toLowerCase();
      // Must be exactly 8 hex characters to match
      if (!/^[0-9a-f]{8}$/i.test(shortHex)) {
        throw new NotFoundException('Certificate not found');
      }
      // Find UUID that starts with this exact 8-char prefix
      const [match] = await db
        .select({ id: certificateRequests.id })
        .from(certificateRequests)
        .where(sql`LEFT(${certificateRequests.id}::text, 8) = ${shortHex}`)
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
      certificateId: `PG-${cert.id.slice(0, 8).toUpperCase()}`,
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

    // For CPD/CME courses, SCFHS number is required
    const [courseInfo] = await db
      .select({ isCmeAccredited: courses.isCmeAccredited })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (courseInfo?.isCmeAccredited) {
      const [student] = await db
        .select({ scfhsNumber: users.scfhsNumber })
        .from(users)
        .where(eq(users.id, studentId))
        .limit(1);

      if (!student?.scfhsNumber?.trim()) {
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

    // Default to pending if no status specified
    const statusFilter =
      params.status &&
      Object.values(CERTIFICATE_STATUS).includes(params.status as any)
        ? params.status
        : CERTIFICATE_STATUS.PENDING;
    conditions.push(eq(certificateRequests.status, statusFilter));

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

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
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(certificateRequests)
      .innerJoin(users, eq(certificateRequests.studentId, users.id))
      .where(whereClause)
      .orderBy(desc(certificateRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(certificateRequests)
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

    if (!studentForScfhs?.scfhsNumber?.trim()) {
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

    const [updated] = await db
      .update(certificateRequests)
      .set({
        status: CERTIFICATE_STATUS.APPROVED,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        certificateUrl,
      })
      .where(eq(certificateRequests.id, id))
      .returning();

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

    const [updated] = await db
      .update(certificateRequests)
      .set({
        status: CERTIFICATE_STATUS.REJECTED,
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

    const [updated] = await db
      .update(certificateRequests)
      .set({
        status: CERTIFICATE_STATUS.REVOKED,
        reviewedBy: user.id,
        reviewNote: dto.reason,
        reviewedAt: new Date(),
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
  private async generatePlaceholderPdf(
    requestId: string,
    courseId: string,
    studentId: string,
  ): Promise<string> {
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
    // Show Arabic name if available, or English name if it contains Arabic chars
    const rawDisplayName = studentNameAr || studentNameEn;
    const nameIsArabic = !!(studentNameAr) || hasArabicChars(studentNameEn);
    const displayName = rawDisplayName;
    const courseTitle = course?.title || 'Course';
    const cmeHours = course?.cmeHours || 0;
    const issuedDate = new Date();
    const dateFormatted = issuedDate.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).toUpperCase();
    const certificateId = `PG-${requestId.slice(0, 8).toUpperCase()}`;

    // Generate QR code as base64 data URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/en/verify/${requestId}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    // Fetch logo from frontend
    let logoBuffer: Buffer | null = null;
    if (!(this as any)._logoCacheBuffer) {
      try {
        const https = require('https');
        logoBuffer = await new Promise<Buffer>((res, rej) => {
          https.get(`${frontendUrl}/images/logo.png`, (resp: any) => {
            if (resp.statusCode !== 200) { rej(new Error(`Logo HTTP ${resp.statusCode}`)); return; }
            const chunks: Buffer[] = [];
            resp.on('data', (c: Buffer) => chunks.push(c));
            resp.on('end', () => res(Buffer.concat(chunks)));
            resp.on('error', rej);
          }).on('error', rej);
        });
        (this as any)._logoCacheBuffer = logoBuffer;
      } catch { /* logo is optional */ }
    } else {
      logoBuffer = (this as any)._logoCacheBuffer;
    }

    // Load Arabic font buffer from embedded base64
    let arabicFontBuf: Buffer | null = null;
    if (nameIsArabic) {
      if (!(this as any)._arabicFontBuf) {
        const { AMIRI_BOLD_BASE64 } = require('./amiri-bold-font');
        (this as any)._arabicFontBuf = Buffer.from(AMIRI_BOLD_BASE64, 'base64');
      }
      arabicFontBuf = (this as any)._arabicFontBuf;
    }

    // Generate QR as buffer for PDFKit
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    // Build PDF with PDFKit
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = doc.page.width, H = doc.page.height, cx = W / 2;
        const navy = '#002D87', gold = '#D4A520', gray = '#4B5563', lightGray = '#9CA3AF', dark = '#1F2937';

        // Background + borders
        doc.rect(0, 0, W, H).fill('#FFFFFF');
        doc.rect(24, 24, W - 48, H - 48).lineWidth(2.5).stroke(navy);
        doc.rect(30, 30, W - 60, H - 60).lineWidth(0.8).stroke(gold);

        // Watermark
        doc.save();
        doc.opacity(0.05);
        if (logoBuffer) { doc.image(logoBuffer, cx - 160, H / 2 - 110, { width: 320 }); }
        else { doc.font('Helvetica-Bold').fontSize(100).fillColor(navy).text('PHYSIOGUIDANCE', 0, H / 2 - 50, { align: 'center' }); }
        doc.restore();

        // Logo top-left
        if (logoBuffer) { doc.image(logoBuffer, 45, 40, { height: 45 }); }
        else { doc.font('Helvetica-Bold').fontSize(14).fillColor(navy).text('PHYSIOGUIDANCE', 50, 48); }

        // CME badge top-right
        if (cmeHours > 0) {
          const bx = W - 130, by = 42, br = 32;
          doc.circle(bx + br, by + br, br).lineWidth(2.5).stroke(navy);
          doc.circle(bx + br, by + br, br - 4).lineWidth(0.8).stroke(gold);
          doc.font('Helvetica-Bold').fontSize(24).fillColor(navy).text(String(cmeHours), bx, by + 12, { width: br * 2, align: 'center' });
          doc.font('Helvetica').fontSize(6.5).fillColor(gray).text('CME HOURS', bx, by + 38, { width: br * 2, align: 'center' });
        }

        // Title
        let y = 105;
        doc.font('Helvetica-Bold').fontSize(38).fillColor(navy).text('CERTIFICATE', 0, y, { align: 'center' });
        y += 40;
        doc.font('Helvetica-Bold').fontSize(20).fillColor(gold).text('OF ATTENDANCE', 0, y, { align: 'center' });

        // Pills + name
        y += 38;
        doc.roundedRect(cx - 120, y, 240, 28, 14).fill(gold);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('PROUDLY AWARDED TO', cx - 120, y + 8, { width: 240, align: 'center' });

        // Student name — register Arabic font if needed
        y += 40;
        if (arabicFontBuf && nameIsArabic) {
          doc.registerFont('Amiri-Bold', arabicFontBuf);
          doc.font('Amiri-Bold').fontSize(30).fillColor(dark)
            .text(displayName, 0, y, { align: 'center', features: ['rtla'] });
        } else {
          doc.font('Helvetica-Bold').fontSize(30).fillColor(dark)
            .text(displayName, 0, y, { align: 'center' });
        }

        // FOR ATTENDING pill
        y += 44;
        doc.roundedRect(cx - 90, y, 180, 28, 14).fill(navy);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('FOR ATTENDING', cx - 90, y + 8, { width: 180, align: 'center' });

        // Course title
        y += 38;
        doc.font('Helvetica-Bold').fontSize(20).fillColor(dark).text(courseTitle, 80, y, { align: 'center', width: W - 160 });

        // Date pill
        y += 36;
        doc.roundedRect(cx - 120, y, 240, 28, 14).fill(gold);
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFFFFF').text(dateFormatted, cx - 120, y + 8, { width: 240, align: 'center' });

        // Accreditation
        y += 42;
        doc.font('Helvetica').fontSize(11).fillColor(gray).text('This activity has been accredited by the Saudi Commission for Health Specialties', 0, y, { align: 'center' });
        y += 16;
        const regNumber = student?.scfhsNumber || certificateId;
        doc.font('Helvetica').fontSize(10).fillColor(gray).text(`with accreditation number ${regNumber}   Date: ${issuedDate.toLocaleDateString('en-GB')}`, 0, y, { align: 'center' });
        // Optional course-level accreditation number — only rendered when set.
        // Distinct from the SCFHS practitioner number above; this is the
        // accrediting body's registration ID for this specific course.
        if (course?.accreditationNumber) {
          y += 16;
          doc.font('Helvetica-Bold').fontSize(10).fillColor(navy)
            .text(`Course Accreditation: ${course.accreditationNumber}`, 0, y, { align: 'center' });
        }
        if (cmeHours > 0) {
          y += 16;
          doc.font('Helvetica-Bold').fontSize(11).fillColor(navy).text(`${cmeHours} CME/PD Credit Hours`, 0, y, { align: 'center' });
        }

        // QR code
        doc.image(qrBuffer, W - 95, H - 105, { width: 55 });
        doc.font('Helvetica').fontSize(5).fillColor(lightGray).text('Scan to verify', W - 95, H - 105 + 57, { width: 55, align: 'center' });

        doc.end();
      } catch (err) { reject(err); }
    });

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
  ): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.findOne(certId, user);

    if (request.status !== 'approved') {
      throw new BadRequestException('Certificate is not approved');
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
