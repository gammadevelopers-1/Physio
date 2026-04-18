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
import { useLocale, useTranslations } from 'next-intl';
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

interface TwoFactorPending {
  challengeId: string;
  email: string;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
  verify2FA: (challengeId: string, code: string, redirectTo?: string) => Promise<void>;
  resend2FA: (challengeId: string) => Promise<{ challengeId: string }>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  twoFactorPending: TwoFactorPending | null;
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  scfhsNumber?: string;
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
  TEACHING_ASSISTANT: '/dashboard/teaching-assistant',
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
  const t = useTranslations('toasts');
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const [twoFactorPending, setTwoFactorPending] = useState<TwoFactorPending | null>(null);
  const initAttempted = useRef(false);

  // On mount: try to restore session via refresh token cookie
  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const initAuth = async () => {
      try {
        const refreshResponse = await authApi.refresh();
        setAccessToken(refreshResponse.accessToken);

        const user = await authApi.me();
        setSessionCookie();
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });
      } catch {
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

  // Login — may return user tokens OR trigger 2FA
  const login = useCallback(
    async (email: string, password: string, redirectTo?: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const response = await authApi.login({ email, password });

        // 2FA required — redirect to verification page
        if (response.requiresTwoFactor && response.challengeId) {
          setTwoFactorPending({
            challengeId: response.challengeId,
            email,
          });
          setState((prev) => ({ ...prev, isLoading: false }));

          // Navigate to the OTP verification page
          const params = new URLSearchParams({
            challengeId: response.challengeId,
          });
          if (redirectTo) {
            params.set('redirect', redirectTo);
          }
          router.push(`/${locale}/signin/verify?${params.toString()}`);
          return;
        }

        // No 2FA — normal login flow
        if (response.accessToken) {
          setAccessToken(response.accessToken);
        }

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
        toast.success(t('welcomeBack', { name: displayName }));

        const dashboardPath = getDashboardPath(user.activeRole);
        let targetPath = `/${locale}${dashboardPath}`;

        if (redirectTo) {
          const dashboardMatch = redirectTo.match(/\/dashboard\/(\w+)/);
          if (dashboardMatch) {
            const redirectDashboard = dashboardMatch[1];
            const userDashboard = dashboardPath.split('/').pop();
            if (redirectDashboard === userDashboard) {
              targetPath = redirectTo;
            }
          } else {
            targetPath = redirectTo;
          }
        }

        router.push(targetPath);
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [router, locale, t],
  );

  // Verify 2FA OTP — called from the verification page
  const verify2FA = useCallback(
    async (challengeId: string, code: string, redirectTo?: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const response = await authApi.verify2FA(challengeId, code);

        setAccessToken(response.accessToken);

        let user = response.user as User;
        try {
          user = await authApi.me();
        } catch {
          // Use verify response data as fallback
        }

        setSessionCookie();
        setTwoFactorPending(null);
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });

        const displayName = user.firstName || user.email;
        toast.success(t('welcomeBack', { name: displayName }));

        // Navigate to redirect target or user's correct dashboard
        const dashboardPath = getDashboardPath(user.activeRole);
        let targetPath = `/${locale}${dashboardPath}`;

        if (redirectTo) {
          const dashboardMatch = redirectTo.match(/\/dashboard\/(\w+)/);
          if (dashboardMatch) {
            const redirectDashboard = dashboardMatch[1];
            const userDashboard = dashboardPath.split('/').pop();
            if (redirectDashboard === userDashboard) {
              targetPath = redirectTo;
            }
          } else {
            targetPath = redirectTo;
          }
        }

        router.push(targetPath);
      } catch (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        throw error;
      }
    },
    [router, locale, t],
  );

  // Resend 2FA OTP
  const resend2FA = useCallback(async (challengeId: string) => {
    const response = await authApi.resend2FA(challengeId);
    if (response.challengeId) {
      setTwoFactorPending((prev) =>
        prev ? { ...prev, challengeId: response.challengeId } : null,
      );
    }
    return response;
  }, []);

  // Register
  const register = useCallback(async (data: RegisterData) => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      await authApi.register({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        ...(data.scfhsNumber && { scfhsNumber: data.scfhsNumber }),
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
    setTwoFactorPending(null);
    setState({ user: null, isLoading: false, isAuthenticated: false });
    toast.success(t('signedOut'));
    router.push(`/${locale}/signin`);
  }, [router, locale, t]);

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

        const roleKeyMap: Record<string, string> = {
          STUDENT: 'roleStudent',
          INSTRUCTOR: 'roleInstructor',
          TEACHING_ASSISTANT: 'roleTA',
          MANAGER: 'roleManager',
          ADMIN: 'roleAdmin',
          SUPER_ADMIN: 'roleAdmin',
        };
        const roleKey = roleKeyMap[response.activeRole];
        const localizedRoleName = roleKey
          ? t(roleKey)
          : response.activeRole.charAt(0) +
            response.activeRole.slice(1).toLowerCase();
        toast.success(t('switchedToDashboard', { role: localizedRoleName }));

        const dashboardPath = getDashboardPath(response.activeRole);
        router.push(`/${locale}${dashboardPath}`);
      } catch (error) {
        throw error;
      }
    },
    [router, locale, t],
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
        verify2FA,
        resend2FA,
        register,
        logout,
        switchRole,
        refreshUser,
        twoFactorPending,
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
