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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assessmentsService.findAll(user, {
      courseId,
      type,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /assessments/:id — Assessment detail with questions
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Get(':id/questions')
  async getQuestions(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getQuestions(assessmentId, user);
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
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Get(':id/submissions')
  async getSubmissions(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getSubmissions(assessmentId, user);
  }

  // ─── Item Analysis ────────────────────────────────────────

  /**
   * GET /assessments/:id/item-analysis — Difficulty + discrimination indices
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Get(':id/item-analysis')
  async getItemAnalysis(
    @Param('id') assessmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.getItemAnalysis(assessmentId, user);
  }
}
