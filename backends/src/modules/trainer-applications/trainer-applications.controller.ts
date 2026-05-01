import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators';
import { ScopedJwtGuard } from '../auth/guards/scoped-jwt.guard';
import { TrainerApplicationsService } from './trainer-applications.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';

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
   * email comes from the JWT, not the body.
   */
  @Public()
  @UseGuards(ScopedJwtGuard)
  @Post('submit')
  async submit(@Req() req: Request, @Body() dto: SubmitApplicationDto) {
    const verifiedEmail = (req as any).scopedEmail as string;
    return this.service.submit(verifiedEmail, dto);
  }
}
