'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', fontWeight: 700, lineHeight: 1 }}>
            500
          </div>
          <h1 style={{ fontSize: '1.5rem', marginTop: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: '0.75rem', color: '#cbd5e1' }}>
            An unexpected error occurred. Our team has been notified
            automatically. Please try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#0f172a',
              backgroundColor: '#f8fafc',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: '1.5rem',
                fontSize: '0.75rem',
                color: '#64748b',
              }}
            >
              Error ID: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
