import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { csrfMiddleware } from './common/csrf.middleware';
import { RequestContextService } from './common/request-context.service';
import { createRequestContextMiddleware } from './common/request-context.middleware';

async function bootstrap() {
  // rawBody:true preserves the original POST body bytes on req.rawBody so
  // webhook receivers (Sentry, etc.) can HMAC-verify against the exact
  // payload the sender signed — JSON.stringify can't be trusted to
  // reproduce byte-identical output.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Behind GCP Cloud Run / LB, every request appears to originate from
  // the proxy. Without trust proxy, the throttler buckets every user
  // platform-wide into a single per-IP bucket, so a few admins doing
  // routine page loads trip the 600/min ceiling and start seeing 429s.
  // Trust the X-Forwarded-For chain so req.ip resolves to the real
  // client IP and each user gets their own bucket.
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', true);

  // Get configuration
  const port = configService.get<number>('PORT', 8080);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  // Set global prefix
  app.setGlobalPrefix(apiPrefix);

  // Enable CORS
  // exposedHeaders is required so the frontend can read Content-Disposition on
  // file-download responses — without it the browser strips the header from
  // JS and every download falls back to a generic "report.pdf" filename.
  app.enableCors({
    origin: corsOrigin.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true, // Important for cookies
    exposedHeaders: ['Content-Disposition'],
  });

  // Cookie parser (for refresh tokens)
  app.use(cookieParser());

  // Per-request context (client IP + user agent) captured into an
  // AsyncLocalStorage store so AuditLogService can include them on
  // every write without the call site plumbing through the request.
  // Must run BEFORE any business middleware that might fork the async
  // chain — placed right after cookie parser so the store wraps the
  // entire downstream pipeline (CSRF, guards, controllers, services).
  const requestContext = app.get(RequestContextService);
  app.use(createRequestContextMiddleware(requestContext));

  // CSRF double-submit cookie middleware. Skips Bearer-auth requests
  // (those are CORS-protected) and webhooks (signed by sender). See
  // common/csrf.middleware.ts for the full rationale.
  app.use(csrfMiddleware);

  // Security response headers. Only HSTS strictly matters here — Cloud Run
  // terminates TLS at the LB, so all production traffic is already HTTPS,
  // but HSTS tells browsers to refuse any future HTTP attempt for 1 year
  // (and to apply the same policy to all subdomains). Skipped in dev so
  // `http://localhost` keeps working.
  //
  // X-Frame-Options is DENY everywhere except `/storage/files/*`, which
  // serves user-uploaded PDFs and images that the FE embeds in an
  // <iframe>/<img> from a different origin (api.physioguidance.org vs
  // physioguidance.org). On those routes we use CSP frame-ancestors so
  // only the configured CORS origin can embed — keeps clickjacking
  // protection on JSON endpoints AND lets the attachment preview modal
  // render PDFs without `refused to connect`.
  const corsOriginForFrames = corsOrigin
    .split(',')
    .map((o: string) => o.trim())
    .filter(Boolean);
  app.use((req: any, res: any, next: any) => {
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const path: string = (req.originalUrl || req.url || '').split('?')[0];
    const isStorageFile = /\/storage\/files\//.test(path);
    if (isStorageFile) {
      const ancestors = corsOriginForFrames.length
        ? `'self' ${corsOriginForFrames.join(' ')}`
        : "'self'";
      res.setHeader(
        'Content-Security-Policy',
        `frame-ancestors ${ancestors}`,
      );
    } else {
      res.setHeader('X-Frame-Options', 'DENY');
    }

    next();
  });

  // Global exception filter — logs underlying cause for any unhandled error.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error for extra properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Start server
  await app.listen(port, '0.0.0.0');

  logger.log(`Application running on port ${port}`);
  logger.log(`Environment: ${configService.get('NODE_ENV', 'development')}`);
  logger.log(`API Prefix: /${apiPrefix}`);
  logger.log(`CORS Origin: ${corsOrigin}`);
}

bootstrap();
