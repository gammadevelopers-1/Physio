// ===========================================
// API Client - Fetch wrapper for backend calls
// ===========================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';

// ===========================================
// Token Management
// ===========================================
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function removeAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// ===========================================
// API Error Class
// ===========================================
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errors?: string[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ===========================================
// Fetch Wrapper
// ===========================================
interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, headers: customHeaders, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Add auth token if available and not skipped
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Important for cookies (refresh token)
  });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(response.status, 'An error occurred');
    }
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message[0]
      : data.message || 'An error occurred';
    throw new ApiError(response.status, message, Array.isArray(data.message) ? data.message : undefined);
  }

  return data;
}

// ===========================================
// API Methods
// ===========================================
export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),
};

// ===========================================
// Auth API Types
// ===========================================
export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone?: string | null;
  avatar?: string | null;
  activeRole: string;
  roles: string[];
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

export interface SwitchRoleResponse {
  accessToken: string;
  activeRole: string;
}

// ===========================================
// Auth API Calls
// ===========================================
export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => api.post<RegisterResponse>('/auth/register', data, { skipAuth: true }),

  login: (data: { email: string; password: string }) =>
    api.post<LoginResponse>('/auth/login', data, { skipAuth: true }),

  logout: () => api.post<{ message: string }>('/auth/logout'),

  refresh: () => api.post<{ accessToken: string }>('/auth/refresh', undefined, { skipAuth: true }),

  me: () => api.get<User>('/auth/me'),

  switchRole: (role: string) =>
    api.post<SwitchRoleResponse>('/auth/switch-role', { role }),

  logoutAll: () => api.post<{ message: string }>('/auth/logout-all'),
};

// ===========================================
// Admin API Calls
// ===========================================
export const adminApi = {
  // Get all users (ADMIN/SUPER_ADMIN only)
  getUsers: () => api.get<User[]>('/auth/users'),

  // Get a user's roles
  getUserRoles: (userId: string) =>
    api.get<{ userId: string; roles: string[] }>(`/auth/users/${userId}/roles`),

  // Assign a role to a user
  assignRole: (userId: string, role: string) =>
    api.post<{ message: string; roles: string[] }>(`/auth/users/${userId}/roles`, { role }),

  // Remove a role from a user
  removeRole: (userId: string, role: string) =>
    api.delete<{ message: string; roles: string[] }>(`/auth/users/${userId}/roles/${role}`),
};

export default api;
