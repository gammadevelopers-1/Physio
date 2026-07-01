/**
 * Sentry SDK init for the Edge runtime (middleware on Vercel-style edge,
 * edge route handlers). Loaded by instrumentation.ts → register().
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
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}
