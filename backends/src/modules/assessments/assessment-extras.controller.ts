import {
  Controller,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

/**
 * Handles routes outside the /assessments prefix:
 * - /questions/:id (update, delete)
 * - /submissions/:id/grade (manual grading)
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentExtrasController {
  constructor(private assessmentsService: AssessmentsService) {}

  /**
   * PATCH /questions/:id — Update a question
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Patch('questions/:id')
  async updateQuestion(
    @Param('id') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.assessmentsService.updateQuestion(questionId, user, dto);
  }

  /**
   * DELETE /questions/:id — Delete a question
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Delete('questions/:id')
  async removeQuestion(
    @Param('id') questionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assessmentsService.removeQuestion(questionId, user);
  }

  /**
   * PATCH /submissions/:id/grade — Manual grade essay/short_answer
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
  @Patch('submissions/:id/grade')
  async gradeSubmission(
    @Param('id') submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.assessmentsService.gradeSubmission(
      submissionId,
      user,
      dto,
    );
  }
}
