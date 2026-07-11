import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { eq, and, lte } from 'drizzle-orm';
import { db } from '../../database';
import { scheduledReports, users, userRoles, roles } from '../../database/schema';
import { ReportsService } from './reports.service';
import { EmailService } from '../email/email.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class ReportSchedulerService {
  private readonly logger = new Logger(ReportSchedulerService.name);

  constructor(
    private readonly reportsService: ReportsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Runs every day at 06:00 AM.
   * Finds all enabled scheduled reports whose nextRunAt has passed,
   * generates the report, optionally emails it, and updates timestamps.
   */
  @Cron('0 6 * * *')
  async handleScheduledReports(): Promise<void> {
    if (isCronExternalized('reports.schedule')) return;
    this.logger.log('Running scheduled reports cron job...');

    const now = new Date();

    const dueSchedules = await db
      .select()
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.enabled, true),
          lte(scheduledReports.nextRunAt, now),
        ),
      );

    this.logger.log(`Found ${dueSchedules.length} due scheduled report(s)`);

    for (const schedule of dueSchedules) {
      try {
        // Build an AuthenticatedUser from the schedule's userId
        const fakeUser = await this.buildAuthenticatedUser(schedule.userId);
        if (!fakeUser) {
          this.logger.warn(
            `Skipping schedule ${schedule.id}: user ${schedule.userId} not found`,
          );
          continue;
        }

        // Generate the report
        const result = await this.generateReport(
          schedule.reportType,
          fakeUser,
          schedule.courseId,
          schedule.format,
        );

        // If recipientEmail is set, send via email
        if (schedule.recipientEmail && result) {
          const subject = `Scheduled Report: ${schedule.reportType} (${schedule.frequency})`;
          await this.emailService.sendReportEmail(
            schedule.recipientEmail,
            subject,
            result.buffer,
            result.filename,
          );
        }

        // Update lastRunAt and calculate nextRunAt
        const nextRunAt = this.calculateNextRunAt(schedule.frequency);
        await db
          .update(scheduledReports)
          .set({
            lastRunAt: now,
            nextRunAt,
            updatedAt: now,
          })
          .where(eq(scheduledReports.id, schedule.id));

        this.logger.log(
          `Schedule ${schedule.id} (${schedule.reportType}) executed successfully`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to execute schedule ${schedule.id}: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log('Scheduled reports cron job completed');
  }

  /**
   * Build a minimal AuthenticatedUser from a userId for report generation.
   */
  private async buildAuthenticatedUser(
    userId: string,
  ): Promise<AuthenticatedUser | null> {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        activeRole: users.activeRole,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return null;

    // Fetch user roles
    const userRoleRows = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      activeRole: user.activeRole,
      roles: userRoleRows.map((r) => r.roleName),
      isActive: user.isActive,
    };
  }

  /**
   * Dispatch to the correct report generator based on reportType.
   */
  private async generateReport(
    reportType: string,
    user: AuthenticatedUser,
    courseId: string | null,
    format: string,
  ) {
    switch (reportType) {
      case 'attendance':
        return this.reportsService.generateAttendanceReport(user, {
          courseId: courseId || undefined,
          format,
        });
      case 'gradebook':
        return this.reportsService.generateGradebookReport(user, {
          courseId: courseId || undefined,
          format,
        });
      case 'enrollment':
        return this.reportsService.generateEnrollmentReport(user, {
          courseId: courseId || undefined,
          format,
        });
      case 'completion':
        return this.reportsService.generateCompletionReport(user, {
          courseId: courseId || undefined,
          format,
        });
      case 'satisfaction':
        return this.reportsService.generateSatisfactionReport(
          user,
          courseId || undefined,
          format,
        );
      case 'instructor-performance':
        return this.reportsService.generateInstructorPerformanceReport(
          user,
          format,
        );
      case 'nelc-compliance':
        return this.reportsService.generateNelcComplianceReport(user, {
          courseId: courseId || undefined,
          format,
        });
      default:
        this.logger.warn(`Unknown report type: ${reportType}`);
        return null;
    }
  }

  private calculateNextRunAt(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}
