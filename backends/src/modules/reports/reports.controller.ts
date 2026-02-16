import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('instructor/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  // ─── 1. Attendance Report ──────────────────────────────────

  /**
   * GET /instructor/reports/attendance
   * Query: ?courseId, ?format=csv|pdf|xlsx, ?dateFrom, ?dateTo
   * Returns binary file download.
   */
  @Get('attendance')
  async getAttendanceReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('format') format?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateAttendanceReport(
      user,
      { courseId, format, dateFrom, dateTo },
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── 2. Gradebook Report ───────────────────────────────────

  /**
   * GET /instructor/reports/gradebook
   * Query: ?courseId (required), ?format=csv|pdf|xlsx
   * Returns binary file download.
   */
  @Get('gradebook')
  async getGradebookReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateGradebookReport(
      user,
      { courseId, format },
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── 3. Enrollment Report ──────────────────────────────────

  /**
   * GET /instructor/reports/enrollment
   * Query: ?courseId, ?format=csv|pdf|xlsx
   * Returns binary file download.
   */
  @Get('enrollment')
  async getEnrollmentReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateEnrollmentReport(
      user,
      { courseId, format },
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── 4. Completion Report ──────────────────────────────────

  /**
   * GET /instructor/reports/completion
   * Query: ?courseId, ?format=csv|pdf|xlsx
   * Returns binary file download.
   */
  @Get('completion')
  async getCompletionReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateCompletionReport(
      user,
      { courseId, format },
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }
}
