import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InstructorService } from './instructor.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateInterventionDto } from './dto';

@Controller('instructor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstructorController {
  constructor(private instructorService: InstructorService) {}

  /**
   * GET /instructor/dashboard-summary — Aggregated dashboard data.
   * NOTE: Must be defined BEFORE parameterized routes.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('dashboard-summary')
  async getDashboardSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.instructorService.getDashboardSummary(user);
  }

  /**
   * GET /instructor/roster — Enriched instructor list with workload metrics
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('roster')
  async getInstructorRoster() {
    return this.instructorService.getInstructorRoster();
  }

  /**
   * GET /instructor/students — All students across instructor's courses
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('students')
  async getStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
  ) {
    return this.instructorService.getStudents(user, courseId);
  }

  /**
   * GET /instructor/at-risk — At-risk learners
   * NOTE: Must be defined BEFORE :id route to avoid "at-risk" matching as :id
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('at-risk')
  async getAtRiskStudents(@CurrentUser() user: AuthenticatedUser) {
    return this.instructorService.getAtRiskStudents(user);
  }

  /**
   * POST /instructor/interventions — Create an at-risk student intervention
   * NOTE: Must be defined BEFORE :id route to avoid matching as param
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post('interventions')
  async createIntervention(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInterventionDto,
  ) {
    return this.instructorService.createIntervention(user, dto);
  }

  /**
   * GET /instructor/:id/performance — Instructor performance KPIs
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get(':id/performance')
  async getInstructorPerformance(@Param('id') instructorId: string) {
    return this.instructorService.getInstructorPerformance(instructorId);
  }

  /**
   * GET /instructor/students/:id — Student detail with enrollments, attendance, scores
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('students/:id')
  async getStudentDetail(
    @Param('id') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.instructorService.getStudentDetail(studentId, user);
  }
}
