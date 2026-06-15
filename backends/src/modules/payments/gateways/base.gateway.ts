import { Logger } from '@nestjs/common';
import { PaymentGatewayError, NormalizedErrorCode } from './payment-gateway.error';

export abstract class BaseGateway {
  protected abstract readonly logger: Logger;
  protected abstract readonly name: string;

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 10000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new PaymentGatewayError(this.name, 'Request timed out', 'gateway_timeout', err);
      }
      throw new PaymentGatewayError(this.name, err.message, 'network_error', err);
    }
  }

  protected async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxAttempts = 3,
    initialDelayMs = 500,
  ): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options);
        // Don't retry 4xx (client errors)
        if (response.status >= 400 && response.status < 500) return response;
        // Retry 5xx (server errors)
        if (response.status >= 500 && attempt < maxAttempts) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `[${this.name}] Server error ${response.status}, retry ${attempt}/${maxAttempts} in ${delay}ms`,
          );
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return response;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `[${this.name}] Request error, retry ${attempt}/${maxAttempts} in ${delay}ms: ${err.message}`,
          );
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError || new PaymentGatewayError(this.name, 'Max retries exceeded', 'gateway_error');
  }

  protected normalizeErrorCode(rawCode: string | undefined): NormalizedErrorCode {
    if (!rawCode) return 'unknown';
    const c = String(rawCode).toLowerCase();
    if (c.includes('insufficient') || c.includes('balance') || c === '51') return 'insufficient_funds';
    if (c.includes('expired') || c === '54') return 'card_expired';
    if (c.includes('3ds') || c.includes('authentication')) return '3ds_failed';
    if (c === '05' || c.includes('do_not_honor')) return 'do_not_honor';
    if (c.includes('invalid') && c.includes('card')) return 'invalid_card';
    if (c.includes('declined') || c.includes('decline') || c === '12') return 'card_declined';
    if (c.includes('timeout')) return 'gateway_timeout';
    return 'unknown';
  }
}
