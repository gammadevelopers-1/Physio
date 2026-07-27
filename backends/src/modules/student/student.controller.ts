import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { StudentService } from './student.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  UpdateProgressDto,
  CreateTicketDto,
  ReplyTicketDto,
  RateTicketDto,
} from './dto';

@Controller('student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT' as UserRole)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  // ─── Dashboard ──────────────────────────────────────────

  /**
   * GET /student/dashboard — KPI stats for the student
   */
  @Get('dashboard')
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.getDashboardStats(user.id);
  }

  // ─── Enrolled Courses ───────────────────────────────────

  /**
   * GET /student/courses — Student's enrolled courses
   */
  /**
   * GET /student/enrollment-status?courseIds=a,b,c — bulk check whether the
   * current student is already enrolled in each course. Powers the
   * "Already Enrolled" UX on course detail / cart / checkout so the buyer
   * never sees payment methods for a course they already own. Accepts up
   * to 50 ids per call; unknown ids return isEnrolled=false instead of
   * 404 so the UI can render a uniform map without per-id error handling.
   */
  @Get('enrollment-status')
  async getEnrollmentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseIds') courseIdsCsv?: string,
  ) {
    const ids = (courseIdsCsv || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.studentService.getEnrollmentStatusBulk(user.id, ids);
  }

  @Get('courses')
  async getMyCourses(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('delivery') delivery?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.studentService.getEnrolledCourses(user.id, {
      status,
      search,
      delivery,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sort,
    });
  }

  /**
   * GET /student/courses/:id — Single enrolled course detail
   */
  @Get('courses/:id')
  async getCourseDetail(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getEnrolledCourseDetail(user.id, courseId);
  }

  /**
   * GET /student/courses/:id/progress — Detailed progress for a course
   */
  @Get('courses/:id/progress')
  async getCourseProgress(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getCourseProgress(user.id, courseId);
  }

  /**
   * POST /student/courses/:id/progress — Update lesson/module completion
   */
  @Post('courses/:id/progress')
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.studentService.updateProgress(user.id, courseId, dto);
  }

  // ─── Self-Enrollment ────────────────────────────────────

  /**
   * POST /student/enroll/:id — Student self-enrolls in a course
   */
  @Post('enroll/:id')
  @HttpCode(HttpStatus.CREATED)
  async selfEnroll(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.selfEnroll(user.id, courseId, user);
  }

  // ─── Drop Course ─────────────────────────────────────────

  /**
   * DELETE /student/courses/:id/drop — Student drops a course
   */
  @Delete('courses/:id/drop')
  @HttpCode(HttpStatus.OK)
  async dropCourse(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.dropCourse(user.id, courseId);
  }

  // ─── Module Materials ──────────────────────────────────

  /**
   * GET /student/courses/:courseId/modules/:moduleId/materials — Get materials for a module
   */
  @Get('courses/:courseId/modules/:moduleId/materials')
  async getModuleMaterials(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getModuleMaterials(user.id, courseId, moduleId);
  }

  // ─── Assessments ──────────────────────────────────────

  /**
   * GET /student/assessments/:id — Get assessment with questions (for taking)
   */
  @Get('assessments/:id')
  async getAssessment(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getAssessmentForStudent(user.id, assessmentId);
  }

  /**
   * POST /student/assessments/:id/submit — Submit assessment answers
   */
  @Post('assessments/:id/submit')
  @HttpCode(HttpStatus.OK)
  async submitAssessment(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { answers: { questionId: string; answer: string }[] },
  ) {
    return this.studentService.submitAssessment(
      user.id,
      assessmentId,
      body.answers,
    );
  }

  /**
   * POST /student/assessments/:id/submit-assignment — Submit assignment files
   */
  @Post('assessments/:id/submit-assignment')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per file
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'video/mp4',
          'video/quicktime',
          'video/mpeg',
          'video/webm',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type '${file.mimetype}' is not allowed`), false);
        }
      },
    }),
  )
  async submitAssignmentFiles(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }
    return this.studentService.submitAssignmentFiles(user.id, assessmentId, files);
  }

  /**
   * POST /student/assessments/:id/save-progress — Auto-save assessment progress
   */
  @Post('assessments/:id/save-progress')
  @HttpCode(HttpStatus.OK)
  async saveProgress(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { answers: { questionId: string; answer: string }[] },
  ) {
    return this.studentService.saveAssessmentProgress(
      user.id,
      assessmentId,
      body.answers,
    );
  }

  /**
   * GET /student/assessments/:id/progress — Get saved assessment progress
   */
  @Get('assessments/:id/progress')
  async getProgress(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getAssessmentProgress(user.id, assessmentId);
  }

  /**
   * GET /student/submissions/:id/review — Get graded submission for review
   */
  @Get('submissions/:id/review')
  async getSubmissionReview(
    @Param('id') submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getSubmissionReview(user.id, submissionId);
  }

  // ─── Certificates ──────────────────────────────────────

  /**
   * GET /student/certificates — Student's earned certificates
   */
  @Get('certificates')
  async getCertificates(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.getCertificates(user.id);
  }

  /**
   * GET /student/grades/recent — Recently graded submissions for the dashboard widget
   */
  @Get('grades/recent')
  async getRecentGrades(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.studentService.getRecentGrades(user.id, Number(limit) || 5);
  }

  /**
   * GET /student/certificates/:id/download — Download a certificate PDF.
   */
  @Get('certificates/:id/download')
  async downloadCertificate(
    @Param('id') certId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('lang') lang?: string,
  ) {
    const langNorm =
      lang === 'ar' || lang === 'en' ? (lang as 'ar' | 'en') : undefined;
    const { buffer, filename } = await this.studentService.downloadStudentCertificate(certId, user.id, langNorm);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  /**
   * POST /student/materials/:id/watch-events — Record video watch events
   */
  @Post('materials/:id/watch-events')
  @HttpCode(HttpStatus.OK)
  async recordWatchEvents(
    @Param('id') materialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { events: { eventType: string; position: number; fromPosition?: number }[] },
  ) {
    return this.studentService.recordWatchEvents(user.id, materialId, body.events);
  }

  // ─── Zoom Join ─────────────────────────────────────────

  /**
   * GET /student/sessions/:id/join — Generate a Zoom join URL with
   * the student's display name pre-filled as "Full Name | PG-xxxxxxxx".
   * This is the ONLY way students should join Zoom sessions (not the raw link).
   */
  @Get('sessions/:id/join')
  async getSessionJoinUrl(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getSessionJoinUrl(user.id, sessionId);
  }

  // ─── Calendar ──────────────────────────────────────────

  /**
   * GET /student/calendar — Upcoming sessions, deadlines
   */
  @Get('calendar')
  async getCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.studentService.getCalendarEvents(user.id, { from, to });
  }

  /**
   * GET /student/calendar/export — Export calendar as .ics file
   */
  @Get('calendar/export')
  async exportCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.studentService.exportCalendarIcs(user.id, { from, to });

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── Recent Activity ───────────────────────────────────

  /**
   * GET /student/recent-activity — Recent activity timeline
   */
  @Get('recent-activity')
  async getRecentActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.studentService.getRecentActivity(
      user.id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ─── Transcript ────────────────────────────────────────

  /**
   * GET /student/transcript — Full academic transcript
   */
  @Get('transcript')
  async getTranscript(@CurrentUser() user: AuthenticatedUser) {
    return this.studentService.getTranscript(user.id);
  }

  // ─── FAQ & Tutorials ──────────────────────────────────

  /**
   * GET /student/faqs — Get FAQ categories and items
   */
  @Get('faqs')
  async getFaqs() {
    return this.studentService.getFaqs();
  }

  /**
   * GET /student/tutorials — Get video tutorials
   */
  @Get('tutorials')
  async getTutorials() {
    return this.studentService.getVideoTutorials();
  }

  // ─── Support Tickets ────────────────────────────────────

  /**
   * POST /student/tickets — Create a new support ticket
   */
  @Post('tickets')
  @HttpCode(HttpStatus.CREATED)
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.studentService.createTicket(user.id, dto);
  }

  /**
   * GET /student/tickets — List student's tickets
   */
  @Get('tickets')
  async getTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.studentService.getTickets(user.id, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /student/tickets/:id — Get ticket detail with replies
   */
  @Get('tickets/:id')
  async getTicketDetail(
    @Param('id') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentService.getTicketDetail(user.id, ticketId);
  }

  /**
   * POST /student/tickets/:id/reply — Reply to a ticket
   */
  @Post('tickets/:id/reply')
  @HttpCode(HttpStatus.CREATED)
  async replyToTicket(
    @Param('id') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.studentService.replyToTicket(user.id, ticketId, dto);
  }

  /**
   * POST /student/tickets/:id/rate — Rate a resolved ticket
   */
  @Post('tickets/:id/rate')
  @HttpCode(HttpStatus.OK)
  async rateTicket(
    @Param('id') ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RateTicketDto,
  ) {
    return this.studentService.rateTicket(user.id, ticketId, dto);
  }
}
