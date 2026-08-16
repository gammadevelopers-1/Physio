import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// MUST be imported before any other module (including AppModule).
// Sentry patches runtime globals for auto-instrumentation to work; if
// this file loads after Nest starts, http/db spans and unhandled
// rejections silently miss the SDK.
//
// A missing DSN makes Sentry a no-op (init runs, no events sent) —
// safe to deploy without SENTRY_DSN set until the backend Sentry
// project is created.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    integrations: [nodeProfilingIntegration()],
    // Cloud SQL public-IP connections use client-side SSL only. Drop
    // noise from expected pool churn to keep the error budget clean.
    ignoreErrors: [
      /Connection terminated due to connection timeout/i,
    ],
  });
}
