import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { csrfMiddleware } from './common/csrf.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Get configuration
  const port = configService.get<number>('PORT', 8080);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  // Set global prefix
  app.setGlobalPrefix(apiPrefix);

  // Enable CORS
  app.enableCors({
    origin: corsOrigin.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true, // Important for cookies
  });

  // Cookie parser (for refresh tokens)
  app.use(cookieParser());

  // CSRF double-submit cookie middleware. Skips Bearer-auth requests
  // (those are CORS-protected) and webhooks (signed by sender). See
  // common/csrf.middleware.ts for the full rationale.
  app.use(csrfMiddleware);

  // Security response headers. Only HSTS strictly matters here — Cloud Run
  // terminates TLS at the LB, so all production traffic is already HTTPS,
  // but HSTS tells browsers to refuse any future HTTP attempt for 1 year
  // (and to apply the same policy to all subdomains). Skipped in dev so
  // `http://localhost` keeps working.
  app.use((_req: any, res: any, next: any) => {
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    // Always-on hardening headers (cheap; defense in depth)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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
