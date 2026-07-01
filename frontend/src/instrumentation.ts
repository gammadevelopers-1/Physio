/**
 * Next.js server-side instrumentation hook.
 *
 * Runs once when the Node.js or Edge runtime boots. Sentry SDK init is
 * deferred into the matching runtime config file so each runtime only
 * loads code it can actually run.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
