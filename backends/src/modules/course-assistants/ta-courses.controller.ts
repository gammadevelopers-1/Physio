import { Controller, Get, UseGuards } from '@nestjs/common';
import { CourseAssistantsService } from './course-assistants.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('course-assistants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TACoursesController {
  constructor(
    private readonly courseAssistantsService: CourseAssistantsService,
  ) {}

  /**
   * GET /course-assistants/my-courses — TA fetches their own course assignments
   */
  @Roles('TEACHING_ASSISTANT' as UserRole)
  @Get('my-courses')
  async getMyCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.courseAssistantsService.getMyCourses(user.id);
  }
}
