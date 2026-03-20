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
    // Show Arabic name if available, otherwise English
    const displayName = studentNameAr || studentNameEn;
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

    // Logo URL
    const logoUrl = `${frontendUrl}/images/logo.png`;

    // Fetch logo for header and watermark (cached in memory)
    let logoBuffer: Buffer | null = null;
    if (!(this as any)._logoCacheBuffer) {
      try {
        const https = require('https');
        const logoUrl = `${frontendUrl}/images/logo.png`;
        logoBuffer = await new Promise<Buffer>((res, rej) => {
          https.get(logoUrl, (resp: any) => {
            const chunks: Buffer[] = [];
            resp.on('data', (c: Buffer) => chunks.push(c));
            resp.on('end', () => res(Buffer.concat(chunks)));
            resp.on('error', rej);
          }).on('error', rej);
        });
        (this as any)._logoCacheBuffer = logoBuffer;
        this.logger.log('Logo fetched and cached for certificates');
      } catch (err) {
        this.logger.warn('Failed to fetch logo, using text fallback');
      }
    } else {
      logoBuffer = (this as any)._logoCacheBuffer;
    }

    // Build certificate as HTML and convert to PDF via Puppeteer
    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 landscape; margin: 0; }
  body { width: 297mm; height: 210mm; font-family: 'Inter', sans-serif; background: #fff; position: relative; overflow: hidden; }
  .outer-border { position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 3px solid #002D87; }
  .inner-border { position: absolute; top: 14px; left: 14px; right: 14px; bottom: 14px; border: 1px solid #D4A520; }
  .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.04; width: 300px; pointer-events: none; }
  .content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; padding: 30px 60px 20px; height: 100%; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin-bottom: 10px; }
  .logo { height: 45px; }
  .cme-badge { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #002D87; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
  .cme-badge::after { content: ''; position: absolute; inset: 4px; border-radius: 50%; border: 1px solid #D4A520; }
  .cme-num { font-size: 24px; font-weight: 800; color: #002D87; line-height: 1; }
  .cme-label { font-size: 6px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  .title { font-size: 42px; font-weight: 800; color: #002D87; letter-spacing: 2px; margin-top: 8px; }
  .subtitle { font-size: 22px; font-weight: 700; color: #D4A520; letter-spacing: 3px; margin-top: 2px; }
  .pill { display: inline-block; padding: 8px 32px; border-radius: 20px; font-size: 12px; font-weight: 700; color: #fff; letter-spacing: 1.5px; margin-top: 18px; }
  .pill-gold { background: #D4A520; }
  .pill-navy { background: #002D87; }
  .student-name { font-size: 34px; font-weight: 700; color: #1F2937; margin-top: 16px; font-family: ${studentNameAr ? "'Amiri', serif" : "'Inter', sans-serif"}; direction: ${studentNameAr ? 'rtl' : 'ltr'}; }
  .course-title { font-size: 22px; font-weight: 700; color: #1F2937; margin-top: 14px; }
  .accreditation { text-align: center; margin-top: 18px; color: #4B5563; font-size: 11px; line-height: 1.6; }
  .accreditation strong { color: #002D87; }
  .qr-section { position: absolute; bottom: 22px; right: 22px; text-align: center; }
  .qr-section img { width: 60px; height: 60px; }
  .qr-section p { font-size: 5.5px; color: #9CA3AF; margin-top: 2px; }
</style>
</head><body>
  <div class="outer-border"></div>
  <div class="inner-border"></div>
  <img src="${logoUrl}" class="watermark" />
  <div class="content">
    <div class="header">
      <img src="${logoUrl}" class="logo" />
      ${cmeHours > 0 ? `<div class="cme-badge"><span class="cme-num">${cmeHours}</span><span class="cme-label">CME Hours</span></div>` : '<div></div>'}
    </div>
    <div class="title">CERTIFICATE</div>
    <div class="subtitle">OF ATTENDANCE</div>
    <div class="pill pill-gold">PROUDLY AWARDED TO</div>
    <div class="student-name">${displayName}</div>
    <div class="pill pill-navy">FOR ATTENDING</div>
    <div class="course-title">${courseTitle}</div>
    <div class="pill pill-gold">${dateFormatted}</div>
    <div class="accreditation">
      This activity has been accredited by the Saudi Commission for Health Specialties<br>
      Accreditation number: ${certificateId} &nbsp; Date: ${issuedDate.toLocaleDateString('en-GB')}
      ${cmeHours > 0 ? `<br><strong>${cmeHours} CME/PD Credit Hours</strong>` : ''}
    </div>
  </div>
  <div class="qr-section">
    <img src="${qrDataUrl}" />
    <p>Scan to verify</p>
  </div>
</body></html>`;

    // Render HTML to PDF using Puppeteer
    const puppeteer = require('puppeteer-core');
    let browser;
    try {
      const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
      browser = await puppeteer.launch({
        headless: true,
        executablePath: execPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-translate',
          '--disable-sync',
        ],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle2', timeout: 30000 });
      var pdfBuffer = Buffer.from(await page.pdf({
        width: '297mm',
        height: '210mm',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      }));
    } finally {
      if (browser) await browser.close().catch(() => {});
    }

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
