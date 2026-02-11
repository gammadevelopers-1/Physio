'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { authApi, setAccessToken, removeAccessToken } from '@/lib/api';
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
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
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

// Session cookie helpers — used by Next.js middleware to gate protected routes.
// This is NOT a security token; actual auth is validated via JWT + httpOnly refresh cookie.
function setSessionCookie() {
  document.cookie = 'session=active; path=/; max-age=604800; SameSite=Lax';
}

function clearSessionCookie() {
  document.cookie = 'session=; path=/; max-age=0; SameSite=Lax';
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
  const initAttempted = useRef(false);

  // On mount: try to restore session via refresh token cookie
  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const initAuth = async () => {
      try {
        // Attempt token refresh via httpOnly cookie
        const refreshResponse = await authApi.refresh();
        setAccessToken(refreshResponse.accessToken);

        // Fetch full user profile
        const user = await authApi.me();
        setSessionCookie();
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch {
        // No valid session — user is not logged in
        removeAccessToken();
        clearSessionCookie();
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    initAuth();
  }, []);

  // Login
  const login = useCallback(
    async (email: string, password: string, redirectTo?: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const response = await authApi.login({ email, password });
        setAccessToken(response.accessToken);

        // Fetch full user data (login response may have partial data)
        let user = response.user as User;
        try {
          user = await authApi.me();
        } catch {
          // Use login response data as fallback
        }

        setSessionCookie();
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });

        const displayName = user.firstName || user.email;
        toast.success(`Welcome back, ${displayName}!`);

        const dashboardPath = getDashboardPath(user.activeRole);
        let targetPath = `/${locale}${dashboardPath}`;

        if (redirectTo) {
          // If the redirect points to a dashboard, only use it if it matches the user's role
          const dashboardMatch = redirectTo.match(/\/dashboard\/(\w+)/);
          if (dashboardMatch) {
            const redirectDashboard = dashboardMatch[1];
            const userDashboard = dashboardPath.split('/').pop();
            if (redirectDashboard === userDashboard) {
              targetPath = redirectTo;
            }
            // Otherwise ignore the stale redirect — go to correct dashboard
          } else {
            // Non-dashboard redirect (e.g. /profile), use as-is
            targetPath = redirectTo;
          }
        }

        router.push(targetPath);
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [router, locale]
  );

  // Register
  const register = useCallback(async (data: RegisterData) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await authApi.register({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      setState((prev) => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if backend call fails, clear local state
    }
    removeAccessToken();
    clearSessionCookie();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    toast.success('Signed out successfully');
    router.push(`/${locale}/signin`);
  }, [router, locale]);

  // Switch Role
  const switchRole = useCallback(
    async (role: string) => {
      try {
        const response = await authApi.switchRole(role);
        setAccessToken(response.accessToken);

        setState((prev) => ({
          ...prev,
          user: prev.user
            ? { ...prev.user, activeRole: response.activeRole }
            : null,
        }));

        const roleName = response.activeRole.charAt(0) + response.activeRole.slice(1).toLowerCase();
        toast.success(`Switched to ${roleName} dashboard`);

        const dashboardPath = getDashboardPath(response.activeRole);
        router.push(`/${locale}${dashboardPath}`);
      } catch (error) {
        throw error;
      }
    },
    [router, locale]
  );

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState((prev) => ({
        ...prev,
        user,
        isAuthenticated: true,
      }));
    } catch {
      // Silent fail — the 401 interceptor handles token refresh
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
