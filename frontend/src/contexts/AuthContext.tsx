'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { User } from '@/lib/api';

// ===========================================
// Types
// ===========================================
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// ===========================================
// Context
// ===========================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===========================================
// Role to Dashboard Path Mapping
// ===========================================
const ROLE_DASHBOARD_PATHS: Record<string, string> = {
  STUDENT: '/dashboard/student',
  INSTRUCTOR: '/dashboard/instructor',
  MANAGER: '/dashboard/manager',
  ADMIN: '/dashboard/admin',
  FINANCE: '/dashboard/finance',
  SUPPORT: '/dashboard/support',
  SUPER_ADMIN: '/dashboard/admin',
};

function getDashboardPath(role: string): string {
  return ROLE_DASHBOARD_PATHS[role] || '/dashboard/student';
}

// ===========================================
// Mock user for demo mode (no backend required)
// ===========================================
const MOCK_USER: User = {
  id: 'mock-user-1',
  email: 'demo@physioguidance.org',
  firstName: 'Demo',
  lastName: 'User',
  roles: ['ADMIN', 'STUDENT', 'INSTRUCTOR', 'MANAGER', 'FINANCE', 'SUPPORT'],
  activeRole: 'ADMIN',
  isActive: true,
  isVerified: true,
  createdAt: new Date().toISOString(),
};

// ===========================================
// Provider
// ===========================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const [state, setState] = useState<AuthState>({
    user: MOCK_USER,
    isLoading: false,
    isAuthenticated: true,
  });

  // Login (mock - no backend call)
  const login = useCallback(
    async (email: string, _password: string) => {
      setState({
        user: { ...MOCK_USER, email },
        isLoading: false,
        isAuthenticated: true,
      });
      const dashboardPath = getDashboardPath(MOCK_USER.activeRole);
      router.push(`/${locale}${dashboardPath}`);
    },
    [router, locale]
  );

  // Register (mock - no backend call)
  const register = useCallback(
    async (_data: RegisterData) => {
      router.push(`/${locale}/signin`);
    },
    [router, locale]
  );

  // Logout (mock - just redirect)
  const logout = useCallback(async () => {
    router.push(`/${locale}`);
  }, [router, locale]);

  // Switch Role (mock - just update local state)
  const switchRole = useCallback(
    async (role: string) => {
      setState((prev) => ({
        ...prev,
        user: prev.user ? { ...prev.user, activeRole: role } : null,
      }));
      const dashboardPath = getDashboardPath(role);
      router.push(`/${locale}${dashboardPath}`);
    },
    [router, locale]
  );

  // Refresh user data (mock - no-op)
  const refreshUser = useCallback(async () => {}, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        switchRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ===========================================
// Hook
// ===========================================
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ===========================================
// Helper Hooks
// ===========================================
export function useUser() {
  const { user } = useAuth();
  return user;
}

export function useIsAuthenticated() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

export function useActiveRole() {
  const { user } = useAuth();
  return user?.activeRole || null;
}

export function useUserRoles() {
  const { user } = useAuth();
  return user?.roles || [];
}

export function useHasMultipleRoles() {
  const roles = useUserRoles();
  return roles.length > 1;
}
