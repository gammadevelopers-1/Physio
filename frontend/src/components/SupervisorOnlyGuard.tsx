'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts';
import { Loader2 } from 'lucide-react';

/**
 * Sub-role guard for support dashboard supervisor-only routes.
 *
 * The parent DashboardAuthGuard already restricts /dashboard/support
 * to the SUPPORT role, but it does NOT distinguish between supervisors
 * and agents — both can hit any URL under /dashboard/support/supervisor/*
 * unless we check the sub-role here. This guard redirects non-supervisor
 * support users to the agent dashboard so they can't see Team, Reports,
 * supervisor-only Tickets, or the SLA/Macros/Escalation settings tabs.
 *
 * SUPER_ADMIN / ADMIN users do not have a supportSubRole — they're not
 * routed into the support dashboard at all by DashboardAuthGuard.
 */
export function SupervisorOnlyGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  const isSupervisor = user?.supportSubRole === 'supervisor';

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return; // outer ProtectedRoute handles signin redirect
    if (!isSupervisor) {
      router.replace(`/${locale}/dashboard/support/agent`);
    }
  }, [isLoading, isAuthenticated, isSupervisor, router, locale]);

  if (isLoading || !isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[var(--color-surface-page)]"
        role="status"
        aria-label="Loading"
      >
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  // Non-supervisor — will redirect via useEffect
  if (!isSupervisor) return null;

  return <>{children}</>;
}

export default SupervisorOnlyGuard;
