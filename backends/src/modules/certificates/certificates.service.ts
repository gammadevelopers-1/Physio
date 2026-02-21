import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm';
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
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { StorageService } from '../storage/storage.service';
import { RejectCertificateDto } from './dto/reject-certificate.dto';
import { HoldCertificateDto } from './dto/hold-certificate.dto';
import { BatchCertificateDto } from './dto/batch-certificate.dto';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(private readonly storageService: StorageService) {}

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')
    );
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

    // 3. Course completed — enrollment progress === 100
    const [enrollment] = await db
      .select({ progress: enrollments.progress })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    const courseCompleted = enrollment ? enrollment.progress === 100 : false;

    return { attendancePercent, assessmentPassed, courseCompleted };
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

    // Instructor: scope to own courses only
    if (!this.isAdmin(user)) {
      const instructorCourseIds = await this.getInstructorCourseIds(user.id);
      if (instructorCourseIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      conditions.push(
        sql`${certificateRequests.courseId} IN (${sql.join(
          instructorCourseIds.map((id) => sql`${id}`),
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

    // Verify eligibility before approving
    const eligibility = await this.computeEligibility(
      request.courseId,
      request.studentId,
    );

    const errors: string[] = [];
    if (parseFloat(eligibility.attendancePercent) < 70) {
      errors.push(
        `Attendance is ${eligibility.attendancePercent}% (minimum 70% required)`,
      );
    }
    if (!eligibility.assessmentPassed) {
      errors.push('Student has not passed all required assessments');
    }
    if (!eligibility.courseCompleted) {
      errors.push('Course completion is not 100%');
    }

    if (errors.length > 0) {
      throw new BadRequestException(
        `Cannot approve: ${errors.join('; ')}`,
      );
    }

    // Generate placeholder PDF
    const certificateUrl = await this.generatePlaceholderPdf(
      request.id,
      request.courseId,
      request.studentId,
    );

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

  // ─── Placeholder PDF Generation ─────────────────────────────

  /**
   * Generate a simple placeholder PDF certificate.
   * Creates a minimal PDF binary and uploads to storage.
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
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    const [course] = await db
      .select({ title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const studentName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';
    const courseTitle = course?.title || 'Course';
    const issuedDate = new Date().toISOString().split('T')[0];

    // Build a minimal valid PDF with certificate text
    const content = [
      'CERTIFICATE OF COMPLETION',
      '',
      `This is to certify that`,
      '',
      studentName,
      '',
      `has successfully completed the course`,
      '',
      courseTitle,
      '',
      `Issued on: ${issuedDate}`,
      `Certificate ID: ${requestId}`,
    ].join('\n');

    // Create a minimal PDF (valid PDF 1.4 structure)
    const textStream = `BT /F1 24 Tf 50 700 Td (CERTIFICATE OF COMPLETION) Tj ET
BT /F1 14 Tf 50 650 Td (This is to certify that) Tj ET
BT /F1 18 Tf 50 620 Td (${this.escapePdfText(studentName)}) Tj ET
BT /F1 14 Tf 50 590 Td (has successfully completed the course) Tj ET
BT /F1 18 Tf 50 560 Td (${this.escapePdfText(courseTitle)}) Tj ET
BT /F1 12 Tf 50 510 Td (Issued on: ${issuedDate}) Tj ET
BT /F1 10 Tf 50 490 Td (Certificate ID: ${requestId}) Tj ET`;

    const streamLength = Buffer.byteLength(textStream);

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${textStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;

    const pdfBuffer = Buffer.from(pdf, 'utf-8');
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

  /**
   * Escape special characters in PDF text strings.
   */
  private escapePdfText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\n/g, ' ');
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
   * Verify the user can access the course.
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const conditions = [eq(courses.id, courseId)];
    if (!this.isAdmin(user)) {
      conditions.push(eq(courses.instructorId, user.id));
    }

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

    // Instructor: verify course belongs to them
    if (!this.isAdmin(user)) {
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(
          and(
            eq(courses.id, request.courseId),
            eq(courses.instructorId, user.id),
          ),
        )
        .limit(1);

      if (!course) {
        throw new NotFoundException('Certificate request not found');
      }
    }

    return request;
  }
}
