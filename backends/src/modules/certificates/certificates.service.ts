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
    // 1. Attendance percentage
    // Get all sessions for this course
    const courseSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));

    let attendancePercent = '0.00';

    if (courseSessions.length > 0) {
      const sessionIds = courseSessions.map((s) => s.id);

      // Count attendance records where status is 'present' or 'late'
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
        // Get the best graded submission for this student on this assessment
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
          // No graded submission → not passed
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

    // 3. Course completed — enrollment status is 'completed' (set by instructor or end-date cron)
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

    const courseCompleted = enrollment ? enrollment.status === 'completed' : false;

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
    const [cert] = await db
      .select({
        id: certificateRequests.id,
        status: certificateRequests.status,
        createdAt: certificateRequests.createdAt,
        reviewedAt: certificateRequests.reviewedAt,
        attendancePercent: certificateRequests.attendancePercent,
        courseName: courses.title,
        courseNameAr: courses.titleAr,
        totalHours: courses.cmeHours,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(certificateRequests)
      .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
      .innerJoin(users, eq(certificateRequests.studentId, users.id))
      .where(eq(certificateRequests.id, certId))
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
  async createRequest(courseId: string, studentId: string) {
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

    // Compute eligibility
    const eligibility = await this.computeEligibility(courseId, studentId);

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

    // TODO: Re-enable eligibility check after testing
    // const eligibility = await this.computeEligibility(
    //   request.courseId,
    //   request.studentId,
    // );
    //
    // const errors: string[] = [];
    // if (parseFloat(eligibility.attendancePercent) < 70) {
    //   errors.push(
    //     `Attendance is ${eligibility.attendancePercent}% (minimum 70% required)`,
    //   );
    // }
    // if (!eligibility.assessmentPassed) {
    //   errors.push('Student has not passed all required assessments');
    // }
    // if (!eligibility.courseCompleted) {
    //   errors.push('Course completion is not 100%');
    // }
    //
    // if (errors.length > 0) {
    //   throw new BadRequestException(
    //     `Cannot approve: ${errors.join('; ')}`,
    //   );
    // }

    // Generate certificate PDF
    let certificateUrl: string;
    try {
      certificateUrl = await this.generatePlaceholderPdf(
        request.id,
        request.courseId,
        request.studentId,
      );
    } catch (error) {
      this.logger.error(`Failed to generate certificate PDF for request ${id}`, error);
      throw new BadRequestException(
        'Failed to generate certificate PDF. Please try again.',
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
      await this.emailService.sendCertificateApproved(
        request.studentEmail,
        studentName,
        courseName,
        certificateUrl,
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
      await this.emailService.sendCertificateRejected(
        request.studentEmail,
        studentName,
        courseName,
        dto.note,
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
      await this.emailService.sendCertificateHeld(
        request.studentEmail,
        studentName,
        courseName,
        dto.note,
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
      await this.emailService.sendCertificateRejected(
        request.studentEmail,
        studentName,
        courseName,
        `Certificate revoked: ${dto.reason}`,
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
    // Get student and course info for the certificate
    const [student] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        firstNameAr: users.firstNameAr,
        lastNameAr: users.lastNameAr,
        email: users.email,
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
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const studentNameEn =
      `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';
    const studentNameAr =
      `${student?.firstNameAr || ''} ${student?.lastNameAr || ''}`.trim() || '';
    const courseTitle = course?.title || 'Course';
    const courseTitleAr = course?.titleAr || '';
    const cmeHours = course?.cmeHours || 0;
    const issuedDate = new Date();
    const dateFormatted = issuedDate.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).toUpperCase();
    const certificateId = `PG-${requestId.slice(0, 8).toUpperCase()}`;

    // Generate QR code
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/en/verify/${requestId}`;
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    // Load fonts and assets
    const path = require('path');
    const fs = require('fs');
    const assetsDir = path.join(__dirname, 'assets');
    const cairoBold = path.join(assetsDir, 'Cairo-Bold.ttf');
    const cairoRegular = path.join(assetsDir, 'Cairo-Regular.ttf');
    const cairoSemiBold = path.join(assetsDir, 'Cairo-SemiBold.ttf');
    const logoPath = path.join(assetsDir, 'logo.png');
    const scfhsLogoPath = path.join(assetsDir, 'scfhs-logo.png');

    // Build the PDF
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;   // 841.89
      const H = doc.page.height;  // 595.28
      const cx = W / 2;

      // Register fonts
      if (fs.existsSync(cairoBold)) doc.registerFont('Cairo-Bold', cairoBold);
      if (fs.existsSync(cairoRegular)) doc.registerFont('Cairo-Regular', cairoRegular);
      if (fs.existsSync(cairoSemiBold)) doc.registerFont('Cairo-SemiBold', cairoSemiBold);

      const fontBold = fs.existsSync(cairoBold) ? 'Cairo-Bold' : 'Helvetica-Bold';
      const fontRegular = fs.existsSync(cairoRegular) ? 'Cairo-Regular' : 'Helvetica';
      const fontSemiBold = fs.existsSync(cairoSemiBold) ? 'Cairo-SemiBold' : 'Helvetica-Bold';

      // Colors
      const navy = '#002D87';
      const gold = '#D4A520';
      const goldLight = '#C9A84C';
      const gray = '#6B7280';
      const darkText = '#1F2937';

      // ─── Background & Borders ─────────────────────────────
      doc.rect(0, 0, W, H).fill('#FAFAFA');

      // Outer border (navy)
      doc.rect(20, 20, W - 40, H - 40).lineWidth(2.5).stroke(navy);
      // Inner border (gold)
      doc.rect(28, 28, W - 56, H - 56).lineWidth(0.8).stroke(goldLight);

      // ─── Header Logos ─────────────────────────────────────
      // Organization logo (top-left)
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 40, { height: 50 });
      }

      // SCFHS logo (top-center)
      if (fs.existsSync(scfhsLogoPath)) {
        doc.image(scfhsLogoPath, cx - 30, 38, { height: 45 });
      }

      // CME hours badge (top-right)
      if (cmeHours > 0) {
        const badgeX = W - 120;
        const badgeY = 38;
        const badgeR = 30;
        doc.circle(badgeX + badgeR, badgeY + badgeR, badgeR).lineWidth(2).stroke(navy);
        doc.circle(badgeX + badgeR, badgeY + badgeR, badgeR - 4).lineWidth(0.5).stroke(goldLight);
        doc.font(fontBold).fontSize(22).fillColor(navy)
          .text(String(cmeHours), badgeX, badgeY + 12, { width: badgeR * 2, align: 'center' });
        doc.font(fontRegular).fontSize(6).fillColor(gray)
          .text('CME HOURS', badgeX, badgeY + 36, { width: badgeR * 2, align: 'center' });
      }

      // ─── Certificate Title ────────────────────────────────
      let y = 110;
      doc.font(fontBold).fontSize(36).fillColor(navy)
        .text('CERTIFICATE', 0, y, { align: 'center' });
      y += 38;
      doc.font(fontSemiBold).fontSize(20).fillColor(navy)
        .text('OF ATTENDANCE', 0, y, { align: 'center' });

      // "PROUDLY AWARDED TO" pill
      y += 35;
      const pillText = 'PROUDLY AWARDED TO';
      const pillW = 200;
      const pillH = 22;
      doc.roundedRect(cx - pillW / 2, y, pillW, pillH, 11).fill(goldLight);
      doc.font(fontSemiBold).fontSize(9).fillColor('#FFFFFF')
        .text(pillText, cx - pillW / 2, y + 6, { width: pillW, align: 'center' });

      // ─── Student Name ─────────────────────────────────────
      y += 35;
      // Arabic name (if available)
      if (studentNameAr) {
        doc.font(fontBold).fontSize(28).fillColor(darkText)
          .text(studentNameAr, 0, y, { align: 'center', features: ['rtla'] });
        y += 36;
      }
      // English name
      doc.font(fontSemiBold).fontSize(studentNameAr ? 16 : 28).fillColor(studentNameAr ? gray : darkText)
        .text(studentNameEn, 0, y, { align: 'center' });

      // "FOR ATTENDING" pill
      y += (studentNameAr ? 28 : 38);
      const forPillText = 'FOR ATTENDING';
      const forPillW = 150;
      doc.roundedRect(cx - forPillW / 2, y, forPillW, pillH, 11).fill(goldLight);
      doc.font(fontSemiBold).fontSize(9).fillColor('#FFFFFF')
        .text(forPillText, cx - forPillW / 2, y + 6, { width: forPillW, align: 'center' });

      // ─── Course Title ─────────────────────────────────────
      y += 32;
      doc.font(fontBold).fontSize(18).fillColor(darkText)
        .text(courseTitle, 60, y, { align: 'center', width: W - 120 });
      if (courseTitleAr) {
        y += 24;
        doc.font(fontSemiBold).fontSize(14).fillColor(gray)
          .text(courseTitleAr, 60, y, { align: 'center', width: W - 120, features: ['rtla'] });
      }

      // Date pill
      y += 30;
      const datePillW = 220;
      const datePillH = 24;
      doc.roundedRect(cx - datePillW / 2, y, datePillW, datePillH, 12).fill(goldLight);
      doc.font(fontSemiBold).fontSize(10).fillColor('#FFFFFF')
        .text(dateFormatted, cx - datePillW / 2, y + 7, { width: datePillW, align: 'center' });

      // ─── SCFHS Accreditation Section ──────────────────────
      y += 38;
      doc.font(fontRegular).fontSize(9).fillColor(gray)
        .text(
          'This activity has been accredited by the Saudi Commission for Health Specialties',
          0, y, { align: 'center' },
        );
      y += 14;
      doc.font(fontRegular).fontSize(8).fillColor(gray)
        .text(
          `Accreditation number: ${certificateId}   Date: ${issuedDate.toLocaleDateString('en-GB')}`,
          0, y, { align: 'center' },
        );
      if (cmeHours > 0) {
        y += 13;
        doc.font(fontSemiBold).fontSize(9).fillColor(navy)
          .text(`${cmeHours} CME/PD Credit Hours`, 0, y, { align: 'center' });
      }

      // ─── Signature Section ────────────────────────────────
      y += 30;
      // Organization logo (small, left of signature)
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, cx - 120, y, { height: 35 });
      }

      // Signature text (right side)
      doc.font(fontRegular).fontSize(8).fillColor(gray)
        .text('Professional Development Manager', cx - 10, y, { width: 200 });
      doc.font(fontSemiBold).fontSize(9).fillColor(darkText)
        .text('PhysioGuidance', cx - 10, y + 12, { width: 200 });

      // Signature line
      doc.moveTo(cx - 10, y + 30).lineTo(cx + 100, y + 30).lineWidth(0.5).stroke(gray);
      doc.font(fontRegular).fontSize(7).fillColor(gray)
        .text('Authorized Signature', cx - 10, y + 33, { width: 120 });

      // ─── QR Code & Verification ───────────────────────────
      const qrSize = 70;
      const qrX = W - 110;
      const qrY = H - 110;
      doc.image(qrBuffer, qrX, qrY, { width: qrSize });
      doc.font(fontRegular).fontSize(6).fillColor(gray)
        .text('Scan to verify', qrX, qrY + qrSize + 3, { width: qrSize, align: 'center' });
      doc.font(fontRegular).fontSize(5).fillColor(gray)
        .text(certificateId, qrX, qrY + qrSize + 12, { width: qrSize, align: 'center' });

      // ─── Watermark ────────────────────────────────────────
      doc.save();
      doc.opacity(0.03);
      doc.font(fontBold).fontSize(90).fillColor(navy)
        .text('PHYSIOGUIDANCE', 0, H / 2 - 50, { align: 'center' });
      doc.restore();

      doc.end();
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
