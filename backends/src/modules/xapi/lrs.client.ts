import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XAPI_VERSION } from './nelc-spec';
import { NelcModeService } from './nelc-mode.service';

export interface LrsPostResult {
  /** HTTP status code returned by the LRS, or null when the request
   *  never got a response (timeout / DNS / abort). */
  httpStatus: number | null;
  /** Trimmed response body — useful when LRS returns validation details. */
  responseBody: string;
  /** Captured exception message when the request threw. Null on success
   *  or on a non-2xx response. */
  errorText: string | null;
  /** Convenience: true when httpStatus is 200–299. */
  ok: boolean;
}

/**
 * Thin HTTP client for NELC's LRS.
 *
 * Mirrors the BaseGateway.fetchWithRetry shape from the payments module:
 *   - 4xx returns immediately (client bug — retrying won't help)
 *   - 5xx + network errors retry with exponential backoff up to maxAttempts
 *   - timeout uses AbortController
 *
 * Returns LrsPostResult — never throws. The caller (queue processor)
 * records the result and flips status accordingly.
 */
@Injectable()
export class LrsClient {
  private readonly logger = new Logger(LrsClient.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly nelcMode: NelcModeService,
  ) {}

  /** Single-statement POST. xAPI also supports posting an array of
   *  statements for batching, which we'll add later — for now we send
   *  one statement per request to keep per-statement transmission rows
   *  faithful. */
  async postStatement(statement: Record<string, unknown>): Promise<LrsPostResult> {
    const active = await this.nelcMode.getActive();
    const { mode, endpoint, username, password, hasPassword } = active;
    const timeoutMs = this.configService.get<number>('nelc.timeoutMs') || 15_000;
    const maxAttempts = this.configService.get<number>('nelc.maxAttempts') || 3;

    if (!endpoint || !username || !hasPassword) {
      return {
        httpStatus: null,
        responseBody: '',
        errorText: `LRS not configured for ${mode} mode (endpoint/username/password missing)`,
        ok: false,
      };
    }

    const authHeader =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
    const body = JSON.stringify(statement);

    let lastError: Error | null = null;
    let lastHttpStatus: number | null = null;
    let lastBody = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Experience-API-Version': XAPI_VERSION,
            Authorization: authHeader,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        lastHttpStatus = response.status;
        lastBody = (await response.text()).slice(0, 2000);

        // xAPI spec: LRS returns 200 (with statement-id array) or 204
        // (empty body). Treat the whole 2xx range as success.
        if (response.status >= 200 && response.status < 300) {
          return {
            httpStatus: response.status,
            responseBody: lastBody,
            errorText: null,
            ok: true,
          };
        }

        // 4xx — client error. Retrying won't help. Surface the body so
        // the admin log shows NELC's complaint verbatim.
        if (response.status >= 400 && response.status < 500) {
          return {
            httpStatus: response.status,
            responseBody: lastBody,
            errorText: null,
            ok: false,
          };
        }

        // 5xx — retry. Fall through.
        if (attempt < maxAttempts) {
          const delay = 500 * Math.pow(2, attempt - 1);
          this.logger.warn(
            `[LRS:${mode}] Server error ${response.status}, retry ${attempt}/${maxAttempts} in ${delay}ms`,
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        // Final 5xx — return as failure.
        return {
          httpStatus: response.status,
          responseBody: lastBody,
          errorText: null,
          ok: false,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        const e = err as Error;
        lastError = e;
        lastHttpStatus = null;
        const isTimeout = e.name === 'AbortError';
        if (attempt < maxAttempts) {
          const delay = 500 * Math.pow(2, attempt - 1);
          this.logger.warn(
            `[LRS:${mode}] ${isTimeout ? 'Timeout' : 'Network error'}, retry ${attempt}/${maxAttempts} in ${delay}ms: ${e.message}`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    return {
      httpStatus: lastHttpStatus,
      responseBody: lastBody,
      errorText: lastError?.message ?? 'Max retries exceeded',
      ok: false,
    };
  }
}
