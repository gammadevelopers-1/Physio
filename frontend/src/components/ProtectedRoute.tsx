'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/${locale}/signin`);
    }
  }, [isLoading, isAuthenticated, router, locale]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#a37f49]" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Check role access if allowedRoles is specified
  if (allowedRoles && user) {
    const hasAccess = allowedRoles.some((role) => user.roles.includes(role));
    if (!hasAccess) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">
              You don&apos;t have permission to access this page.
            </p>
            <p className="text-sm text-gray-500">
              Required roles: {allowedRoles.join(', ')}
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
