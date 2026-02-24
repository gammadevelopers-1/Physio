import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
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
@Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
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

  // ─── 5. Satisfaction Report ────────────────────────────────

  /**
   * GET /instructor/reports/satisfaction
   * Query: ?courseId, ?format=csv|pdf|xlsx
   */
  @Get('satisfaction')
  async getSatisfactionReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateSatisfactionReport(
      user,
      courseId,
      format,
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── 6. Instructor Performance Report ──────────────────────

  /**
   * GET /instructor/reports/instructor-performance
   * Query: ?format=csv|pdf|xlsx
   */
  @Get('instructor-performance')
  async getInstructorPerformanceReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateInstructorPerformanceReport(
      user,
      format,
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── NELC Compliance Matrix ─────────────────────────────

  @Get('nelc-compliance')
  async getNelcComplianceReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateNelcComplianceReport(
      user,
      { courseId, format },
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── Course Catalog Report ───────────────────────────────

  @Get('course-catalog')
  async getCourseCatalogReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateCourseCatalogReport(
      user,
      { courseId, format },
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── 9. Revenue Report ─────────────────────────────────────

  /**
   * GET /instructor/reports/revenue
   * Query: ?format=csv|pdf|xlsx, ?dateFrom, ?dateTo
   * Manager/Admin only — returns binary file download.
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('revenue')
  async getRevenueReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('format') format?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.generateRevenueReport(
      user,
      { format, dateFrom, dateTo },
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── Generic Table Export ────────────────────────────────

  /**
   * POST /instructor/reports/export-table
   * Body: { type: string, format: string, filters?: Record<string, string> }
   * Returns binary file download for any table view.
   */
  @Post('export-table')
  async exportTable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { type: string; format: string; filters?: Record<string, string> },
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.reportsService.exportTable(
      user,
      body.type,
      body.format,
      body.filters,
    );

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }

  // ─── Scheduled Reports CRUD ──────────────────────────────

  @Get('scheduled')
  async getScheduledReports(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.getScheduledReports(user);
  }

  @Post('scheduled')
  async createScheduledReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { reportType: string; format?: string; courseId?: string; frequency: string; recipientEmail?: string },
  ) {
    return this.reportsService.createScheduledReport(user, body);
  }

  @Patch('scheduled/:id')
  async updateScheduledReport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { enabled?: boolean; frequency?: string; format?: string },
  ) {
    return this.reportsService.updateScheduledReport(id, user, body);
  }

  @Delete('scheduled/:id')
  async deleteScheduledReport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.deleteScheduledReport(id, user);
  }
}
