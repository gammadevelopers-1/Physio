import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(private assessmentsService: AssessmentsService) {}

  // ─── Assessment CRUD ──────────────────────────────────────

  /**
   * POST /assessments — Create a new assessment
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.assessmentsService.create(user, dto);
  }

  /**
   * GET /assessments — List assessments with filters
   */
  @Roles('INSTRUCTOR' as UserRole, 'TEACHING_ASSISTANT' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('moduleId') moduleId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assessmentsService.findAll(user, {
      courseId,
      type,
      status,
      moduleId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /assessments/course-bank/:courseId/questions — Course-level question bank
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('course-bank/:courseId/questions')
  async getCourseBankQuestions(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getCourseBankQuestions(courseId, user);
  }

  /**
   * POST /assessments/course-bank/:courseId/questions — Add question to course-level bank
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post('course-bank/:courseId/questions')
  @HttpCode(HttpStatus.CREATED)
  async addCourseBankQuestion(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.assessmentsService.addCourseBankQuestion(courseId, user, dto);
  }

  /**
   * GET /assessments/:id — Assessment detail with questions
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.findOne(id, user);
  }

  /**
   * PATCH /assessments/:id — Update an assessment
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessmentsService.update(id, user, dto);
  }

  /**
   * DELETE /assessments/:id — Delete a draft assessment
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.remove(id, user);
  }

  // ─── Question Endpoints (nested under assessment) ─────────

  /**
   * POST /assessments/:id/questions — Add a question to an assessment
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post(':id/questions')
  @HttpCode(HttpStatus.CREATED)
  async addQuestion(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.assessmentsService.addQuestion(assessmentId, user, dto);
  }

  /**
   * GET /assessments/:id/questions — List questions for an assessment
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get(':id/questions')
  async getQuestions(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getQuestions(assessmentId, user);
  }

  /**
   * PATCH /assessments/:assessmentId/questions/:questionId — Update a question
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch(':assessmentId/questions/:questionId')
  async updateQuestion(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.assessmentsService.updateQuestion(questionId, user, dto);
  }

  /**
   * DELETE /assessments/:assessmentId/questions/:questionId — Delete a question
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Delete(':assessmentId/questions/:questionId')
  async removeQuestion(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.removeQuestion(questionId, user);
  }

  // ─── Submission Endpoints ─────────────────────────────────

  /**
   * POST /assessments/:id/submit — Submit answers (auto-grades MCQ/TF)
   */
  @Roles(
    'STUDENT' as UserRole,
    'INSTRUCTOR' as UserRole,
    'ADMIN' as UserRole,
  )
  @Post(':id/submit')
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitAssessmentDto,
  ) {
    return this.assessmentsService.submit(assessmentId, user, dto);
  }

  /**
   * GET /assessments/:id/submissions — List submissions for an assessment
   */
  @Roles('INSTRUCTOR' as UserRole, 'TEACHING_ASSISTANT' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get(':id/submissions')
  async getSubmissions(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getSubmissions(assessmentId, user);
  }

  /**
   * PATCH /assessments/:id/submissions/:submissionId/grade — Grade a submission
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch(':id/submissions/:submissionId/grade')
  async gradeSubmission(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assessmentsService.gradeSubmission(submissionId, user, dto);
  }

  // ─── Assignment File Endpoints ──────────────────────────────

  /**
   * POST /assessments/:id/files — Upload an assignment file
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post(':id/files')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type '${file.mimetype}' is not allowed`), false);
        }
      },
    }),
  )
  async uploadAssignmentFile(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.assessmentsService.uploadAssignmentFile(assessmentId, user, file);
  }

  /**
   * DELETE /assessments/:id/files/:fileId — Remove an assignment file
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Delete(':id/files/:fileId')
  async removeAssignmentFile(
    @Param('id') assessmentId: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.removeAssignmentFile(assessmentId, fileId, user);
  }

  // ─── Assignment Grading ────────────────────────────────────

  /**
   * PATCH /assessments/:id/submissions/:submissionId/grade-assignment — Grade an assignment
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch(':id/submissions/:submissionId/grade-assignment')
  async gradeAssignment(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { score: number; comment?: string },
  ) {
    return this.assessmentsService.gradeAssignment(submissionId, user, body);
  }

  // ─── Item Analysis ────────────────────────────────────────

  /**
   * GET /assessments/:id/item-analysis — Difficulty + discrimination indices
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get(':id/item-analysis')
  async getItemAnalysis(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getItemAnalysis(assessmentId, user);
  }

  // ─── Difficulty Distribution ─────────────────────────────

  /**
   * GET /assessments/:id/difficulty-distribution — Question difficulty breakdown
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get(':id/difficulty-distribution')
  async getDifficultyDistribution(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getDifficultyDistribution(assessmentId, user);
  }

  // ─── Assessment Flagging ───────────────────────────────────

  /**
   * POST /assessments/:id/flag — Flag assessment for review
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/flag')
  async flagAssessment(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { reason: string },
  ) {
    return this.assessmentsService.flagAssessment(assessmentId, user, body.reason);
  }

  // ─── Emergency Overrides ─────────────────────────────────

  /**
   * POST /assessments/:id/override — Grant emergency override
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/override')
  @HttpCode(HttpStatus.CREATED)
  async createOverride(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { studentId: string; overrideType: string; value: number; reason: string; expiresAt?: string },
  ) {
    return this.assessmentsService.createOverride(assessmentId, user, body);
  }

  /**
   * GET /assessments/:id/overrides — List overrides for assessment
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get(':id/overrides')
  async getOverrides(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getOverrides(assessmentId, user);
  }

  // ─── Retake Grants ───────────────────────────────────────

  /**
   * POST /assessments/:id/allow-retake — Manager grants a retake to a student.
   * Body: { studentId, reason?, newDueDate? }  (newDueDate only for assignments)
   * The student gets one extra attempt; an in-app + email notification fires
   * to the student, plus an in-app notification to the course instructor.
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/allow-retake')
  @HttpCode(HttpStatus.CREATED)
  async allowRetake(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { studentId: string; reason?: string; newDueDate?: string },
  ) {
    return this.assessmentsService.allowRetake(assessmentId, user, body);
  }

  // ─── Blueprint Coverage ──────────────────────────────────

  /**
   * GET /assessments/blueprint/:courseId — Module-to-assessment coverage matrix
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('blueprint/:courseId')
  async getBlueprint(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getBlueprint(courseId, user);
  }
}
