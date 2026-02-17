import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

  // ─── Course Enrollment Endpoints ──────────────────────────

  /**
   * GET /courses/:id/enrollments — List students enrolled in a course
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('courses/:id/enrollments')
  async getCourseEnrollments(
    @Param('id') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.getCourseEnrollments(courseId, user);
  }

  // ─── Session Attendance Endpoints ─────────────────────────

  /**
   * GET /sessions/:id/attendance — List attendance for a session
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('sessions/:id/attendance')
  async getSessionAttendance(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.enrollmentsService.getSessionAttendance(sessionId, user);
  }

  /**
   * POST /sessions/:id/attendance — Mark single student attendance
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post('sessions/:id/attendance')
  @HttpCode(HttpStatus.CREATED)
  async markAttendance(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.enrollmentsService.markAttendance(sessionId, user, dto);
  }

  /**
   * POST /sessions/:id/attendance/bulk — Bulk mark attendance
   * NOTE: Must be defined BEFORE any parameterized attendance routes
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post('sessions/:id/attendance/bulk')
  @HttpCode(HttpStatus.CREATED)
  async bulkMarkAttendance(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkMarkAttendanceDto,
  ) {
    return this.enrollmentsService.bulkMarkAttendance(sessionId, user, dto);
  }

  // ─── Attendance Record Endpoints ──────────────────────────

  /**
   * PATCH /attendance/:id — Update an attendance record
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch('attendance/:id')
  async updateAttendance(
    @Param('id') attendanceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.enrollmentsService.updateAttendance(attendanceId, user, dto);
  }
}
