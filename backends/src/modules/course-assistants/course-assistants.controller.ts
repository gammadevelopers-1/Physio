import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CourseAssistantsService } from './course-assistants.service';
import { AssignCourseTADto } from './dto/assign-course-ta.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('courses/:courseId/assistants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CourseAssistantsController {
  constructor(
    private readonly courseAssistantsService: CourseAssistantsService,
  ) {}

  /**
   * GET /courses/:courseId/assistants — List course TAs with status
   */
  @Roles('INSTRUCTOR' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get()
  async getCourseTAs(@Param('courseId') courseId: string) {
    return this.courseAssistantsService.getCourseTAs(courseId);
  }

  /**
   * POST /courses/:courseId/assistants — Manager/Admin direct assign
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async assignTA(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCourseTADto,
  ) {
    return this.courseAssistantsService.assignTA(
      courseId,
      dto.userId,
      user.id,
    );
  }

  /**
   * POST /courses/:courseId/assistants/suggest — Instructor suggests a TA
   */
  @Roles('INSTRUCTOR' as UserRole)
  @Post('suggest')
  @HttpCode(HttpStatus.CREATED)
  async suggestTA(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCourseTADto,
  ) {
    return this.courseAssistantsService.suggestTA(
      courseId,
      dto.userId,
      user.id,
    );
  }

  /**
   * PATCH /courses/:courseId/assistants/:userId/approve — Manager/Admin approves suggestion
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':userId/approve')
  async approveTA(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courseAssistantsService.approveTA(courseId, userId, user.id);
  }

  /**
   * PATCH /courses/:courseId/assistants/:userId/reject — Manager/Admin rejects suggestion
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':userId/reject')
  async rejectTA(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ) {
    return this.courseAssistantsService.rejectTA(courseId, userId);
  }

  /**
   * DELETE /courses/:courseId/assistants/:userId — Manager/Admin removes TA
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Delete(':userId')
  async removeTA(
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ) {
    return this.courseAssistantsService.removeTA(courseId, userId);
  }
}
