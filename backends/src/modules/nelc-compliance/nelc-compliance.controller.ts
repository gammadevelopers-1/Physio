import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { NelcComplianceService } from './nelc-compliance.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('nelc-compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NelcComplianceController {
  constructor(private readonly complianceService: NelcComplianceService) {}

  /**
   * GET /nelc-compliance/summary — Dashboard-level compliance summary
   */
  @Roles(
    'INSTRUCTOR' as UserRole,
    'ADMIN' as UserRole,
    'MANAGER' as UserRole,
    'SUPER_ADMIN' as UserRole,
  )
  @Get('summary')
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.complianceService.getComplianceSummary(user);
  }

  /**
   * GET /nelc-compliance/all-courses — All-courses compliance for CM dashboard page
   */
  @Roles(
    'MANAGER' as UserRole,
    'ADMIN' as UserRole,
    'SUPER_ADMIN' as UserRole,
  )
  @Get('all-courses')
  async getAllCoursesCompliance(@CurrentUser() user: AuthenticatedUser) {
    return this.complianceService.getAllCoursesCompliance(user);
  }

  /**
   * GET /nelc-compliance/export.csv — One row per course with score and
   * per-category breakdown. Used by the admin NELC page's "Export
   * report" button.
   */
  @Roles(
    'MANAGER' as UserRole,
    'ADMIN' as UserRole,
    'SUPER_ADMIN' as UserRole,
  )
  @Get('export.csv')
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const csv = await this.complianceService.exportAllCoursesCsv(user);
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="nelc-compliance-${stamp}.csv"`,
    });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  /**
   * GET /nelc-compliance/session/:id — Session-level compliance check
   */
  @Roles(
    'INSTRUCTOR' as UserRole,
    'ADMIN' as UserRole,
    'MANAGER' as UserRole,
    'SUPER_ADMIN' as UserRole,
  )
  @Get('session/:id')
  async getSessionCompliance(@Param('id') sessionId: string) {
    return this.complianceService.validateSessionCompliance(sessionId);
  }

  /**
   * GET /nelc-compliance/course/:id — Course-level compliance check
   */
  @Roles(
    'INSTRUCTOR' as UserRole,
    'ADMIN' as UserRole,
    'MANAGER' as UserRole,
    'SUPER_ADMIN' as UserRole,
  )
  @Get('course/:id')
  async getCourseCompliance(@Param('id') courseId: string) {
    return this.complianceService.getCourseCompliance(courseId);
  }

  /**
   * GET /nelc-compliance/course/:id/scorecard — 7-category compliance scorecard
   */
  @Roles(
    'INSTRUCTOR' as UserRole,
    'MANAGER' as UserRole,
    'ADMIN' as UserRole,
    'SUPER_ADMIN' as UserRole,
  )
  @Get('course/:id/scorecard')
  async getCourseScorecard(@Param('id') courseId: string) {
    return this.complianceService.getCourseComplianceScorecard(courseId);
  }

  /**
   * GET /nelc-compliance/course/:id/evidence — Download evidence ZIP
   */
  @Roles(
    'MANAGER' as UserRole,
    'ADMIN' as UserRole,
    'SUPER_ADMIN' as UserRole,
  )
  @Get('course/:id/evidence')
  async downloadEvidence(
    @Param('id') courseId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archive = await this.complianceService.generateEvidenceBundle(courseId);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="nelc-evidence-${courseId.slice(0, 8)}.zip"`,
    });
    return new StreamableFile(archive as any);
  }

  /**
   * GET /nelc-compliance/virtual-classes — Virtual class (Zoom/hybrid) compliance
   */
  @Roles(
    'MANAGER' as UserRole,
    'ADMIN' as UserRole,
    'SUPER_ADMIN' as UserRole,
    'INSTRUCTOR' as UserRole,
  )
  @Get('virtual-classes')
  async getVirtualClassCompliance(@CurrentUser() user: AuthenticatedUser) {
    return this.complianceService.getVirtualClassCompliance(user);
  }
}
