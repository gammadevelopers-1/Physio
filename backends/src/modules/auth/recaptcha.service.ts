import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SiteVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

  constructor(private readonly config: ConfigService) {}

  async verify(token: string | undefined | null, action: string): Promise<void> {
    const secret = this.config.get<string>('RECAPTCHA_SECRET_KEY');

    if (!secret) {
      this.logger.error(`RECAPTCHA_SECRET_KEY missing — refusing ${action}`);
      throw new ServiceUnavailableException('Captcha service not configured');
    }

    if (!token || typeof token !== 'string' || !token.trim()) {
      throw new BadRequestException('Captcha verification required');
    }

    let result: SiteVerifyResponse;
    try {
      const body = new URLSearchParams({ secret, response: token.trim() });
      const res = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      result = (await res.json()) as SiteVerifyResponse;
    } catch (err) {
      this.logger.error(`reCAPTCHA verify request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Captcha verification temporarily unavailable');
    }

    if (!result.success) {
      this.logger.warn(`reCAPTCHA verification failed for ${action}: ${(result['error-codes'] || []).join(',')}`);
      throw new BadRequestException('Captcha verification failed');
    }
  }
}
