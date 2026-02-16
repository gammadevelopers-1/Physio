// ===========================================
// API Client - Fetch wrapper for backend calls
// ===========================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

// ===========================================
// In-Memory Token Storage (OWASP compliant)
// ===========================================
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function removeAccessToken(): void {
  accessToken = null;
}

// ===========================================
// Device ID Cookie (persistent, 1 year)
// Used for 2FA device trust fingerprinting
// ===========================================
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDeviceId(): string {
  if (typeof document === 'undefined') return '';

  const match = document.cookie.match(/(?:^|; )device_id=([^;]*)/);
  if (match) return match[1];

  // Generate and persist a new device ID
  const deviceId = generateUUID();
  const maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
  document.cookie = `device_id=${deviceId}; path=/; max-age=${maxAge}; SameSite=Lax`;
  return deviceId;
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
// Fetch Wrapper with 401 Interceptor
// ===========================================
interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  _isRetry?: boolean;
}

// Refresh state management
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

function processQueue(error: Error | null, token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else if (token) {
      resolve(token);
    }
  });
  refreshQueue = [];
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth = false, _isRetry = false, headers: customHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  // Add auth token if available and not skipped
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Always send device ID for 2FA device fingerprinting
  const deviceId = getDeviceId();
  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include', // Important for httpOnly refresh cookie
  });

  // Handle 401 - attempt token refresh once
  if (response.status === 401 && !skipAuth && !_isRetry) {
    if (isRefreshing) {
      // Another refresh is in-flight; queue this request
      return new Promise<T>((resolve, reject) => {
        refreshQueue.push({
          resolve: (newToken: string) => {
            headers['Authorization'] = `Bearer ${newToken}`;
            fetchApi<T>(endpoint, { ...options, _isRetry: true })
              .then(resolve)
              .catch(reject);
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!refreshResponse.ok) {
        throw new Error('Refresh failed');
      }

      const data = await refreshResponse.json();
      setAccessToken(data.accessToken);
      processQueue(null, data.accessToken);

      // Retry original request with new token
      headers['Authorization'] = `Bearer ${data.accessToken}`;
      return fetchApi<T>(endpoint, { ...options, _isRetry: true });
    } catch (refreshError) {
      processQueue(refreshError as Error, null);
      removeAccessToken();
      throw new ApiError(401, 'Session expired. Please log in again.');
    } finally {
      isRefreshing = false;
    }
  }

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
  lastLoginIp?: string | null;
  createdAt: string;
}

export interface LoginResponse {
  user?: User;
  accessToken?: string;
  requiresTwoFactor?: boolean;
  challengeId?: string;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

export interface SwitchRoleResponse {
  accessToken: string;
  activeRole: string;
}

export interface Verify2FAResponse {
  user: User;
  accessToken: string;
}

export interface TrustedDevice {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  lastUsedAt: string;
  createdAt: string;
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

  // 2FA
  verify2FA: (challengeId: string, code: string) =>
    api.post<Verify2FAResponse>('/auth/verify-2fa', { challengeId, code }, { skipAuth: true }),

  resend2FA: (challengeId: string) =>
    api.post<{ challengeId: string }>('/auth/resend-2fa', { challengeId }, { skipAuth: true }),

  // Trusted Devices
  getTrustedDevices: () => api.get<TrustedDevice[]>('/auth/trusted-devices'),

  revokeDevice: (deviceId: string) =>
    api.delete<{ message: string }>(`/auth/trusted-devices/${deviceId}`),

  revokeAllDevices: () =>
    api.delete<{ message: string }>('/auth/trusted-devices'),

  // 2FA Settings
  get2FAStatus: () => api.get<{ twoFactorEnabled: boolean }>('/auth/2fa/status'),

  toggle2FA: (enabled: boolean) =>
    api.post<{ twoFactorEnabled: boolean }>('/auth/2fa/toggle', { enabled }),
};

// ===========================================
// Admin API Types
// ===========================================
export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
  isVerified?: boolean;
  activeRole?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UserStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
}

export interface PaginatedUsersResponse {
  data: User[];
  meta: PaginationMeta;
  stats: UserStats;
}

// ===========================================
// Admin API Calls
// ===========================================
export const adminApi = {
  // Get all users (ADMIN/SUPER_ADMIN only)
  getUsers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.role) searchParams.set('role', params.role);
    if (params?.status) searchParams.set('status', params.status);
    const queryString = searchParams.toString();
    return api.get<PaginatedUsersResponse>(`/auth/users${queryString ? `?${queryString}` : ''}`);
  },

  // Get a user's roles
  getUserRoles: (userId: string) =>
    api.get<{ userId: string; roles: string[] }>(`/auth/users/${userId}/roles`),

  // Assign a role to a user
  assignRole: (userId: string, role: string) =>
    api.post<{ message: string; roles: string[] }>(`/auth/users/${userId}/roles`, { role }),

  // Remove a role from a user
  removeRole: (userId: string, role: string) =>
    api.delete<{ message: string; roles: string[] }>(`/auth/users/${userId}/roles/${role}`),

  // Create a new user (admin only)
  createUser: (data: CreateUserData) =>
    api.post<User>('/auth/users', data),

  // Update user details (admin only)
  updateUser: (userId: string, data: UpdateUserData) =>
    api.patch<User>(`/auth/users/${userId}`, data),

  // Delete a user (admin only)
  deleteUser: (userId: string) =>
    api.delete<{ message: string }>(`/auth/users/${userId}`),

  // Get all roles with user counts (admin only)
  getRoles: () =>
    api.get<RoleWithCount[]>('/auth/roles'),

  // Create a new role (admin only)
  createRole: (data: { name: string; displayName: string; description?: string }) =>
    api.post<RoleWithCount>('/auth/roles', data),

  // Update role details (admin only)
  updateRole: (roleId: string, data: { displayName?: string; description?: string }) =>
    api.patch<{ id: string; name: string; displayName: string; description: string | null }>(`/auth/roles/${roleId}`, data),

  // Delete a role (admin only)
  deleteRole: (roleId: string) =>
    api.delete<{ message: string }>(`/auth/roles/${roleId}`),

  // Trusted Device Management (admin only)
  getUserTrustedDevices: (userId: string) =>
    api.get<TrustedDevice[]>(`/auth/users/${userId}/trusted-devices`),

  revokeUserDevice: (userId: string, deviceId: string) =>
    api.delete<{ message: string }>(`/auth/users/${userId}/trusted-devices/${deviceId}`),

  revokeAllUserDevices: (userId: string) =>
    api.delete<{ message: string }>(`/auth/users/${userId}/trusted-devices`),
};

export interface RoleWithCount {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  createdAt: string;
  usersCount: number;
}

// ===========================================
// Role Request Types
// ===========================================
export interface RoleRequest {
  id: string;
  userId: string;
  requestedRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_INFO';
  profileData: Record<string, unknown>;
  bankData: Record<string, unknown> | null;
  resumeFiles: Array<{ type: string; url: string; filename: string }> | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar?: string | null;
  };
}

export interface RoleRequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface PaginatedRoleRequestsResponse {
  data: RoleRequest[];
  meta: PaginationMeta;
  stats: RoleRequestStats;
}

// ===========================================
// Role Requests API
// ===========================================
export const roleRequestsApi = {
  // Submit new application (student)
  submit: (data: {
    requestedRole: string;
    profileData: Record<string, unknown>;
    bankData?: Record<string, unknown>;
    resumeFiles?: Array<{ type: string; url: string; filename: string }>;
  }) => api.post<RoleRequest>('/role-requests', data),

  // Get my applications
  getMine: () => api.get<RoleRequest[]>('/role-requests/mine'),

  // Get all applications (admin)
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    const queryString = searchParams.toString();
    return api.get<PaginatedRoleRequestsResponse>(
      `/role-requests${queryString ? `?${queryString}` : ''}`
    );
  },

  // Get single application (admin)
  getById: (id: string) => api.get<RoleRequest>(`/role-requests/${id}`),

  // Approve application (admin)
  approve: (id: string, note?: string) =>
    api.patch<{ message: string }>(`/role-requests/${id}/approve`, { reviewNote: note }),

  // Reject application (admin)
  reject: (id: string, reviewNote: string) =>
    api.patch<{ message: string }>(`/role-requests/${id}/reject`, { reviewNote }),

  // Request more info (admin)
  requestInfo: (id: string, reviewNote: string) =>
    api.patch<{ message: string }>(`/role-requests/${id}/request-info`, { reviewNote }),

  // Resubmit application (student)
  resubmit: (id: string, data: {
    requestedRole: string;
    profileData: Record<string, unknown>;
    bankData?: Record<string, unknown>;
    resumeFiles?: Array<{ type: string; url: string; filename: string }>;
  }) => api.patch<{ message: string }>(`/role-requests/${id}`, data),

  // Reject with block (admin)
  rejectAndBlock: (id: string, reviewNote: string) =>
    api.patch<{ message: string }>(`/role-requests/${id}/reject`, {
      reviewNote,
      blockNationalId: true,
    }),
};

// ===========================================
// Admin Notifications API
// ===========================================
export interface AdminNotification {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  // Get notifications
  getAll: (params?: { limit?: number; unreadOnly?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.unreadOnly) searchParams.set('unreadOnly', 'true');
    const qs = searchParams.toString();
    return api.get<{ data: AdminNotification[]; unreadCount: number }>(
      `/notifications${qs ? `?${qs}` : ''}`
    );
  },

  // Mark one as read
  markAsRead: (id: string) =>
    api.patch<{ message: string }>(`/notifications/${id}/read`, {}),

  // Mark all as read
  markAllAsRead: () =>
    api.patch<{ message: string }>('/notifications/read-all', {}),
};

export default api;
