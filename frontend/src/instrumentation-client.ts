/**
 * Sentry browser SDK init.
 *
 * Next.js 16 picks this file up automatically on the client side.
 * Loaded once on page hydration, before any user code runs.
 *
 * Disabled in development to keep the 5K-events/month free tier clean.
 */

import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './lib/sentry/scrub';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const env =
  process.env.NEXT_PUBLIC_APP_ENV ||
  process.env.NODE_ENV ||
  'development';

if (dsn) {
  Sentry.init({
    dsn,
    environment: env,
    enabled: env === 'production' || env === 'staging',

    tracesSampleRate: env === 'production' ? 0.1 : 1.0,

    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    sendDefaultPii: false,

    beforeSend: scrubEvent,

    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      /Loading chunk \d+ failed/,
      /ChunkLoadError/,
      'NetworkError when attempting to fetch resource',
      /AbortError: The user aborted a request/,
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
