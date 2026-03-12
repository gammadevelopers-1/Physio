'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts';
import { Loader2 } from 'lucide-react';

// Role to dashboard path mapping (must stay in sync with AuthContext)
const ROLE_DASHBOARD_PATHS: Record<string, string> = {
  STUDENT: '/dashboard/student',
  INSTRUCTOR: '/dashboard/instructor',
  TEACHING_ASSISTANT: '/dashboard/teaching-assistant',
  MANAGER: '/dashboard/manager',
  ADMIN: '/dashboard/admin',
  FINANCE: '/dashboard/finance',
  SUPPORT: '/dashboard/support',
  SUPER_ADMIN: '/dashboard/admin',
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated → redirect to sign-in with return URL
    if (!isAuthenticated) {
      const redirectUrl = encodeURIComponent(pathname);
      router.replace(`/${locale}/signin?redirect=${redirectUrl}`);
      return;
    }

    // Authenticated but wrong role → redirect to their own dashboard
    if (allowedRoles && user) {
      const hasAccess = allowedRoles.some((role) => user.roles.includes(role));
      if (!hasAccess) {
        const correctPath = ROLE_DASHBOARD_PATHS[user.activeRole] || '/dashboard/student';
        router.replace(`/${locale}${correctPath}`);
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router, locale, pathname]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" role="status" aria-label="Loading">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#a37f49]" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — will redirect via useEffect
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated but wrong role — will redirect via useEffect
  if (allowedRoles && user) {
    const hasAccess = allowedRoles.some((role) => user.roles.includes(role));
    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
