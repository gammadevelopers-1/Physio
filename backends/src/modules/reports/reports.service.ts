import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  courses,
  sessions,
  attendance,
  enrollments,
  assessments,
  submissions,
  certificateRequests,
  users,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

type ReportFormat = 'csv' | 'pdf' | 'xlsx';

interface ReportMetadata {
  instructorName?: string;
  filters?: string;
}

interface ReportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const CONTENT_TYPES: Record<ReportFormat, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')
    );
  }

  private validateFormat(format?: string): ReportFormat {
    const f = (format || 'csv').toLowerCase();
    if (!['csv', 'pdf', 'xlsx'].includes(f)) {
      throw new BadRequestException(
        'Format must be one of: csv, pdf, xlsx',
      );
    }
    return f as ReportFormat;
  }

  /**
   * Fetch the instructor's full name for report metadata.
   */
  private async getInstructorName(userId: string): Promise<string> {
    const [instructor] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return `${instructor?.firstName || ''} ${instructor?.lastName || ''}`.trim() || 'Unknown';
  }

  /**
   * Resolve a course name by ID for filter descriptions.
   */
  private async getCourseName(courseId: string): Promise<string> {
    const [course] = await db
      .select({ title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    return course?.title || courseId;
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 1. Attendance Report ─────────────────────────────────
  // Columns: Student Name, Email, Session Date, Session, Status, Total Attendance %
  // ═══════════════════════════════════════════════════════════

  async generateAttendanceReport(
    user: AuthenticatedUser,
    params: {
      courseId?: string;
      format?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    // Build filter description
    const filterParts: string[] = [];
    if (params.courseId) {
      filterParts.push(`Course: ${await this.getCourseName(params.courseId)}`);
    } else {
      filterParts.push('All Courses');
    }
    if (params.dateFrom) filterParts.push(`From: ${params.dateFrom}`);
    if (params.dateTo) filterParts.push(`To: ${params.dateTo}`);

    const metadata: ReportMetadata = {
      instructorName,
      filters: filterParts.join(', '),
    };

    const headers = [
      'Student Name',
      'Email',
      'Session Date',
      'Session',
      'Status',
      'Total Attendance %',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('Attendance Report', headers, [], format, metadata);
    }

    // Build session filter conditions (with optional date range)
    const sessionConditions: any[] = [
      inArray(sessions.courseId, courseIds),
    ];
    if (params.dateFrom) {
      sessionConditions.push(
        gte(sessions.scheduledAt, new Date(params.dateFrom)),
      );
    }
    if (params.dateTo) {
      sessionConditions.push(
        lte(sessions.scheduledAt, new Date(params.dateTo)),
      );
    }

    // Get attendance data (filtered by date range)
    const data = await db
      .select({
        studentId: attendance.studentId,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        courseId: sessions.courseId,
        sessionDate: sessions.scheduledAt,
        sessionTitle: sessions.title,
        status: attendance.status,
      })
      .from(attendance)
      .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
      .innerJoin(users, eq(attendance.studentId, users.id))
      .where(and(...sessionConditions))
      .orderBy(users.lastName, sessions.scheduledAt);

    // Compute total attendance % per student (across ALL sessions, not date-filtered)
    const allCourseSessions = await db
      .select({ id: sessions.id, courseId: sessions.courseId })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds));

    const totalSessionsPerCourse = new Map<string, number>();
    for (const s of allCourseSessions) {
      totalSessionsPerCourse.set(
        s.courseId,
        (totalSessionsPerCourse.get(s.courseId) || 0) + 1,
      );
    }

    // Count present+late per student per course (from ALL attendance, unfiltered)
    const attendanceCounts = await db
      .select({
        studentId: attendance.studentId,
        courseId: sessions.courseId,
        attendedCount: count(),
      })
      .from(attendance)
      .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
      .where(
        and(
          inArray(sessions.courseId, courseIds),
          sql`${attendance.status} IN ('present', 'late')`,
        ),
      )
      .groupBy(attendance.studentId, sessions.courseId);

    const attendancePctMap = new Map<string, string>();
    for (const ac of attendanceCounts) {
      const total = totalSessionsPerCourse.get(ac.courseId) || 1;
      const pct = ((Number(ac.attendedCount) / total) * 100).toFixed(2);
      attendancePctMap.set(`${ac.studentId}:${ac.courseId}`, `${pct}%`);
    }

    // Build rows
    const rows = data.map((row) => [
      `${row.studentFirstName || ''} ${row.studentLastName || ''}`.trim(),
      row.studentEmail || '',
      this.formatDate(row.sessionDate),
      row.sessionTitle || '',
      row.status || '',
      attendancePctMap.get(`${row.studentId}:${row.courseId}`) || '0.00%',
    ]);

    return this.formatReport('Attendance Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 2. Gradebook Report ──────────────────────────────────
  // Columns: Student Name, Email, [Assessment Titles...], Total Score, Max Possible, Percentage, Pass/Fail
  // ═══════════════════════════════════════════════════════════

  async generateGradebookReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);

    if (!params.courseId) {
      throw new BadRequestException(
        'courseId is required for the gradebook report',
      );
    }

    await this.verifyCourseAccess(params.courseId, user);
    const instructorName = await this.getInstructorName(user.id);
    const courseName = await this.getCourseName(params.courseId);

    const metadata: ReportMetadata = {
      instructorName,
      filters: `Course: ${courseName}`,
    };

    // Get all assessments for this course
    const courseAssessments = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        totalMarks: assessments.totalMarks,
        passingMarks: assessments.passingMarks,
      })
      .from(assessments)
      .where(eq(assessments.courseId, params.courseId))
      .orderBy(asc(assessments.createdAt));

    // Get all enrolled students
    const enrolled = await db
      .select({
        studentId: enrollments.studentId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(eq(enrollments.courseId, params.courseId))
      .orderBy(users.lastName);

    // Get all graded submissions for this course's assessments
    const allSubs = await db
      .select({
        studentId: submissions.studentId,
        assessmentId: submissions.assessmentId,
        score: submissions.score,
      })
      .from(submissions)
      .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
      .where(
        and(
          eq(assessments.courseId, params.courseId),
          eq(submissions.status, 'graded'),
        ),
      );

    // Best score per student per assessment
    const scoreMap = new Map<string, Map<string, number>>();
    for (const sub of allSubs) {
      if (!scoreMap.has(sub.studentId)) {
        scoreMap.set(sub.studentId, new Map());
      }
      const studentScores = scoreMap.get(sub.studentId)!;
      const existing = studentScores.get(sub.assessmentId) ?? -1;
      if ((sub.score ?? 0) > existing) {
        studentScores.set(sub.assessmentId, sub.score ?? 0);
      }
    }

    // Build headers (dynamic — one column per assessment)
    const headers = [
      'Student Name',
      'Email',
      ...courseAssessments.map((a) => a.title),
      'Total Score',
      'Max Possible',
      'Percentage',
      'Pass/Fail',
    ];

    const maxPossible = courseAssessments.reduce(
      (sum, a) => sum + a.totalMarks,
      0,
    );
    const totalPassingMarks = courseAssessments.reduce(
      (sum, a) => sum + (a.passingMarks ?? 0),
      0,
    );

    // Build rows (one per student)
    const rows = enrolled.map((student) => {
      const studentScores =
        scoreMap.get(student.studentId) || new Map<string, number>();
      let totalScore = 0;

      const assessmentCells = courseAssessments.map((a) => {
        const score = studentScores.get(a.id) ?? 0;
        totalScore += score;
        return `${score}/${a.totalMarks}`;
      });

      const pct =
        maxPossible > 0
          ? ((totalScore / maxPossible) * 100).toFixed(2)
          : '0.00';

      const passFail = totalScore >= totalPassingMarks ? 'Pass' : 'Fail';

      return [
        `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        student.email || '',
        ...assessmentCells,
        String(totalScore),
        String(maxPossible),
        `${pct}%`,
        passFail,
      ];
    });

    return this.formatReport('Gradebook Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 3. Enrollment Report ─────────────────────────────────
  // Columns: Student Name, Email, Enrolled Date, Status, Progress, Last Activity
  // ═══════════════════════════════════════════════════════════

  async generateEnrollmentReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    const metadata: ReportMetadata = {
      instructorName,
      filters: params.courseId
        ? `Course: ${await this.getCourseName(params.courseId)}`
        : 'All Courses',
    };

    const headers = [
      'Student Name',
      'Email',
      'Enrolled Date',
      'Status',
      'Progress',
      'Last Activity',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('Enrollment Report', headers, [], format, metadata);
    }

    const data = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        enrolledAt: enrollments.enrolledAt,
        status: enrollments.status,
        progress: enrollments.progress,
        lastAccessedAt: enrollments.lastAccessedAt,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(inArray(enrollments.courseId, courseIds))
      .orderBy(desc(enrollments.enrolledAt));

    const rows = data.map((row) => [
      `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      row.email || '',
      this.formatDate(row.enrolledAt),
      row.status || '',
      `${row.progress}%`,
      this.formatDate(row.lastAccessedAt),
    ]);

    return this.formatReport('Enrollment Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 4. Completion Report ─────────────────────────────────
  // Columns: Student Name, Email, Completed Date, Certificate Status
  // ═══════════════════════════════════════════════════════════

  async generateCompletionReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    const metadata: ReportMetadata = {
      instructorName,
      filters: params.courseId
        ? `Course: ${await this.getCourseName(params.courseId)}`
        : 'All Courses',
    };

    const headers = [
      'Student Name',
      'Email',
      'Completed Date',
      'Certificate Status',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('Completion Report', headers, [], format, metadata);
    }

    // Get completed enrollments with certificate request status (LEFT JOIN)
    const data = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        completedAt: enrollments.completedAt,
        certStatus: certificateRequests.status,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .leftJoin(
        certificateRequests,
        and(
          eq(certificateRequests.courseId, enrollments.courseId),
          eq(certificateRequests.studentId, enrollments.studentId),
        ),
      )
      .where(
        and(
          inArray(enrollments.courseId, courseIds),
          sql`(${enrollments.status} = 'completed' OR ${enrollments.progress} = 100)`,
        ),
      )
      .orderBy(desc(enrollments.completedAt));

    const rows = data.map((row) => [
      `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      row.email || '',
      this.formatDate(row.completedAt),
      row.certStatus || 'No Request',
    ]);

    return this.formatReport('Completion Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Format Dispatcher ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private async formatReport(
    title: string,
    headers: string[],
    rows: string[][],
    format: ReportFormat,
    metadata?: ReportMetadata,
  ): Promise<ReportResult> {
    const date = new Date().toISOString().split('T')[0];
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    const ext = format;
    const filename = `${slug}-${date}.${ext}`;

    let buffer: Buffer;

    switch (format) {
      case 'csv':
        buffer = this.generateCsv(headers, rows, metadata);
        break;
      case 'pdf':
        buffer = await this.generatePdf(title, headers, rows, metadata);
        break;
      case 'xlsx':
        buffer = await this.generateExcel(title, headers, rows, metadata);
        break;
    }

    return {
      buffer,
      contentType: CONTENT_TYPES[format],
      filename,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ─── CSV Generator ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private generateCsv(
    headers: string[],
    rows: string[][],
    metadata?: ReportMetadata,
  ): Buffer {
    const escape = (val: string): string => {
      if (
        val.includes(',') ||
        val.includes('"') ||
        val.includes('\n') ||
        val.includes('\r')
      ) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const metaLines: string[] = [];
    if (metadata?.instructorName) {
      metaLines.push(`# Instructor: ${metadata.instructorName}`);
    }
    if (metadata?.filters) {
      metaLines.push(`# Filters: ${metadata.filters}`);
    }
    metaLines.push(`# Generated: ${this.formatTimestamp(new Date())} | NELC Compliant`);
    metaLines.push('');

    const lines = [
      ...metaLines,
      headers.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];

    return Buffer.from(lines.join('\r\n'), 'utf-8');
  }

  // ═══════════════════════════════════════════════════════════
  // ─── PDF Generator (PDFKit) ───────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private async generatePdf(
    title: string,
    headers: string[],
    rows: string[][],
    metadata?: ReportMetadata,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit');

    return new Promise<Buffer>((resolve, reject) => {
      const isLandscape = headers.length > 5;
      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        layout: isLandscape ? 'landscape' : 'portrait',
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = pageWidth / headers.length;
      const startX = doc.page.margins.left;

      // ── Title ──
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(title, { align: 'center' });
      doc.moveDown(0.3);

      // ── Metadata block ──
      if (metadata?.instructorName) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`Instructor: ${metadata.instructorName}`, { align: 'center' });
      }
      if (metadata?.filters) {
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text(`Filters: ${metadata.filters}`, { align: 'center' });
      }
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Generated: ${this.formatTimestamp(new Date())} | NELC Compliant`, {
          align: 'center',
        });
      doc.moveDown(0.8);

      let y = doc.y;

      // ── NELC footer helper ──
      const drawFooter = () => {
        doc
          .fontSize(7)
          .font('Helvetica')
          .text(
            `Total records: ${rows.length}  |  NELC Compliant Report — PhysioGuidance`,
            startX,
            doc.page.height - doc.page.margins.bottom - 10,
          );
      };

      // ── Header row drawing helper ──
      const drawHeaders = () => {
        doc.fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, startX + i * colWidth, y, {
            width: colWidth - 3,
            lineBreak: false,
          });
        });
        y += 14;
        doc
          .moveTo(startX, y)
          .lineTo(startX + pageWidth, y)
          .stroke();
        y += 6;
        doc.font('Helvetica').fontSize(7);
      };

      drawHeaders();

      // ── Data rows ──
      for (const row of rows) {
        // Page break check
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
          drawFooter();
          doc.addPage();
          y = doc.page.margins.top;
          drawHeaders();
        }

        row.forEach((cell, i) => {
          doc.text(String(cell ?? ''), startX + i * colWidth, y, {
            width: colWidth - 3,
            lineBreak: false,
          });
        });
        y += 12;
      }

      // ── Footer on last page ──
      drawFooter();

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Excel Generator (ExcelJS) ────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private async generateExcel(
    title: string,
    headers: string[],
    rows: string[][],
    metadata?: ReportMetadata,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PhysioGuidance';
    workbook.created = new Date();

    // Excel sheet name max 31 chars
    const sheetName = title.substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    let rowNum = 1;

    // Title row
    const titleRow = worksheet.addRow([title]);
    titleRow.font = { bold: true, size: 14 };
    if (headers.length > 1) {
      worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
    }
    rowNum++;

    // Instructor row
    if (metadata?.instructorName) {
      const instrRow = worksheet.addRow([`Instructor: ${metadata.instructorName}`]);
      instrRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
      if (headers.length > 1) {
        worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
      }
      rowNum++;
    }

    // Filters row
    if (metadata?.filters) {
      const filterRow = worksheet.addRow([`Filters: ${metadata.filters}`]);
      filterRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
      if (headers.length > 1) {
        worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
      }
      rowNum++;
    }

    // Generated date row
    const dateRow = worksheet.addRow([
      `Generated: ${this.formatTimestamp(new Date())} | NELC Compliant`,
    ]);
    dateRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
    if (headers.length > 1) {
      worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
    }
    rowNum++;

    // Empty separator row
    worksheet.addRow([]);
    rowNum++;

    // Header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FF333333' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    headerRow.eachCell((cell: any) => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF999999' } },
      };
    });

    // Data rows
    for (const row of rows) {
      worksheet.addRow(row);
    }

    // Auto-fit column widths
    for (let i = 0; i < headers.length; i++) {
      let maxLen = headers[i].length;
      for (const row of rows) {
        const len = String(row[i] || '').length;
        if (len > maxLen) maxLen = len;
      }
      const col = worksheet.getColumn(i + 1);
      col.width = Math.min(maxLen + 3, 45);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Helpers ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0].slice(0, 5)}`;
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 16);
  }

  /**
   * Resolve course IDs from either a specific courseId or all instructor's courses.
   * Admin: if no courseId, returns all courses.
   * Instructor: if no courseId, returns their own courses.
   */
  private async resolveCourseIds(
    user: AuthenticatedUser,
    courseId?: string,
  ): Promise<string[]> {
    if (courseId) {
      await this.verifyCourseAccess(courseId, user);
      return [courseId];
    }

    if (this.isAdmin(user)) {
      const allCourses = await db
        .select({ id: courses.id })
        .from(courses);
      return allCourses.map((c) => c.id);
    }

    return this.getInstructorCourseIds(user.id);
  }

  private async getInstructorCourseIds(
    instructorId: string,
  ): Promise<string[]> {
    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.instructorId, instructorId));
    return instructorCourses.map((c) => c.id);
  }

  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const conditions = [eq(courses.id, courseId)];
    if (!this.isAdmin(user)) {
      conditions.push(eq(courses.instructorId, user.id));
    }

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
}
