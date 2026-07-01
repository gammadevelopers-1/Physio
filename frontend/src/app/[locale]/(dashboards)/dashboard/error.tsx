'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

const DASHBOARD_PATTERN = /\/dashboard\/([^/]+)/;

function detectDashboard(pathname: string | null): string {
  if (!pathname) return 'unknown';
  const match = pathname.match(DASHBOARD_PATTERN);
  return match?.[1] ?? 'unknown';
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const dashboard = detectDashboard(pathname);

  useEffect(() => {
    Sentry.withScope((scope) => {
      scope.setTag('component', 'dashboard');
      scope.setTag('dashboard', dashboard);
      scope.setTag('error_boundary', 'true');
      if (pathname) scope.setTag('pathname', pathname);
      if (error.digest) scope.setExtra('digest', error.digest);
      Sentry.captureException(error);
    });
  }, [error, dashboard, pathname]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-red-200/60 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>

        <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Something went wrong in this dashboard
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          The page hit an unexpected error. Our team has been notified and is
          looking into it. You can try again, or return to your dashboard home.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Try again
          </button>
          <a
            href={`/${dashboard !== 'unknown' ? `dashboard/${dashboard}` : ''}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to dashboard
          </a>
        </div>

        {error.digest ? (
          <p className="mt-6 break-all text-xs text-slate-400 dark:text-slate-600">
            Error ID: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
