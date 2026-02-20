import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
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
}
