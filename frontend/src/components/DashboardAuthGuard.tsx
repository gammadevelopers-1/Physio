'use client';

import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CsatPromptModal from '@/components/support-shared/CsatPromptModal';
import { SidebarBadgesProvider } from '@/contexts/SidebarBadgesContext';

// Maps each dashboard path segment to the roles allowed to access it
const DASHBOARD_ROLE_MAP: Record<string, string[]> = {
  admin: ['ADMIN', 'SUPER_ADMIN'],
  student: ['STUDENT'],
  instructor: ['INSTRUCTOR'],
  ta: ['TEACHING_ASSISTANT'],
  manager: ['MANAGER'],
  finance: ['FINANCE', 'ADMIN', 'SUPER_ADMIN'],
  support: ['SUPPORT'],
};

function extractDashboardSegment(pathname: string): string | null {
  // Matches /en/dashboard/admin, /ar/dashboard/student/courses, etc.
  const match = pathname.match(/\/dashboard\/([^/]+)/);
  return match ? match[1] : null;
}

export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const segment = extractDashboardSegment(pathname);
  const allowedRoles = segment ? DASHBOARD_ROLE_MAP[segment] : undefined;

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <SidebarBadgesProvider>
        {children}
        {/* Global CSAT nudge. Mounts behind the auth guard so the
            pending-survey fetch always has a valid session. Renders
            nothing when the queue is empty, so the cost on dashboards
            without pending feedback is one cached GET. */}
        <CsatPromptModal />
      </SidebarBadgesProvider>
    </ProtectedRoute>
  );
}
