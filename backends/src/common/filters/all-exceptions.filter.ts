import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';

/**
 * Catches every uncaught exception, logs the underlying cause with request
 * context, and returns a structured JSON error response. Without this filter,
 * NestJS swallows non-HttpException errors as a generic 500 with no log line —
 * making intermittent backend failures (pool exhaustion, query timeouts, etc.)
 * very hard to diagnose in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let code: string | undefined;

    if (isHttp) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        if (typeof r.message === 'string' || Array.isArray(r.message)) {
          message = r.message as string | string[];
        }
        if (typeof r.code === 'string') {
          code = r.code;
        }
      }
    } else if (exception instanceof Error) {
      // Map well-known low-level errors to a friendlier code.
      const raw = exception.message || '';
      if (/timeout exceeded when trying to connect/i.test(raw)) {
        code = 'DB_POOL_TIMEOUT';
        message = 'Service is temporarily busy. Please try again.';
      } else if (/connection terminated|ECONNREFUSED|ECONNRESET/i.test(raw)) {
        code = 'DB_CONNECTION_LOST';
        message = 'Service is temporarily unavailable. Please try again.';
      }
    }

    // Always log non-4xx errors with full context. 4xx are usually client errors.
    if (status >= 500) {
      const userId = (request as Request & { user?: { id?: string } }).user?.id;
      this.logger.error(
        `[${request.method} ${request.originalUrl}] user=${userId ?? 'anon'} status=${status} code=${code ?? 'NONE'}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      Sentry.withScope((scope) => {
        scope.setTag('http.method', request.method);
        scope.setTag('http.status', String(status));
        if (code) scope.setTag('error.code', code);
        if (userId) scope.setUser({ id: userId });
        scope.setContext('request', {
          url: request.originalUrl,
          method: request.method,
        });
        Sentry.captureException(exception);
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(code ? { code } : {}),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
