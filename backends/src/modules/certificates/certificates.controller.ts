import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CertificatesService } from './certificates.service';
import { CreateCertificateRequestDto } from './dto/create-certificate-request.dto';
import { RejectCertificateDto } from './dto/reject-certificate.dto';
import { HoldCertificateDto } from './dto/hold-certificate.dto';
import { RevokeCertificateDto } from './dto/revoke-certificate.dto';
import { BatchCertificateDto } from './dto/batch-certificate.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { Public } from '../auth/decorators/public.decorator';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Throttle } from '@nestjs/throttler';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatesController {
  constructor(private certificatesService: CertificatesService) {}

  // ─── Certificate Requests ───────────────────────────────────

  /**
   * POST /certificates — Create a certificate request for a course.
   * Student or instructor can create.
   */
  @Roles(
    'STUDENT' as UserRole,
    'INSTRUCTOR' as UserRole,
    'ADMIN' as UserRole,
  )
  @Post('certificates')
  @HttpCode(HttpStatus.CREATED)
  async createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCertificateRequestDto,
  ) {
    return this.certificatesService.createRequest(dto.courseId, user.id);
  }

  /**
   * POST /certificates/batch — Batch process certificate requests.
   * Static route must come BEFORE parameterized :id route.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post('certificates/batch')
  @HttpCode(HttpStatus.OK)
  async batch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchCertificateDto,
  ) {
    return this.certificatesService.batch(user, dto);
  }

  /**
   * GET /certificates/my-certificates — Get student's approved certificates.
   * Static route must come BEFORE parameterized :id route.
   */
  @Roles(
    'STUDENT' as UserRole,
    'INSTRUCTOR' as UserRole,
    'ADMIN' as UserRole,
  )
  @Get('certificates/my-certificates')
  async getMyCertificates(@CurrentUser() user: AuthenticatedUser) {
    return this.certificatesService.getStudentCertificates(user.id);
  }

  /**
   * POST /certificates/batch-download — Download multiple certificates as ZIP.
   * Static route must come BEFORE parameterized :id route.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post('certificates/batch-download')
  @HttpCode(HttpStatus.OK)
  async batchDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { ids: string[] },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.certificatesService.batchDownloadCertificates(body.ids, user);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  /**
   * GET /certificates/verify/:id — Public certificate verification endpoint.
   * No authentication required.
   */
  @Public()
  @Throttle({ 'cert-verify': { limit: 30, ttl: 60_000 } }) // 30 / min / IP — defeats enumeration of short PG-XXXXXXXX IDs
  @Get('certificates/verify/:id')
  async verifyCertificate(@Param('id') id: string) {
    return this.certificatesService.verifyCertificate(id);
  }

  /**
   * GET /certificates/:id/download — Download a single certificate PDF.
   */
  @Roles(
    'INSTRUCTOR' as UserRole,
    'ADMIN' as UserRole,
    'MANAGER' as UserRole,
    'STUDENT' as UserRole,
  )
  @Get('certificates/:id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.certificatesService.downloadCertificate(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  /**
   * GET /certificates/:id — Get a single certificate request detail.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('certificates/:id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.findOne(id, user);
  }

  /**
   * PATCH /certificates/:id/approve — Approve a certificate request.
   * Generates a placeholder PDF.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch('certificates/:id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificatesService.approve(id, user);
  }

  /**
   * PATCH /certificates/:id/reject — Reject a certificate request.
   * Requires a rejection note.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch('certificates/:id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectCertificateDto,
  ) {
    return this.certificatesService.reject(id, user, dto);
  }

  /**
   * PATCH /certificates/:id/hold — Place a certificate request on hold.
   * Requires an audit note.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch('certificates/:id/hold')
  async hold(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: HoldCertificateDto,
  ) {
    return this.certificatesService.hold(id, user, dto);
  }

  /**
   * PATCH /certificates/:id/revoke — Revoke an approved certificate.
   * Only MANAGER/ADMIN. Requires a reason.
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch('certificates/:id/revoke')
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RevokeCertificateDto,
  ) {
    return this.certificatesService.revoke(id, user, dto);
  }

  // ─── Instructor Route Prefix ────────────────────────────────

  /**
   * GET /instructor/certificates — List certificate requests (pending by default).
   * - Instructor: only for their own courses.
   * - Admin: all.
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('instructor/certificates')
  async findPending(
    @CurrentUser() user: AuthenticatedUser,
    @Query('courseId') courseId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('managerId') managerId?: string,
    @Query('search') search?: string,
  ) {
    return this.certificatesService.findPending(user, {
      courseId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      managerId,
      search,
    });
  }
}
