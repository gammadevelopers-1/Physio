'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  authApi,
  User,
  setAccessToken,
  getAccessToken,
  removeAccessToken,
  ApiError,
} from '@/lib/api';

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
// Provider
// ===========================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      try {
        const user = await authApi.me();
        setState({ user, isLoading: false, isAuthenticated: true });
      } catch (error) {
        // Token invalid or expired, try refresh
        try {
          const { accessToken } = await authApi.refresh();
          setAccessToken(accessToken);
          const user = await authApi.me();
          setState({ user, isLoading: false, isAuthenticated: true });
        } catch {
          // Refresh also failed, clear everything
          removeAccessToken();
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      }
    };

    initAuth();
  }, []);

  // Login
  const login = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const { user, accessToken } = await authApi.login({ email, password });
        setAccessToken(accessToken);
        setState({ user, isLoading: false, isAuthenticated: true });

        // Redirect to appropriate dashboard based on active role
        const dashboardPath = getDashboardPath(user.activeRole);
        router.push(`/${locale}${dashboardPath}`);
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [router, locale]
  );

  // Register
  const register = useCallback(
    async (data: RegisterData) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        await authApi.register(data);
        setState((prev) => ({ ...prev, isLoading: false }));
        // After registration, redirect to signin
        router.push(`/${locale}/signin`);
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [router, locale]
  );

  // Logout
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      removeAccessToken();
      setState({ user: null, isLoading: false, isAuthenticated: false });
      router.push(`/${locale}/signin`);
    }
  }, [router, locale]);

  // Switch Role
  const switchRole = useCallback(
    async (role: string) => {
      if (!state.user) return;

      // Check if user has this role
      if (!state.user.roles.includes(role)) {
        throw new Error(`You don't have the ${role} role`);
      }

      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const { accessToken, activeRole } = await authApi.switchRole(role);
        setAccessToken(accessToken);

        // Update user with new active role
        setState((prev) => ({
          ...prev,
          user: prev.user ? { ...prev.user, activeRole } : null,
          isLoading: false,
        }));

        // Redirect to new dashboard
        const dashboardPath = getDashboardPath(activeRole);
        router.push(`/${locale}${dashboardPath}`);
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [state.user, router, locale]
  );

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState((prev) => ({ ...prev, user }));
    } catch {
      // If refresh fails, logout
      removeAccessToken();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

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
