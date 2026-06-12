import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators';
import { ScopedJwtGuard } from '../auth/guards/scoped-jwt.guard';
import { TrainerApplicationsService } from './trainer-applications.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';
import { PortalRequestOtpDto } from './dto/portal-request-otp.dto';
import { PortalVerifyOtpDto } from './dto/portal-verify-otp.dto';
import { PortalResubmitDto } from './dto/portal-resubmit.dto';

@Controller('trainer-applications')
export class TrainerApplicationsController {
  constructor(private readonly service: TrainerApplicationsService) {}

  /**
   * Public — captcha-protected. Sends 6-digit OTP to applicant email.
   */
  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.requestOtp(dto, {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent,
    });
  }

  /**
   * Public — verifies the code, returns a short-lived scoped JWT
   * that authorises file upload + final submit.
   */
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.service.verifyOtp(dto);
  }

  /**
   * Public route, protected by ScopedJwtGuard — caller must present the
   * trainer-application JWT obtained from /verify-otp. The verified
   * email comes from the JWT, not the body. Asserts the token's
   * purpose is 'trainer-application' so a portal token can't be
   * replayed here.
   */
  @Public()
  @UseGuards(ScopedJwtGuard)
  @Post('submit')
  async submit(@Req() req: Request, @Body() dto: SubmitApplicationDto) {
    const purpose = (req as any).scopedPurpose as string;
    if (purpose !== 'trainer-application') {
      throw new ForbiddenException(
        'Token not valid for submitting a new application',
      );
    }
    const verifiedEmail = (req as any).scopedEmail as string;
    return this.service.submit(verifiedEmail, dto);
  }

  // ──────────────────────────────────────────────────────────────
  // Self-serve portal — check status, resubmit a MORE_INFO app
  // without ever logging in. OTP-protected end-to-end. Distinct
  // purpose from the submit token so leaked codes don't cross-fire.
  // ──────────────────────────────────────────────────────────────

  /**
   * Step 1 — captcha + send portal OTP to the applicant's email.
   */
  @Public()
  @Post('portal/request-otp')
  @HttpCode(HttpStatus.OK)
  async portalRequestOtp(
    @Body() dto: PortalRequestOtpDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.portalRequestOtp(dto, {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent,
    });
  }

  /**
   * Step 2 — verify the OTP. Returns the scoped portal JWT plus the
   * applicant's current application snapshot (status, events, missing
   * reqs, prefill data when in MORE_INFO).
   */
  @Public()
  @Post('portal/verify-otp')
  @HttpCode(HttpStatus.OK)
  async portalVerifyOtp(@Body() dto: PortalVerifyOtpDto) {
    return this.service.portalVerifyOtp(dto);
  }

  /**
   * Refresh the status with an active portal token. Frontend calls
   * this after a successful resubmit so the timeline + chips update
   * without a full reload.
   */
  @Public()
  @UseGuards(ScopedJwtGuard)
  @Get('portal/status')
  async portalStatus(@Req() req: Request) {
    const purpose = (req as any).scopedPurpose as string;
    if (purpose !== 'trainer-application-portal') {
      throw new ForbiddenException('Token not valid for portal access');
    }
    const verifiedEmail = (req as any).scopedEmail as string;
    return this.service.portalStatus(verifiedEmail);
  }

  /**
   * Resubmit a MORE_INFO application from the portal. Email comes
   * from the JWT, role_request_id from the body — service verifies
   * the latter belongs to the former.
   */
  @Public()
  @UseGuards(ScopedJwtGuard)
  @Post('portal/resubmit')
  async portalResubmit(
    @Req() req: Request,
    @Body() dto: PortalResubmitDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    const purpose = (req as any).scopedPurpose as string;
    if (purpose !== 'trainer-application-portal') {
      throw new ForbiddenException(
        'Token not valid for resubmitting an application',
      );
    }
    const verifiedEmail = (req as any).scopedEmail as string;
    return this.service.portalResubmit(verifiedEmail, dto, {
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: userAgent ?? null,
    });
  }
}
