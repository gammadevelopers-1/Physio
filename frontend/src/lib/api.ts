// ===========================================
// API Client - Fetch wrapper for backend calls
// ===========================================

import * as Sentry from '@sentry/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

/**
 * Report a failed API call to Sentry. We deliberately skip 4xx because those
 * are usually user-facing validation errors, not bugs — flooding Sentry with
 * "400: invalid email" events would burn through the free tier. 5xx and
 * network failures are real reliability signals.
 */
function reportApiFailure(
  endpoint: string,
  method: string,
  err: unknown,
  status?: number,
): void {
  if (status && status >= 400 && status < 500) return;
  Sentry.withScope((scope) => {
    scope.setTag('component', 'api_client');
    scope.setTag('http_method', method.toUpperCase());
    scope.setTag('endpoint', endpoint);
    if (status) scope.setTag('http_status', String(status));
    scope.setLevel('error');
    Sentry.captureException(err);
  });
}

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
  public code?: string;
  public meta?: Record<string, unknown>;

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
  /** Internal: incremented on each transient-failure retry. */
  _attempt?: number;
  /** Disable the transient-error retry for this request (default: enabled for GET). */
  noRetry?: boolean;
}

// Transient-error retry config
const MAX_RETRIES = 2;
const RETRY_STATUSES = new Set([500, 502, 503, 504]);

function retryDelayMs(attempt: number): number {
  // Jittered exponential-ish backoff: ~200ms then ~600ms.
  const base = attempt === 0 ? 200 : 600;
  return base + Math.floor(Math.random() * 200);
}

function isRetryableMethod(method: string | undefined): boolean {
  const m = (method || 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
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

/**
 * Single canonical token-refresh path. AuthContext.initAuth and fetchApi's
 * 401 auto-refresh both go through this so the underlying /auth/refresh
 * call never races with itself. Without this, both code paths fire on a
 * fresh page load, the HTTP-only refresh cookie rotates after the first
 * response, and the loser sees "Session expired" even though the user is
 * actually signed in.
 */
export async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      refreshQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Refresh failed');
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    processQueue(null, data.accessToken);
    return data.accessToken;
  } catch (err) {
    processQueue(err as Error, null);
    removeAccessToken();
    throw err;
  } finally {
    isRefreshing = false;
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    skipAuth = false,
    _isRetry = false,
    _attempt = 0,
    noRetry = false,
    headers: customHeaders,
    ...fetchOptions
  } = options;

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

  // Transient-error retry: idempotent methods only, capped by MAX_RETRIES.
  const canRetry =
    !noRetry && isRetryableMethod(fetchOptions.method) && _attempt < MAX_RETRIES;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include', // Important for httpOnly refresh cookie
    });
  } catch (networkErr) {
    // Network failure (DNS, connection refused, abort). Retry if eligible.
    if (canRetry) {
      await new Promise((r) => setTimeout(r, retryDelayMs(_attempt)));
      return fetchApi<T>(endpoint, { ...options, _attempt: _attempt + 1 });
    }
    reportApiFailure(endpoint, fetchOptions.method || 'GET', networkErr);
    throw networkErr;
  }

  // Transient server errors — retry once or twice with jittered backoff.
  if (canRetry && RETRY_STATUSES.has(response.status)) {
    await new Promise((r) => setTimeout(r, retryDelayMs(_attempt)));
    return fetchApi<T>(endpoint, { ...options, _attempt: _attempt + 1 });
  }

  // Handle 401 - attempt token refresh once via the shared canonical path
  // (queues onto any in-flight refresh, so AuthContext's mount-time refresh
  // and any concurrent 401 retries all share the same /auth/refresh call).
  if (response.status === 401 && !skipAuth && !_isRetry) {
    try {
      await refreshAccessToken();
      return fetchApi<T>(endpoint, { ...options, _isRetry: true });
    } catch {
      throw new ApiError(401, 'Session expired. Please log in again.');
    }
  }

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    if (!response.ok) {
      // Try to read response text for a more descriptive error
      try {
        const text = await response.text();
        // NestJS sometimes returns JSON without proper content-type header
        try {
          const parsed = JSON.parse(text);
          const msg = Array.isArray(parsed.message) ? parsed.message[0] : parsed.message;
          if (msg) throw new ApiError(response.status, msg);
        } catch (parseErr) {
          if (parseErr instanceof ApiError) throw parseErr;
        }
        if (text) throw new ApiError(response.status, text.slice(0, 200));
      } catch (readErr) {
        if (readErr instanceof ApiError) throw readErr;
      }
      const fallbackErr = new ApiError(
        response.status,
        `Request failed with status ${response.status}`,
      );
      reportApiFailure(
        endpoint,
        fetchOptions.method || 'GET',
        fallbackErr,
        response.status,
      );
      throw fallbackErr;
    }
    return {} as T;
  }

  const data = await response.json();

  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message[0]
      : data.message || 'An error occurred';
    const err = new ApiError(response.status, message, Array.isArray(data.message) ? data.message : undefined);
    if (typeof data.code === 'string') err.code = data.code;
    if (data.meta && typeof data.meta === 'object') err.meta = data.meta;
    reportApiFailure(endpoint, fetchOptions.method || 'GET', err, response.status);
    throw err;
  }

  return data;
}

// ===========================================
// Shared types
// ===========================================

// Single row of the support audit trail. Used by both the admin
// overview tab and the supervisor alerts page (same endpoint shape).
// The action union covers user-initiated rows in audit_logs and
// system-generated rows in sla_events (prefixed `sla_`).
export type AuditTrailEntry = {
  id: string;
  action:
    | 'ticket_created'
    | 'ticket_replied'
    | 'internal_note_added'
    | 'assignee_changed'
    | 'priority_changed'
    | 'status_changed'
    | 'ticket_resolved'
    | 'ticket_closed'
    | 'ticket_reopened'
    | 'sla_frt_breach'
    | 'sla_ttr_breach'
    | 'sla_frt_warning_75'
    | 'sla_priority_escalated'
    | 'sla_escalation_triggered'
    | 'sla_frt_breach_reassigned'
    | 'sla_ttr_breach_reassigned'
    | 'sla_resolved_within_sla';
  ticketId: string;
  ticketReferenceNumber: string | null;
  ticketSubject: string | null;
  performerId: string | null;
  performerName: string | null;
  performerRole:
    | 'super_admin'
    | 'admin'
    | 'supervisor'
    | 'agent'
    | 'student'
    | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// ===========================================
// FormData Upload (multipart/form-data)
// ===========================================

/**
 * Structured error thrown by the XHR upload helpers below. UI catch
 * blocks can look at `code` to pick a localized message with args,
 * instead of showing a generic "Upload failed" for every failure
 * mode.
 *
 *   status         HTTP status ('network' if the request never got a response)
 *   code           One of a short, stable set the UI knows about
 *   serverMessage  Best-effort human-readable message from the server
 *   sizeMB/limitMB Populated when code === 'too_large'
 */
export type UploadErrorCode =
  | 'too_large'
  | 'unsupported_type'
  | 'unauthorized'
  | 'forbidden'
  | 'processing'
  | 'network'
  | 'server';

export class UploadError extends Error {
  readonly status: number | 'network';
  readonly code: UploadErrorCode;
  readonly serverMessage: string | null;
  readonly sizeMB?: number;
  readonly limitMB?: number;

  constructor(params: {
    status: number | 'network';
    code: UploadErrorCode;
    serverMessage: string | null;
    sizeMB?: number;
    limitMB?: number;
  }) {
    super(params.serverMessage ?? `Upload failed (${params.code})`);
    this.name = 'UploadError';
    this.status = params.status;
    this.code = params.code;
    this.serverMessage = params.serverMessage;
    this.sizeMB = params.sizeMB;
    this.limitMB = params.limitMB;
  }
}

/**
 * Parse an XHR response into an UploadError. Handles both JSON bodies
 * from Nest (`{statusCode, message, error}`) and raw strings.
 */
function parseUploadError(status: number, responseText: string): UploadError {
  let serverMessage: string | null = null;
  try {
    const body = JSON.parse(responseText);
    if (typeof body?.message === 'string') serverMessage = body.message;
    else if (Array.isArray(body?.message)) serverMessage = body.message.join('; ');
  } catch {
    if (responseText && responseText.length < 500) serverMessage = responseText;
  }

  // Extract "X MB exceeds Y MB" numbers from the server message if
  // present — matches the format materials.service.ts emits.
  let sizeMB: number | undefined;
  let limitMB: number | undefined;
  const m = serverMessage?.match(/([0-9.]+)\s*MB\s*exceeds\s*(?:the\s*)?([0-9.]+)\s*MB/i);
  if (m) {
    sizeMB = Math.round(parseFloat(m[1]));
    limitMB = Math.round(parseFloat(m[2]));
  }

  let code: UploadErrorCode;
  if (status === 413) code = 'too_large';
  else if (status === 415) code = 'unsupported_type';
  else if (status === 400 && /mime type|not allowed/i.test(serverMessage ?? '')) code = 'unsupported_type';
  else if (status === 400 && /size.*exceeds/i.test(serverMessage ?? '')) code = 'too_large';
  else if (status === 401) code = 'unauthorized';
  else if (status === 403) code = 'forbidden';
  else if (status === 409) code = 'processing';
  else code = 'server';

  return new UploadError({ status, code, serverMessage, sizeMB, limitMB });
}

export async function uploadFormData<T>(
  endpoint: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const deviceId = getDeviceId();
  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
  }
  // Do NOT set Content-Type — browser sets multipart boundary automatically

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: formData,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(response.status, 'Upload failed');
    }
    return {} as T;
  }

  const data = await response.json();
  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message[0]
      : data.message || 'Upload failed';
    throw new ApiError(response.status, message);
  }
  return data;
}

// ===========================================
// Blob Fetch Helpers (for file downloads)
// ===========================================
async function fetchBlob(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Blob> {
  const { skipAuth = false, headers: customHeaders, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const deviceId = getDeviceId();
  if (deviceId) headers['X-Device-Id'] = deviceId;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiError(response.status, `Download failed (${response.status})`);
  }

  return response.blob();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  delete: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

// ===========================================
// Auth API Types
// ===========================================
export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  phone?: string | null;
  avatar?: string | null;
  activeRole: string;
  department?: string | null;
  bio?: string | null;
  scfhsNumber?: string | null;
  nationalId?: string | null;
  nationality?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  // Trainer-application fields — seeded from role_requests.profileData on
  // approval. Used to pre-fill the instructor settings Professional Info
  // block on first login.
  specialty?: string | null;
  profession?: string | null;
  qualification?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  /** Zoom seat email — the licensed user under which this person hosts. */
  zoomEmail?: string | null;
  roles: string[];
  supportSubRole?: 'supervisor' | 'agent' | null;
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
  isCurrentDevice?: boolean;
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
    scfhsNumber?: string;
    nationalId: string;
    recaptchaToken?: string;
  }) => api.post<RegisterResponse>('/auth/register', data, { skipAuth: true }),

  login: (data: { email: string; password: string; recaptchaToken?: string }) =>
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

  // Password Reset. recaptchaToken is optional in the API signature so old
  // callers don't break; the backend verifies it when present and runs the
  // unauthenticated path otherwise (rate limiting still defends against
  // abuse). The forgot/reset pages always pass a token in production.
  forgotPassword: (email: string, recaptchaToken?: string) =>
    api.post<{ message: string }>(
      '/auth/forgot-password',
      { email, recaptchaToken },
      { skipAuth: true },
    ),

  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
    recaptchaToken?: string,
  ) =>
    api.post<{ message: string }>(
      '/auth/reset-password',
      { email, code, newPassword, recaptchaToken },
      { skipAuth: true },
    ),

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
  // Optional in the new admin invite flow — when omitted, the BE
  // issues a password-setup magic link to the user's inbox so they
  // pick their own. UI no longer collects password from the admin.
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  supportSubRole?: string;
  // Required server-side when role=SUPPORT + supportSubRole='agent'.
  // The new agent joins this supervisor's team in the same request so
  // no orphan agent ever exists.
  supervisorId?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  zoomEmail?: string | null;
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
  /** Per-role headcount. Keys are role names (STUDENT, INSTRUCTOR, etc.).
   *  A user with multiple roles is counted once per role. */
  byRole?: Record<string, number>;
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

  // Download all users as CSV (honors current filters). Returns the
  // server-supplied filename via Content-Disposition where possible,
  // falling back to `users-<date>.csv`.
  exportUsers: async (params?: {
    search?: string;
    role?: string;
    status?: string;
  }): Promise<void> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.role) searchParams.set('role', params.role);
    if (params?.status) searchParams.set('status', params.status);
    const queryString = searchParams.toString();
    const blob = await fetchBlob(
      `/auth/users/export${queryString ? `?${queryString}` : ''}`,
    );
    const ts = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `users-${ts}.csv`);
  },

  // Get a user's roles
  getUserRoles: (userId: string) =>
    api.get<{ userId: string; roles: string[] }>(`/auth/users/${userId}/roles`),

  // Assign a role to a user. When granting SUPPORT + supportSubRole='agent',
  // the BE now requires a `supervisorId` — the team the agent joins.
  assignRole: (
    userId: string,
    role: string,
    supportSubRole?: string,
    supervisorId?: string,
  ) =>
    api.post<{ message: string; roles: string[] }>(`/auth/users/${userId}/roles`, {
      role,
      ...(supportSubRole ? { supportSubRole } : {}),
      ...(supervisorId ? { supervisorId } : {}),
    }),

  // Remove a role from a user
  removeRole: (userId: string, role: string) =>
    api.delete<{ message: string; roles: string[] }>(`/auth/users/${userId}/roles/${role}`),

  // Create a new user (admin only). When `data.password` is omitted,
  // the BE issues a magic-link invite to the user's inbox so they
  // pick their own password. The response includes `inviteSent` so
  // the UI can confirm delivery.
  createUser: (data: CreateUserData) =>
    api.post<User & { inviteSent?: boolean }>('/auth/users', data),

  // Resend the password-setup invite to an admin-created user that
  // hasn't completed setup. Rejected (400) if the user is already
  // verified. Generates a fresh 24h token, invalidates the prior one.
  resendUserInvite: (userId: string) =>
    api.post<{ sent: boolean }>(`/auth/users/${userId}/resend-invite`, {}),

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

  // Replace a role's permission matrix
  updateRolePermissions: (roleId: string, permissions: RolePermissions) =>
    api.patch<{ id: string; name: string; permissions: RolePermissions }>(
      `/auth/roles/${roleId}/permissions`,
      { permissions },
    ),

  // Trusted Device Management (admin only)
  getUserTrustedDevices: (userId: string) =>
    api.get<TrustedDevice[]>(`/auth/users/${userId}/trusted-devices`),

  revokeUserDevice: (userId: string, deviceId: string) =>
    api.delete<{ message: string }>(`/auth/users/${userId}/trusted-devices/${deviceId}`),

  revokeAllUserDevices: (userId: string) =>
    api.delete<{ message: string }>(`/auth/users/${userId}/trusted-devices`),

  // Sidebar profile-card stats (totals + today's active users)
  getOverviewStats: () =>
    api.get<{ totalUsers: number; totalCourses: number; activeToday: number }>(
      '/admin/stats/overview',
    ),

  // Full dashboard payload — drives every widget on /dashboard/admin.
  // Real numbers; computed in a single Promise.all on the backend.
  getDashboard: () =>
    api.get<AdminDashboardPayload>('/admin/stats/dashboard'),

  // Platform-wide trusted devices for the Security page.
  getSecuritySessions: (params?: { search?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    const qs = sp.toString();
    return api.get<{ rows: AdminSessionRow[]; total: number }>(
      `/admin/stats/security/sessions${qs ? `?${qs}` : ''}`,
    );
  },

  getFailedLogins: (params?: { limit?: number; offset?: number; hours?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    if (params?.hours) sp.set('hours', String(params.hours));
    const qs = sp.toString();
    return api.get<{ rows: AdminFailedLoginRow[]; total: number }>(
      `/admin/stats/security/failed-logins${qs ? `?${qs}` : ''}`,
    );
  },

  getSuspiciousIps: (threshold?: number) => {
    const qs = threshold ? `?threshold=${threshold}` : '';
    return api.get<AdminSuspiciousIp[]>(`/admin/stats/security/suspicious-ips${qs}`);
  },

  // Get all courses (admin sees all)
  getCourses: (params?: InstructorCoursesParams) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.delivery && params.delivery !== 'all') sp.set('delivery', params.delivery);
    if (params?.search) sp.set('search', params.search);
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.instructorId) sp.set('instructorId', params.instructorId);
    if (params?.managerId) sp.set('managerId', params.managerId);
    const qs = sp.toString();
    return api.get<InstructorCoursesResponse>(`/courses${qs ? `?${qs}` : ''}`);
  },

  // Filter dropdown sources — admin-only minimal user lists
  getInstructorsList: () =>
    api.get<FilterPerson[]>('/admin/stats/instructors-list'),

  getManagersList: () =>
    api.get<FilterPerson[]>('/admin/stats/managers-list'),

  // Course mutations — same endpoints as courseManagerApi, just
  // surfaced here so the admin Courses page imports from a single
  // namespace. ADMIN is in every endpoint's @Roles list, so these are
  // permitted at the backend.
  activateCourse: (courseId: string) =>
    api.post<unknown>(`/courses/${courseId}/activate`, {}),

  deactivateCourse: (courseId: string) =>
    api.post<unknown>(`/courses/${courseId}/deactivate`, {}),

  completeCourse: (courseId: string) =>
    api.post<unknown>(`/courses/${courseId}/complete`, {}),

  toggleCourseFeatured: (courseId: string) =>
    api.patch<{ id: string; isFeatured: boolean }>(
      `/courses/${courseId}/feature`,
      {},
    ),

  requestCourseChanges: (courseId: string, note: string) =>
    api.post<unknown>(`/courses/${courseId}/request-changes`, { note }),

  updateCourse: (courseId: string, data: Record<string, unknown>) =>
    api.patch<unknown>(`/courses/${courseId}`, data),

  // Pre-delete preview: counts of dependent rows (modules, materials,
  // enrollments, sessions, assessments) that will be hidden along
  // with the course. Backs the strong-confirmation modal.
  getCourseDeleteImpact: (courseId: string) =>
    api.get<CourseDeleteImpactResponse>(`/courses/${courseId}/delete-impact`),

  deleteCourse: (courseId: string, reason?: string) =>
    api.delete<{ message: string }>(
      `/courses/${courseId}`,
      reason ? { reason } : undefined,
    ),

  // Phase B cancel-course workflow. Reason is mandatory (sent to students
  // in the cancellation email + captured in audit + NELC logs). Response
  // includes per-outcome counts for the confirmation toast.
  cancelCourse: (
    courseId: string,
    reason: string,
  ) =>
    api.post<CancelCourseResponse>(`/courses/${courseId}/cancel`, { reason }),

  // Phase D reschedule-course workflow.
  //   - shift  (from active)    → move dates, keep enrollments
  //   - revive (from cancelled) → run again; dropped stay dropped
  rescheduleCourse: (
    courseId: string,
    payload: { reason: string; newStartDate: string; newEndDate?: string },
  ) =>
    api.post<RescheduleCourseResponse>(
      `/courses/${courseId}/reschedule`,
      payload,
    ),

  // ─── Logs page: Audit Trail tab ────────────────────────
  getAuditLogs: (params?: AdminAuditLogQuery) => {
    const sp = new URLSearchParams();
    if (params?.entityType) sp.set('entityType', params.entityType);
    if (params?.action) sp.set('action', params.action);
    if (params?.performedBy) sp.set('performedBy', params.performedBy);
    if (params?.search) sp.set('search', params.search);
    if (params?.from) sp.set('from', params.from);
    if (params?.to) sp.set('to', params.to);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<AdminAuditLogResponse>(
      `/audit-logs/admin/list${qs ? `?${qs}` : ''}`,
    );
  },

  getAuditLogDistinct: () =>
    api.get<{ entityTypes: string[]; actions: string[] }>(
      '/audit-logs/admin/distinct',
    ),

  exportAuditLogs: async (params?: AdminAuditLogQuery): Promise<void> => {
    const sp = new URLSearchParams();
    if (params?.entityType) sp.set('entityType', params.entityType);
    if (params?.action) sp.set('action', params.action);
    if (params?.performedBy) sp.set('performedBy', params.performedBy);
    if (params?.search) sp.set('search', params.search);
    if (params?.from) sp.set('from', params.from);
    if (params?.to) sp.set('to', params.to);
    const qs = sp.toString();
    const blob = await fetchBlob(
      `/audit-logs/admin/export${qs ? `?${qs}` : ''}`,
    );
    const ts = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `audit-logs-${ts}.csv`);
  },

  // ─── Logs page: Alerts tab ────────────────────────────
  getAdminNotifications: (params?: AdminNotificationQuery) => {
    const sp = new URLSearchParams();
    if (params?.type) sp.set('type', params.type);
    if (params?.unread !== undefined) sp.set('unread', String(params.unread));
    if (params?.from) sp.set('from', params.from);
    if (params?.to) sp.set('to', params.to);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<AdminNotificationListResponse>(
      `/admin/notifications${qs ? `?${qs}` : ''}`,
    );
  },

  getAdminNotificationCounts: () =>
    api.get<{ unread: number; criticalUnread: number; total: number }>(
      '/admin/notifications/counts',
    ),

  markAdminNotificationRead: (id: string) =>
    api.patch<AdminNotificationItem>(
      `/admin/notifications/${id}/read`,
      {},
    ),

  markAllAdminNotificationsRead: () =>
    api.post<{ updated: number }>('/admin/notifications/mark-all-read', {}),
};

export interface AdminAuditLogQuery {
  entityType?: string;
  action?: string;
  performedBy?: string;
  search?: string;
  /** ISO string */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminAuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  performerFirstName: string | null;
  performerLastName: string | null;
  performerEmail: string;
}

export interface AdminAuditLogResponse {
  data: AdminAuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type AdminNotificationType = 'critical' | 'warning' | 'info';

export interface AdminNotificationQuery {
  type?: AdminNotificationType;
  /** true = unread only, false = read only, undefined = both */
  unread?: boolean;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AdminNotificationItem {
  id: string;
  type: AdminNotificationType;
  title: string;
  description: string;
  titleKey: string | null;
  titleParams: Record<string, string | number> | null;
  descriptionKey: string | null;
  descriptionParams: Record<string, string | number> | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface AdminNotificationListResponse {
  data: AdminNotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Admin dashboard payload ──────────────────────────────────────────
// Mirrors AdminDashboardPayload on the backend. Every number here is
// computed live from the DB — no mock data.
export interface AdminDashboardPayload {
  kpi: {
    activeUsers: number;
    activeUsersTrend: number;
    totalUsers: number;
    totalUsersNew: number;
    revenueMTD: number;
    revenueTrend: number;
    certificatesIssued: number;
    certificatesPeriod: 'thisMonth';
    pendingApplications: number;
  };
  analytics: {
    visitorToSignup: number | null;
    signupToEnroll: number;
    enrollToPaid: number;
    completionRate: number;
  };
  security: {
    failedLogins: number;
    ipsBlocked: number;
    activeSessions: number;
    twoFaAdoption: number;
  };
  finance: {
    grossRevenue: number;
    netRevenue: number;
    gateways: Array<{ name: string; percentage: number }>;
    refundRate: number;
    chargebackRate: number;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    initials: string;
    role: 'admin' | 'instructor' | 'student' | 'manager';
    status: 'active' | 'suspended' | 'pending';
  }>;
  compliance: {
    percentage: number;
    passed: number;
    review: number;
    failed: number;
    areas: Array<{ id: string; name: string; status: 'pass' | 'review' | 'fail' }>;
  };
  recentActivity: Array<{
    id: string;
    type: 'user' | 'admin' | 'payment' | 'course' | 'certificate';
    user: string;
    action: string;
    time: string; // ISO
  }>;
  recentPoints: Array<{
    id: string;
    userId: string;
    userName: string;
    delta: number;
    reason: string;
    awardedAt: string; // ISO
  }>;
}

// Platform-wide session/device row for admin Security page.
export interface AdminSessionRow {
  deviceId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  deviceName: string | null;
  ipAddress: string | null;
  fingerprint: string;
  lastUsedAt: string;
  createdAt: string;
}

export interface AdminFailedLoginRow {
  id: string;
  attemptedEmail: string | null;
  performedById: string;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface AdminSuspiciousIp {
  ipAddress: string;
  attempts: number;
  lastAttemptAt: string;
}

export interface FilterPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface PermissionFlags {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type RolePermissions = Partial<Record<string, PermissionFlags>>;

export interface RoleWithCount {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  permissions: RolePermissions;
  createdAt: string;
  usersCount: number;
}

// ===========================================
// Role Request Types
// ===========================================
export type RoleRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MORE_INFO';

/** Fixed enum — keep in sync with backends/database/schema/role-request-events.ts */
export type MissingRequirementCode =
  | 'CV_MISSING'
  | 'SCFHS_VERIFICATION'
  | 'QUALIFICATION_DOC'
  | 'PHOTO'
  | 'BANK_DETAILS'
  | 'NATIONAL_ID'
  | 'OTHER';

export interface MissingRequirement {
  code: MissingRequirementCode;
  /** Required when code === 'OTHER'; optional override otherwise. */
  label?: string;
  /** Optional admin note targeted at this specific requirement. */
  note?: string;
}

export type RoleRequestEventAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'requested_info'
  | 'resubmitted';

export interface RoleRequestEvent {
  id: string;
  action: RoleRequestEventAction;
  note: string | null;
  missingRequirements: MissingRequirement[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  performedById: string | null;
  performedByFirstName: string | null;
  performedByLastName: string | null;
  performedByEmail: string | null;
}

export interface RoleRequest {
  id: string;
  userId: string;
  requestedRole: string;
  status: RoleRequestStatus;
  profileData: Record<string, unknown>;
  bankData: Record<string, unknown> | null;
  resumeFiles: Array<{ type: string; url: string; filename: string }> | null;
  structuredResume: {
    education?: Array<{ university: string; graduationYear: string; profession: string; specialty: string; qualification: string }>;
    professionalSkills?: Array<{ placeOfWork: string; type: string; yearsOfExperience: number; academicRank?: string; natureOfWork?: string }>;
    scientificResearches?: Array<{ type: string; role: string; description: string }>;
    trainingExperiences?: Array<{ eventName: string; executingAgency: string }>;
  } | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  missingRequirements?: MissingRequirement[] | null;
  /** Present on the admin detail endpoint (includes event timeline). */
  events?: RoleRequestEvent[];
  createdAt: string;
  updatedAt: string;
  user?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar?: string | null;
  };
}

/** Slim row returned by the support list endpoint. */
export interface SupportRoleRequestRow {
  id: string;
  status: RoleRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  applicantEmail: string;
  applicantFirstName: string | null;
  applicantLastName: string | null;
  profileData: Record<string, unknown>;
  missingRequirements: MissingRequirement[] | null;
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

  // Request more info (admin) — accepts a structured missing-reqs
  // checklist that propagates to the applicant's email + status page.
  requestInfo: (
    id: string,
    payload: { reviewNote: string; missingRequirements?: MissingRequirement[] },
  ) =>
    api.patch<{ message: string }>(`/role-requests/${id}/request-info`, payload),

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

  // ─── Support-facing reads (no write actions exposed here) ────
  support: {
    list: (params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.search) qs.set('search', params.search);
      if (params?.status) qs.set('status', params.status);
      const tail = qs.toString();
      return api.get<{
        items: SupportRoleRequestRow[];
        total: number;
        page: number;
        limit: number;
      }>(`/support/role-requests${tail ? `?${tail}` : ''}`);
    },
    getById: (id: string) =>
      api.get<{
        request: RoleRequest;
        events: RoleRequestEvent[];
      }>(`/support/role-requests/${id}`),
  },
};

// ===========================================
// Trainer Applications — public self-serve portal
//
// The /become-trainer status flow uses these endpoints. Distinct from
// roleRequestsApi (which is for logged-in users) — these are
// captcha + OTP gated and require no platform login. The verify
// endpoint returns a short-lived scoped token that authorises
// `portalResubmit` for a MORE_INFO application.
// ===========================================

const API_URL_FOR_PORTAL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export type PortalApplicationStatus =
  | { found: false }
  | {
      found: true;
      isPlaceholder: boolean;
      request: {
        id: string;
        status: RoleRequestStatus;
        requestedRole: string;
        submittedAt: string;
        updatedAt: string;
        reviewedAt: string | null;
        reviewNote: string | null;
        missingRequirements: MissingRequirement[] | null;
        prefill: {
          profileData: Record<string, unknown>;
          bankData: Record<string, unknown> | null;
          resumeFiles: Array<{
            type: string;
            url: string;
            filename: string;
          }> | null;
          structuredResume: Record<string, unknown> | null;
        } | null;
      };
      events: RoleRequestEvent[];
    };

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // body wasn't JSON — fall through with the default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const trainerApplicationsPortalApi = {
  /** Step 1 — captcha + send portal OTP. */
  requestOtp: (data: {
    email: string;
    recaptchaToken?: string;
    locale?: string;
  }) =>
    postJson<{ message: string }>(
      `${API_URL_FOR_PORTAL}/trainer-applications/portal/request-otp`,
      data,
    ),

  /**
   * Step 2 — verify OTP. Returns:
   *   - token: scoped JWT (purpose=trainer-application-portal, 15 min)
   *   - email: the verified email
   *   - application: current status snapshot (use immediately, no
   *     separate fetch needed)
   */
  verifyOtp: (data: { email: string; code: string }) =>
    postJson<{
      token: string;
      email: string;
      application: PortalApplicationStatus;
    }>(`${API_URL_FOR_PORTAL}/trainer-applications/portal/verify-otp`, data),

  /** Refresh the status with an active portal token. */
  status: (token: string) =>
    getJson<PortalApplicationStatus>(
      `${API_URL_FOR_PORTAL}/trainer-applications/portal/status`,
      token,
    ),

  /** Submit updated application data for a MORE_INFO request. */
  resubmit: (
    token: string,
    data: {
      roleRequestId: string;
      profileData: Record<string, unknown>;
      bankData?: Record<string, unknown>;
      resumeFiles?: Array<{ type: string; url: string; filename: string }>;
      structuredResume?: Record<string, unknown>;
    },
  ) =>
    postJson<{ requestId: string; message: string }>(
      `${API_URL_FOR_PORTAL}/trainer-applications/portal/resubmit`,
      data,
      token,
    ),
};

// ===========================================
// Admin Notifications API
// ===========================================
export interface AdminNotification {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  titleKey: string | null;
  titleParams: Record<string, string | number> | null;
  descriptionKey: string | null;
  descriptionParams: Record<string, string | number> | null;
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

// ===========================================
// Instructor Dashboard API
// ===========================================
import type {
  DashboardSummaryResponse,
  CourseEnrollment,
  AssessmentResponse,
  AssessmentsListResponse,
  InstructorCoursesResponse,
  InstructorCoursesParams,
  CourseDetailResponse,
  CourseSession,
  CourseSessionsResponse,
  CourseModule,
  CreateCourseData,
  AttendanceRecord,
  InstructorStudent,
  AtRiskStudent,
  StudentDetailResponse,
  AssessmentQuestion,
  AssessmentSubmission,
  ItemAnalysisResponse,
  CourseMaterialResponse,
  CertificateRequestResponse,
  CertificateListResponse,
  BatchCertificateResult,
  CreateInterventionPayload,
  InterventionResponse,
  InterventionRecord,
  PublicCoursesResponse,
  InstructorPublicProfile,
} from '@/types/instructor-dashboard';

export const instructorApi = {
  // Aggregated dashboard summary
  getDashboardSummary: () =>
    api.get<DashboardSummaryResponse>('/instructor/dashboard-summary'),

  // Approved instructor reviews for the authenticated instructor —
  // populates the dashboard sidebar rating + a Reviews block on the
  // dashboard home. Same response shape as the manager's /instructor/:id/reviews.
  getMyReviews: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return api.get<{
      data: Array<{
        id: string;
        courseId: string;
        courseTitle: string;
        courseTitleAr: string | null;
        rating: number;
        reviewText: string | null;
        createdAt: string;
        studentName: string;
      }>;
      avgRating: number;
      totalRatings: number;
    }>(`/instructor/me/reviews${qs}`);
  },

  // Per-course performance data (attendance, modules, pass/fail)
  getCoursePerformance: (courseId?: string) =>
    api.get<{ attendanceTrend: number[]; moduleProgress: { name: string; percentage: number }[]; passFailStats: { totalStudents: number; passed: number; failed: number; passRate: number } | null }>(
      `/instructor/course-performance${courseId && courseId !== 'all' ? `?courseId=${courseId}` : ''}`
    ),

  // Course enrollments (for course performance widget)
  getCourseEnrollments: (courseId: string) =>
    api.get<CourseEnrollment[]>(`/courses/${courseId}/enrollments`),

  // Assessments for a course (for assessment analysis widget)
  getAssessments: (courseId: string) =>
    api.get<{ data: AssessmentResponse[] }>(`/assessments?courseId=${courseId}`),

  // Assessments listing with full filters
  getAssessmentsList: (params?: { courseId?: string; type?: string; status?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.courseId) sp.set('courseId', params.courseId);
    if (params?.type && params.type !== 'all') sp.set('type', params.type);
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<AssessmentsListResponse>(`/assessments${qs ? `?${qs}` : ''}`);
  },

  // Assessment CRUD
  createAssessment: (data: { courseId: string; title: string; type: string; totalMarks: number; passingMarks: number; durationMinutes?: number; attemptsAllowed?: number; dueDate?: string; instructions?: string; moduleId?: string; randomizeOrder?: boolean; questionsPerAttempt?: number }) =>
    api.post<AssessmentResponse>('/assessments', data),

  getAssessmentDetail: (assessmentId: string) =>
    api.get<AssessmentResponse & { questions: AssessmentQuestion[] }>(`/assessments/${assessmentId}`),

  updateAssessment: (assessmentId: string, data: Record<string, unknown>) =>
    api.patch<AssessmentResponse>(`/assessments/${assessmentId}`, data),

  deleteAssessment: (assessmentId: string) =>
    api.delete<{ message: string }>(`/assessments/${assessmentId}`),

  // Questions
  getAssessmentQuestions: (assessmentId: string) =>
    api.get<AssessmentQuestion[]>(`/assessments/${assessmentId}/questions`),

  getCourseBankQuestions: (courseId: string) =>
    api.get<AssessmentQuestion[]>(`/assessments/course-bank/${courseId}/questions`),

  addCourseBankQuestion: (courseId: string, data: { type: string; questionText: string; questionTextAr?: string; options?: { text: string; textAr?: string; isCorrect: boolean }[]; correctAnswer?: string; marks?: number; difficultyLevel?: string }) =>
    api.post<AssessmentQuestion>(`/assessments/course-bank/${courseId}/questions`, data),

  addQuestion: (assessmentId: string, data: { type: string; questionText: string; questionTextAr?: string; options?: { text: string; textAr?: string; isCorrect: boolean }[]; correctAnswer?: string; marks?: number; difficultyLevel?: string }) =>
    api.post<AssessmentQuestion>(`/assessments/${assessmentId}/questions`, data),

  updateQuestion: (assessmentId: string, questionId: string, data: Record<string, unknown>) =>
    api.patch<AssessmentQuestion>(`/assessments/${assessmentId}/questions/${questionId}`, data),

  deleteQuestion: (assessmentId: string, questionId: string) =>
    api.delete<{ message: string }>(`/assessments/${assessmentId}/questions/${questionId}`),

  // Submissions & Grading
  getSubmissions: (assessmentId: string) =>
    api.get<AssessmentSubmission[]>(`/assessments/${assessmentId}/submissions`),

  gradeSubmission: (assessmentId: string, submissionId: string, grades: { questionId: string; marksAwarded: number; comment?: string }[], overallComment?: string) =>
    api.patch<AssessmentSubmission>(`/assessments/${assessmentId}/submissions/${submissionId}/grade`, { grades, overallComment }),

  gradeAssignment: (assessmentId: string, submissionId: string, score: number, comment?: string) =>
    api.patch<AssessmentSubmission>(`/assessments/${assessmentId}/submissions/${submissionId}/grade-assignment`, { score, comment }),

  // Assignment file management
  uploadAssignmentFile: async (assessmentId: string, file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise<{ id: string; fileUrl: string; fileName: string; fileSize: number; mimeType: string; uploadedAt: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/assessments/${assessmentId}/files`);
      const token = getAccessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });
  },

  removeAssignmentFile: (assessmentId: string, fileId: string) =>
    api.delete<{ message: string }>(`/assessments/${assessmentId}/files/${fileId}`),

  // Item Analysis
  getItemAnalysis: (assessmentId: string) =>
    api.get<ItemAnalysisResponse>(`/assessments/${assessmentId}/item-analysis`),

  // Instructor courses listing (My Courses page)
  getCourses: (params?: InstructorCoursesParams) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.delivery && params.delivery !== 'all') sp.set('delivery', params.delivery);
    if (params?.search) sp.set('search', params.search);
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<InstructorCoursesResponse>(`/courses${qs ? `?${qs}` : ''}`);
  },

  // Course detail with modules
  getCourseDetail: (courseId: string) =>
    api.get<CourseDetailResponse>(`/courses/${courseId}`),

  // Sessions for a specific course
  getCourseSessions: (courseId: string) =>
    api.get<CourseSessionsResponse>(`/sessions?courseId=${courseId}&limit=50`),

  // Course creation
  createCourse: (data: { title: string; titleAr?: string; description?: string; descriptionAr?: string; deliveryType: string; thumbnail?: string; maxEnrollment?: number; startDate?: string; endDate?: string; cohort?: string; price?: number; enrollmentDeadline?: string; cmeHours?: number; isCmeAccredited?: boolean }) =>
    api.post<CourseDetailResponse>('/courses', data),

  // Course update & delete
  updateCourse: (courseId: string, data: Record<string, unknown>) =>
    api.patch<CourseDetailResponse>(`/courses/${courseId}`, data),

  deleteCourse: (courseId: string) =>
    api.delete<{ message: string }>(`/courses/${courseId}`),

  // Module management
  addModule: (courseId: string, data: { title: string; titleAr?: string; type: string; durationMinutes?: number }) =>
    api.post<CourseModule>(`/courses/${courseId}/modules`, data),

  updateModule: (courseId: string, moduleId: string, data: Record<string, unknown>) =>
    api.patch<CourseModule>(`/courses/${courseId}/modules/${moduleId}`, data),

  deleteModule: (courseId: string, moduleId: string) =>
    api.delete<{ message: string }>(`/courses/${courseId}/modules/${moduleId}`),

  reorderModules: (courseId: string, modules: { id: string; orderIndex: number }[]) =>
    api.patch<CourseModule[]>(`/courses/${courseId}/modules/reorder`, { modules }),

  // Session management
  createSession: (data: Record<string, unknown>) =>
    api.post<CourseSession>('/sessions', data),

  updateSession: (sessionId: string, data: Record<string, unknown>) =>
    api.patch<CourseSession>(`/sessions/${sessionId}`, data),

  startSession: (sessionId: string) =>
    api.post<CourseSession>(`/sessions/${sessionId}/start`, {}),

  endSession: (sessionId: string) =>
    api.post<CourseSession>(`/sessions/${sessionId}/end`, {}),

  finalizeSession: (sessionId: string) =>
    api.post<CourseSession>(`/sessions/${sessionId}/finalize`, {}),

  cancelSession: (sessionId: string, cancelReason: string) =>
    api.patch<CourseSession>(`/sessions/${sessionId}/cancel`, { cancelReason }),

  rescheduleSession: (sessionId: string, data: { reason: string; newScheduledAt?: string; newDurationMinutes?: number }) =>
    api.post<CourseSession>(`/sessions/${sessionId}/reschedule`, data),

  deleteSession: (sessionId: string) =>
    api.delete<{ message: string }>(`/sessions/${sessionId}`),

  // Thumbnail upload
  uploadThumbnail: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFormData<{ url: string; filename: string }>('/storage/upload', fd);
  },

  // Sessions listing with filters
  getSessions: (params?: { dateRange?: string; status?: string; courseId?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.dateRange) sp.set('dateRange', params.dateRange);
    if (params?.status) sp.set('status', params.status);
    if (params?.courseId) sp.set('courseId', params.courseId);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<CourseSessionsResponse>(`/sessions${qs ? `?${qs}` : ''}`);
  },

  getTodaySessions: () =>
    api.get<CourseSession[]>('/sessions/today'),

  getUpcomingSessions: () =>
    api.get<CourseSession[]>('/sessions/upcoming'),

  // Enrollment (with NELC limit enforcement)
  enrollStudent: (courseId: string, data: { studentId: string }) =>
    api.post<{ id: string; courseId: string; studentId: string; status: string }>(
      `/courses/${courseId}/enroll`,
      data,
    ),

  // Attendance
  getSessionAttendance: (sessionId: string) =>
    api.get<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`),

  markAttendance: (sessionId: string, data: { studentId: string; status: string; note?: string }) =>
    api.post<AttendanceRecord>(`/sessions/${sessionId}/attendance`, data),

  bulkMarkAttendance: (sessionId: string, records: { studentId: string; status: string; note?: string }[]) =>
    api.post<AttendanceRecord[]>(`/sessions/${sessionId}/attendance/bulk`, { records }),

  updateAttendance: (attendanceId: string, data: { status?: string; note?: string }) =>
    api.patch<AttendanceRecord>(`/attendance/${attendanceId}`, data),

  // Students
  getStudents: (params?: { courseId?: string }) => {
    const query = params?.courseId ? `?courseId=${params.courseId}` : '';
    return api.get<InstructorStudent[]>(`/instructor/students${query}`);
  },

  getStudentDetail: (studentId: string) =>
    api.get<StudentDetailResponse>(`/instructor/students/${studentId}`),

  getAtRiskStudents: () =>
    api.get<AtRiskStudent[]>('/instructor/at-risk'),

  updateAtRiskSettings: (courseId: string, data: { atRiskAttendanceThreshold?: number; atRiskScoreThreshold?: number; atRiskInactivityDays?: number }) =>
    api.patch<{ message: string }>(`/instructor/courses/${courseId}/at-risk-settings`, data),

  getFilterOptions: () =>
    api.get<{ deliveryTypes: string[]; cohorts: string[] }>('/instructor/filter-options'),

  // Session Materials Sharing (Feature 8)
  shareMaterial: (sessionId: string, materialId: string) =>
    api.post<{ message: string }>(`/sessions/${sessionId}/share-material`, { materialId }),

  unshareMaterial: (sessionId: string, materialId: string) =>
    api.delete<{ message: string }>(`/sessions/${sessionId}/share-material/${materialId}`),

  getSharedMaterials: (sessionId: string) =>
    api.get<Array<{
      id: string;
      materialId: string;
      sharedAt: string;
      materialTitle: string;
      materialType: string;
      fileUrl: string | null;
      fileSize: number | null;
      mimeType: string | null;
      sharerFirstName: string;
      sharerLastName: string;
    }>>(`/sessions/${sessionId}/shared-materials`),

  // Make-up Session (Feature 9)
  createMakeupSession: (studentId: string, data: {
    courseId: string;
    title: string;
    type: string;
    scheduledAt: string;
    durationMinutes?: number;
    parentSessionId?: string;
  }) =>
    api.post<CourseSession>(`/instructor/students/${studentId}/makeup-session`, data),

  // Interventions
  createIntervention: (data: CreateInterventionPayload) =>
    api.post<InterventionResponse>('/instructor/interventions', data),

  getStudentInterventions: (studentId: string) =>
    api.get<InterventionRecord[]>(`/instructor/students/${studentId}/interventions`),

  // Course Review Workflow
  submitForReview: (courseId: string) =>
    api.post<CourseDetailResponse>(`/courses/${courseId}/submit-review`, {}),

  // Course Rating Stats
  getCourseRatingStats: (courseId: string) =>
    api.get<{ avgRating: number; totalRatings: number }>(`/courses/${courseId}/ratings/stats`),

  // Certificates
  getCertificates: (params?: { courseId?: string; status?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.courseId && params.courseId !== 'all') sp.set('courseId', params.courseId);
    // Send status even when it's "all" — backend treats absent status
    // as "default to pending" but "all" as "no status filter".
    if (params?.status) sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<CertificateListResponse>(`/instructor/certificates${qs ? `?${qs}` : ''}`);
  },

  getCertificateDetail: (id: string) =>
    api.get<CertificateRequestResponse>(`/certificates/${id}`),

  approveCertificate: (id: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/approve`, {}),

  rejectCertificate: (id: string, note: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/reject`, { note }),

  holdCertificate: (id: string, note: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/hold`, { note }),

  revokeCertificate: (id: string, reason: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/revoke`, { reason }),

  batchCertificates: (ids: string[], action: 'approve' | 'reject' | 'hold', note?: string) =>
    api.post<BatchCertificateResult>('/certificates/batch', { ids, action, note }),

  downloadCertificate: async (certId: string) => {
    const blob = await fetchBlob(`/certificates/${certId}/download`);
    downloadBlob(blob, `certificate-${certId.slice(0, 8)}.pdf`);
  },

  batchDownloadCertificates: async (ids: string[]) => {
    const blob = await fetchBlob(`/certificates/batch-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    } as FetchOptions);
    downloadBlob(blob, `certificates-${new Date().toISOString().split('T')[0]}.zip`);
  },

  getMyCertificates: () =>
    api.get<{ id: string; courseId: string; status: string; certificateUrl: string | null; createdAt: string; reviewedAt: string | null; courseName: string; courseThumbnail: string | null }[]>('/certificates/my-certificates'),
};

// ===========================================
// Profile API (self-service)
// ===========================================
export const profileApi = {
  update: (data: { firstName?: string; lastName?: string; firstNameAr?: string; lastNameAr?: string; phone?: string; avatar?: string | null; bio?: string; location?: string; language?: string; department?: string; scfhsNumber?: string; nationalId?: string; nationality?: string; gender?: string; dateOfBirth?: string; specialty?: string; profession?: string; qualification?: string; twitter?: string; linkedin?: string }) =>
    api.patch<User>('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFormData<{ url: string; filename: string }>('/storage/upload-avatar', fd);
  },
};

// ===========================================
// Sidebar alert badges — per-tab unread counters
// ===========================================
export const SIDEBAR_TAB_KEYS = {
  SUPPORT_MY_TICKETS: 'support:my-tickets',
  SUPPORT_ALL_TICKETS: 'support:all-tickets',
  SUPPORT_ALERTS: 'support:alerts',
  SUPPORT_TEAM: 'support:team',
  SUPPORT_TRAINER_APPS: 'support:trainer-applications',
  ADMIN_USERS: 'admin:users',
  ADMIN_TRAINER_APPS: 'admin:trainer-applications',
  USER_SUPPORT: 'user:support',
  // Phase 2 — tickets where the user is a looped-in collaborator.
  USER_LOOPED_IN: 'user:looped-in',
} as const;

export type SidebarTabKey =
  (typeof SIDEBAR_TAB_KEYS)[keyof typeof SIDEBAR_TAB_KEYS];

export const sidebarBadgesApi = {
  // Map of tabKey → unread count. Returns only keys relevant to the
  // caller's role.
  get: () => api.get<Record<string, number>>('/me/sidebar-badges'),

  // Bump the user's viewed_at for a tab to NOW — clears that tab's
  // badge on the next poll. Called by each badge-eligible page on
  // mount.
  markViewed: (tabKey: SidebarTabKey) =>
    api.post<{ success: true }>(`/me/sidebar-badges/${tabKey}/viewed`, {}),
};

// ===========================================
// Preferences API (notification + UI preferences)
// ===========================================
export const preferencesApi = {
  get: () => api.get<Record<string, unknown>>('/preferences'),
  updateNotifications: (data: Record<string, boolean>) =>
    api.patch<Record<string, unknown>>('/preferences/notifications', data),
  updateUi: (data: Record<string, unknown>) =>
    api.patch<Record<string, unknown>>('/preferences/ui', data),
  updatePolicies: (data: Record<string, unknown>) =>
    api.patch<Record<string, unknown>>('/preferences/policies', data),
};

// ===========================================
// Admin Settings API (platform-wide config)
// ===========================================
export type SettingsCategory =
  | 'general'
  | 'localization'
  | 'auth'
  | 'payments'
  | 'notifications'
  | 'maintenance'
  | 'mail';

export interface NotificationTemplate {
  id: string;
  eventKey: string;
  channel: string;
  locale: string;
  subject: string | null;
  body: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const adminSettingsApi = {
  /** Fetch every category in one call — used to bootstrap the Settings page. */
  getAll: () => api.get<Record<string, Record<string, unknown>>>('/admin/settings'),

  /** Fetch one category. */
  getCategory: <T = Record<string, unknown>>(category: SettingsCategory) =>
    api.get<{ category: string; value: T }>(`/admin/settings/${category}`),

  /** Replace a category's value wholesale. */
  updateCategory: <T = Record<string, unknown>>(
    category: SettingsCategory,
    value: T,
  ) =>
    api.patch<{ category: string; value: T }>(
      `/admin/settings/${category}`,
      { value },
    ),

  // Notification templates
  listTemplates: () =>
    api.get<NotificationTemplate[]>('/admin/settings/templates/all'),
  getTemplate: (id: string) =>
    api.get<NotificationTemplate>(`/admin/settings/templates/${id}`),
  createTemplate: (data: {
    eventKey: string;
    channel: string;
    locale: string;
    subject?: string;
    body: string;
    enabled?: boolean;
  }) =>
    api.post<NotificationTemplate>('/admin/settings/templates', data),
  updateTemplate: (
    id: string,
    data: { subject?: string | null; body?: string; enabled?: boolean },
  ) => api.patch<NotificationTemplate>(`/admin/settings/templates/${id}`, data),
  deleteTemplate: (id: string) =>
    api.delete<void>(`/admin/settings/templates/${id}`),

  getIntegrationHealth: () =>
    api.get<
      Record<
        string,
        { configured: boolean; required: boolean; description: string }
      >
    >('/admin/settings/integrations/health'),
};

// ===========================================
// Admin Error Monitoring (Sentry-backed)
// ===========================================

export type ErrorMonitoringPeriod = '24h' | '7d' | '30d';

export type ErrorMonitoringStatus =
  | 'ok'
  | 'no_recent'
  | 'errors_present'
  | 'not_configured'
  | 'unknown';

export interface ErrorMonitoringOverview {
  configured: boolean;
  apiHost: string;
  orgSlug: string;
  projectSlug: string;
  dashboardUrl: string;
  issuesUrl: string;
  status: ErrorMonitoringStatus;
  lastEventAt: string | null;
  counts: {
    last24h: { events: number; users: number };
    last7d: { events: number; users: number };
    last30d: { events: number; users: number };
  };
}

export interface SentryIssueSummary {
  id: string;
  shortId: string;
  title: string;
  culprit: string | null;
  level: string;
  status: string;
  eventCount: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  project: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
}

export interface ErrorMonitoringTrendBucket {
  timestamp: string;
  count: number;
}

export const errorMonitoringApi = {
  getOverview: () =>
    api.get<ErrorMonitoringOverview>('/admin/error-monitoring/overview'),
  getTopIssues: (period: ErrorMonitoringPeriod = '7d', limit = 10) =>
    api.get<SentryIssueSummary[]>(
      `/admin/error-monitoring/top?period=${period}&limit=${limit}`,
    ),
  getTrend: (period: ErrorMonitoringPeriod = '7d') =>
    api.get<ErrorMonitoringTrendBucket[]>(
      `/admin/error-monitoring/trend?period=${period}`,
    ),
  getIssue: (issueId: string) =>
    api.get<unknown>(`/admin/error-monitoring/issue/${encodeURIComponent(issueId)}`),
  resolveIssue: (issueId: string) =>
    api.post<unknown>(
      `/admin/error-monitoring/issue/${encodeURIComponent(issueId)}/resolve`,
    ),
};

// ===========================================
// Admin-only finance super-actions — gateway test/refresh + (Batch 3b)
// force-status, replay-webhook, sync-from-gateway, regenerate-pdf,
// force-cancel-invoice, force-approve-refund. Each mutation is audit
// logged on the backend.
// ===========================================

export type AdminGatewayName = 'moyasar' | 'tamara' | 'tabby';

export interface AdminGatewayTestResult {
  gateway: AdminGatewayName;
  status: 'healthy' | 'degraded' | 'down';
  source: 'db' | 'env' | 'mixed' | 'empty';
  checkedAt: string;
  error?: string;
}

/** Per-gateway runtime status — what's actually loaded in the credential
 *  cache. Drives the read-only mode/source/lastFour pills in PaymentsTab. */
export interface GatewayRuntimeStatus {
  mode: 'test' | 'live' | null;
  source: 'db' | 'env' | 'mixed' | 'empty';
  lastFour: string | null;
  hasCredentials: boolean;
}

export interface GatewayRuntimeStatusResponse {
  moyasar: GatewayRuntimeStatus;
  tamara: GatewayRuntimeStatus & { apiUrl: string };
  tabby: GatewayRuntimeStatus;
}

export const adminFinanceApi = {
  /** Ping a payment gateway with current credentials (DB > env). */
  testGatewayConnection: (gateway: AdminGatewayName) =>
    api.post<AdminGatewayTestResult>(
      `/admin/finance/gateways/${gateway}/test`,
      {},
    ),

  /** Per-gateway runtime status (mode/source/lastFour). Never returns
   *  secret values. */
  getGatewayRuntimeStatus: () =>
    api.get<GatewayRuntimeStatusResponse>(
      '/admin/finance/gateways/runtime-status',
    ),

  /** Force a refresh of the in-process credentials cache. */
  refreshGatewayCache: () =>
    api.post<void>('/admin/finance/gateways/refresh-cache', {}),

  // ── Payment super-actions ────────────────────────────────────────

  /** Manually flip a payment to PAID or FAILED (with required reason). */
  forcePaymentStatus: (
    paymentId: string,
    body: { status: 'paid' | 'failed'; reason: string },
  ) =>
    api.post<{
      ok: true;
      paymentId: string;
      previousStatus: string;
      newStatus: 'paid' | 'failed';
    }>(`/admin/finance/payments/${paymentId}/force-status`, body),

  /** Re-process the success path for a payment (replays the webhook). */
  replayPaymentWebhook: (paymentId: string, body: { reason: string }) =>
    api.post<{ ok: true; paymentId: string }>(
      `/admin/finance/payments/${paymentId}/replay-webhook`,
      body,
    ),

  /** Poll the gateway for live status and apply it locally. */
  syncPaymentFromGateway: (paymentId: string, body: { reason: string }) =>
    api.post<{
      ok: true;
      paymentId: string;
      gatewayStatus: string;
      applied: 'paid' | 'failed' | 'no_change';
    }>(`/admin/finance/payments/${paymentId}/sync-from-gateway`, body),

  /**
   * Cancel a Tamara order that hasn't been captured yet. Kills the order on
   * Tamara's side (releases the buyer + voids the authorisation hold), flips
   * our payment row to FAILED with errorCode='merchant_cancelled', and drops
   * pending enrollments. Only valid for gateway='tamara' AND pre-capture
   * statuses (pending/processing/awaiting_approval). Once paid, use refund.
   */
  cancelTamaraOrder: (paymentId: string, body: { reason: string }) =>
    api.post<{
      paymentId: string;
      status: string;
      tamaraStatus: string;
    }>(`/finance/tamara/cancel/${paymentId}`, body),

  // ── Invoice super-actions ────────────────────────────────────────

  /** Cancel an invoice — works even on paid invoices. */
  forceCancelInvoice: (invoiceId: string, body: { reason: string }) =>
    api.post<{
      ok: true;
      invoiceNumber: string;
      alreadyCancelled?: boolean;
    }>(`/admin/finance/invoices/${invoiceId}/force-cancel`, body),

  /** Re-render an invoice PDF with current tax + branding settings. */
  regenerateInvoicePdf: (
    invoiceId: string,
    body: { reason: string; locale?: 'en' | 'ar' },
  ) =>
    api.post<{ ok: true; invoiceNumber: string }>(
      `/admin/finance/invoices/${invoiceId}/regenerate-pdf`,
      body,
    ),

  /** Re-send the invoice email to the original buyer with the PDF attached. */
  resendInvoiceEmail: (
    invoiceId: string,
    body: { reason: string; locale?: 'en' | 'ar' },
  ) =>
    api.post<{ sent: true; invoiceNumber: string }>(
      `/admin/finance/invoices/${invoiceId}/resend-email`,
      body,
    ),

  // ── Refund super-actions ────────────────────────────────────────

  /** Approve a refund even when the lifecycle policy would block it. */
  forceApproveRefund: (refundId: string, body: { reason: string }) =>
    api.post<{ status: 'approved'; gatewayRefundId: string | null }>(
      `/admin/finance/refunds/${refundId}/force-approve`,
      body,
    ),
};

// ===========================================
// Zoom host management (admin) — pick the fallback host seat,
// inspect the connected account, test the connection. Credentials
// stay in Secret Manager; this only manages which seat hosts.
// ===========================================
export interface ZoomConfig {
  defaultHostEmail: string | null;
}

export interface ZoomSeat {
  email: string;
  name: string;
  type: number;
}

export interface ZoomAccountInfo {
  ownerEmail: string;
  ownerName: string;
  accountId: string;
  type: number;
  licensedSeats: ZoomSeat[];
}

export interface ZoomLicenseCheck {
  email: string;
  userExists: boolean;
  /** null = couldn't determine (app missing the per-user read scope). */
  hasWebinarLicense: boolean | null;
  userType: number | null;
  error?: string;
}

export interface ZoomConnectionStatus {
  connected: boolean;
  host?: ZoomLicenseCheck;
  error?: string;
}

export const zoomAdminApi = {
  getConfig: () => api.get<ZoomConfig>('/zoom/config'),
  updateConfig: (defaultHostEmail: string | null) =>
    api.put<ZoomConfig>('/zoom/config', { defaultHostEmail }),
  getAccountInfo: () => api.get<ZoomAccountInfo>('/zoom/account-info'),
  testConnection: (email?: string) =>
    api.post<ZoomConnectionStatus>('/zoom/config/test', email ? { email } : {}),
};

// ===========================================
// Backups API (admin DB backups + downloadable exports)
// ===========================================
export interface BackupOverview {
  /** false in non-production environments — live ops are unavailable. */
  enabled: boolean;
  instance: string;
  database: string;
  region: string;
  bucket: string;
  automatedDaily: boolean;
  pitrDays: number;
  encryptedAtRest: boolean;
  malwareScanned: boolean;
  signedDownloadExpiryMinutes: number;
}

export type BackupMode = 'snapshot' | 'export' | 'files_export';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackupRecord {
  id: string;
  type: string;
  mode: BackupMode;
  status: BackupStatus;
  gcsObject: string | null;
  fileSizeBytes: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  createdByFirstName: string | null;
  createdByLastName: string | null;
  createdByEmail: string | null;
}

export interface BackupRestorePoint {
  id: string;
  status: string;
  type: string; // AUTOMATED | ON_DEMAND
  startTime: string | null;
  endTime: string | null;
  description: string | null;
}

export interface BackupRestorePointsResponse {
  available: boolean;
  items: BackupRestorePoint[];
  error?: string;
}

export const backupsAdminApi = {
  getOverview: () => api.get<BackupOverview>('/admin/backups/overview'),
  list: () => api.get<BackupRecord[]>('/admin/backups'),
  getRestorePoints: () =>
    api.get<BackupRestorePointsResponse>('/admin/backups/restore-points'),
  createSnapshot: () =>
    api.post<{ id: string; status: string }>('/admin/backups/snapshot', {}),
  createExport: () =>
    api.post<{ id: string; status: string; object: string }>(
      '/admin/backups/export',
      {},
    ),
  createFilesExport: () =>
    api.post<{ id: string; status: string; object: string }>(
      '/admin/backups/files',
      {},
    ),
  getDownloadUrl: (id: string) =>
    api.post<{ url: string; expiresInMinutes: number }>(
      `/admin/backups/${id}/download`,
      {},
    ),
  listAudit: (page = 1, limit = 20) =>
    api.get<BackupAuditResponse>(
      `/admin/backups/audit?page=${page}&limit=${limit}`,
    ),
  listDeletedFiles: (page = 1, limit = 20) =>
    api.get<DeletedFilesResponse>(
      `/admin/backups/files/deleted?page=${page}&limit=${limit}`,
    ),
  restoreFile: (bucketLabel: string, name: string, generation: string) =>
    api.post<{
      ok: boolean;
      bucket: string;
      bucketLabel: string;
      name: string;
      size: number | null;
    }>('/admin/backups/files/restore', { bucketLabel, name, generation }),
  listDeletedMaterials: (page = 1, limit = 20) =>
    api.get<DeletedMaterialsResponse>(
      `/admin/backups/materials/deleted?page=${page}&limit=${limit}`,
    ),
  restoreMaterial: (id: string) =>
    api.post<RestoreMaterialResponse>(
      `/admin/backups/materials/${id}/restore`,
      {},
    ),
  listDeletedCourses: (page = 1, limit = 20) =>
    api.get<DeletedCoursesResponse>(
      `/admin/backups/courses/deleted?page=${page}&limit=${limit}`,
    ),
  restoreCourse: (id: string) =>
    api.post<RestoreCourseResponse>(
      `/admin/backups/courses/${id}/restore`,
      {},
    ),
  listRestoreClones: (page = 1, limit = 20) =>
    api.get<RestoreClonesResponse>(
      `/admin/backups/restore-clones?page=${page}&limit=${limit}`,
    ),
  createRestoreClone: (backupId: string) =>
    api.post<{
      id: string;
      dbName: string;
      status: string;
      expiresAt: string;
    }>('/admin/backups/restore-clones', { backupId }),
  extendRestoreClone: (id: string) =>
    api.post<{ id: string; expiresAt: string }>(
      `/admin/backups/restore-clones/${id}/extend`,
      {},
    ),
  dropRestoreClone: (id: string) =>
    api.post<{ id: string; status: string }>(
      `/admin/backups/restore-clones/${id}/drop`,
      {},
    ),
};

export interface CourseDeleteImpact {
  modules: number;
  materials: number;
  enrollments: number;
  sessions: number;
  upcomingSessions: number;
  assessments: number;
  pendingCertificates: number;
  // Phase E compliance gates. Any of these > 0 makes the course
  // undeletable regardless of role (backend enforces; frontend
  // surfaces a red blocker in the delete modal).
  approvedCertificates: number;
  completedEnrollments: number;
  awardedPoints: number;
  // Phase F bug 3: paid-payment split. Cancel modal shows the total
  // + a specific warning when bankTransferPaidPayments > 0.
  paidPayments: number;
  bankTransferPaidPayments: number;
}

export interface CourseDeleteImpactResponse {
  id: string;
  title: string;
  status: string;
  impact: CourseDeleteImpact;
}

// Cancel-course backend response — surfaced in the admin toast after
// a successful cancellation so the admin sees exactly what happened.
export interface CancelCourseResponse {
  cancelledAt: string;
  variant: 'pre_start' | 'post_start';
  refundsIssued: number;
  refundsPendingBankTransfer: number;
  refundsFailed: number;
  // Phase C: paid rows deferred to finance-manual review (post-start only).
  refundsDeferred: number;
  paymentsCancelled: number;
  enrollmentsDropped: number;
  sessionsCancelled: number;
  waitlistCleared: number;
  // Phase C: post-start cascade counts.
  attendanceCancelled: number;
  certificatesRevoked: number;
  pointsReversed: number;
  studentsNotified: number;
}

// Reschedule-course backend response (Phase D). Powers the admin toast
// after a successful reschedule.
export interface RescheduleCourseResponse {
  rescheduledAt: string;
  variant: 'shift' | 'revive';
  newStartDate: string;
  newEndDate: string | null;
  originalStartDate: string | null;
  sessionsShifted: number;
  sessionsFailed: number;
  zoomUpdatesFailed: number;
  studentsNotified: number;
  revivedFromCancelled: boolean;
  droppedEnrollmentsPreserved: number;
}

export interface DeletedCourseEntry {
  id: string;
  title: string;
  status: string;
  deliveryType: string;
  deletedAt: string | null;
  instructor: { id: string; name: string | null; email: string | null } | null;
  manager: { id: string; name: string | null; email: string | null } | null;
  deletedBy: { id: string; name: string | null; email: string | null } | null;
}

export interface DeletedCoursesResponse {
  items: DeletedCourseEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RestoreCourseResponse {
  ok: boolean;
  id: string;
  title: string;
  status: string;
  impact: CourseDeleteImpact;
}

export interface RestoreCloneEntry {
  id: string;
  backupId: string | null;
  backupCreatedAt: string | null;
  backupMode: string | null;
  backupObject: string | null;
  dbName: string;
  status:
    | 'creating'
    | 'importing'
    | 'ready'
    | 'failed'
    | 'dropped'
    | 'expired';
  error: string | null;
  createdAt: string;
  expiresAt: string;
  droppedAt: string | null;
  createdBy: { name: string | null; email: string | null };
  cloudStudioUrl: string;
}

export interface RestoreClonesResponse {
  items: RestoreCloneEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  caps: {
    maxConcurrent: number;
    defaultLifetimeHours: number;
    maxLifetimeHours: number;
  };
}

export interface DeletedMaterialEntry {
  id: string;
  courseId: string;
  courseTitle: string | null;
  moduleId: string | null;
  moduleTitle: string | null;
  title: string;
  type: 'video' | 'pdf' | 'document' | 'image' | string;
  fileSize: number | null;
  mimeType: string | null;
  deletedAt: string | null;
  deletedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

export interface DeletedMaterialsResponse {
  items: DeletedMaterialEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RestoreMaterialResponse {
  ok: boolean;
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  restored: Array<{ kind: string; path: string }>;
  failed: Array<{ kind: string; path: string; reason: string }>;
}

export interface BackupAuditEntry {
  id: string;
  /** 'backup' (DB or files exports) or 'website_rollback'. */
  entityType: string;
  entityId: string;
  /** e.g. 'backup.created', 'website.rollback_completed'. */
  action: string;
  performedBy: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  performerFirstName: string | null;
  performerLastName: string | null;
  performerEmail: string | null;
}

export interface BackupAuditResponse {
  data: BackupAuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DeletedFileEntry {
  /** Full GCS bucket name (e.g. physioguidance-private). */
  bucket: string;
  /** Short label: public | private | trainers | cms. */
  bucketLabel: string;
  /** Full object path inside the bucket. */
  name: string;
  /** GCS generation number; required for the restore call. */
  generation: string;
  size: number | null;
  /** When the object was deleted (ISO timestamp). */
  deletedAt: string | null;
  contentType: string | null;
}

export interface DeletedFilesResponse {
  available: boolean;
  items: DeletedFileEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
}

// ===========================================
// Website Recovery API (Cloud Run revisions + rollback)
// ===========================================
export interface WebsiteRecoveryConfig {
  enabled: boolean;
  service: string;
  region: string;
  /** The exact string the admin must type into the confirm modal. */
  confirmDomain: string;
}

export interface WebsiteRevision {
  /** Fully-qualified revision resource name. */
  name: string;
  /** Short revision id, used as the rollback target. */
  shortName: string;
  createdAt: string | null;
  image: string | null;
  /** Live traffic percentage on this revision (0 or 100 in our deploy model). */
  percent: number;
  isLive: boolean;
  /** Whole days since the revision was created — used to warn on old rollbacks. */
  ageDays: number | null;
}

export interface WebsiteRevisionsResponse {
  available: boolean;
  items: WebsiteRevision[];
  currentRevision: string | null;
  service: string;
  region: string;
  error?: string;
}

export interface WebsiteRollbackResult {
  ok: boolean;
  correlationId: string;
  targetRevision: string;
  previousRevision: string | null;
  operation: string | null;
  durationMs: number;
}

export const websiteRecoveryAdminApi = {
  getConfig: () =>
    api.get<WebsiteRecoveryConfig>('/admin/backups/website/config'),
  listRevisions: () =>
    api.get<WebsiteRevisionsResponse>('/admin/backups/website/revisions'),
  rollback: (revisionName: string, confirmDomain: string) =>
    api.post<WebsiteRollbackResult>('/admin/backups/website/rollback', {
      revisionName,
      confirmDomain,
    }),
};

// ===========================================
// Templates API (admin-editable email + WhatsApp messages)
// ===========================================
export type TemplateChannel = 'email' | 'whatsapp';
export type TemplateCategory =
  | 'account'
  | 'applications'
  | 'enrollment'
  | 'sessions'
  | 'webinars'
  | 'certificates'
  | 'assessments'
  | 'content'
  | 'whatsapp';
export type TemplateLocale = 'en' | 'ar';

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export interface TemplateMeta {
  eventKey: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  variables: TemplateVariable[];
  defaultSubjectEn?: string;
  defaultSubjectAr?: string;
}

export interface TemplateListItem extends TemplateMeta {
  edited: boolean;
  lastUpdatedAt: string | null;
  enabled: boolean;
}

export interface TemplateDetail {
  meta: TemplateMeta;
  locale: TemplateLocale;
  subject: string | null;
  preheader: string | null;
  body: string;
  designJson: unknown | null;
  enabled: boolean;
  hasOverride: boolean;
  updatedAt: string | null;
}

export const templatesApi = {
  list: () => api.get<TemplateListItem[]>('/admin/templates'),

  get: (eventKey: string, locale: TemplateLocale) =>
    api.get<TemplateDetail>(`/admin/templates/${eventKey}/${locale}`),

  upsert: (
    eventKey: string,
    locale: TemplateLocale,
    data: {
      subject?: string | null;
      preheader?: string | null;
      body: string;
      designJson?: unknown | null;
      enabled?: boolean;
    },
  ) =>
    api.put<TemplateDetail>(`/admin/templates/${eventKey}/${locale}`, data),

  reset: (eventKey: string, locale: TemplateLocale) =>
    api.delete<void>(`/admin/templates/${eventKey}/${locale}`),

  /**
   * Send a rendered test of this template to the current admin's own
   * email. Uses registry sample variables so what lands in the inbox
   * looks like a real production email.
   *
   * `usedOverride` tells the UI whether the send used the admin-saved
   * row (true) or the shipped-code default (false) — so the admin can
   * confirm their edit actually took effect.
   */
  testSend: (eventKey: string, locale: TemplateLocale) =>
    api.post<{ ok: true; to: string; usedOverride: boolean }>(
      `/admin/templates/${eventKey}/${locale}/test-send`,
      {},
    ),
};

// ===========================================
// Public Locale Settings (unauthenticated)
// Used by middleware, root layout, marketing pages
// ===========================================
export interface PublicLocaleSettings {
  allowedLanguages: ('en' | 'ar')[];
  defaultLanguage: 'en' | 'ar' | 'auto';
  dateFormat: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
  numberSystem: 'western' | 'arabic_indic';
}

export interface PublicGeneralSettings {
  platformName: string | null;
  platformNameAr: string | null;
  contactEmail: string | null;
  supportPhone: string | null;
  timezone: string | null;
  whatsappNumber: string | null;
  whatsappCompanyName: string | null;
  whatsappGreeting: string | null;
  whatsappReplyTime: string | null;
}

export interface PublicPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

export interface PublicMaintenanceStatus {
  enabled: boolean;
  messageEn: string;
  messageAr: string;
}

export const publicSettingsApi = {
  getLocaleSettings: () =>
    api.get<PublicLocaleSettings>('/public/locale-settings', { skipAuth: true }),

  getGeneralSettings: () =>
    api.get<PublicGeneralSettings>('/public/general-settings', { skipAuth: true }),

  getPasswordPolicy: () =>
    api.get<PublicPasswordPolicy>('/public/password-policy', { skipAuth: true }),

  getMaintenanceStatus: () =>
    api.get<PublicMaintenanceStatus>('/public/maintenance-status', { skipAuth: true }),

  getWhatsAppTemplate: (eventKey: string, locale: 'en' | 'ar') =>
    api.get<{ body: string | null; enabled: boolean }>(
      `/public/whatsapp-template/${eventKey}/${locale}`,
      { skipAuth: true },
    ),

  getNotificationChannels: () =>
    api.get<{ email: boolean; whatsapp: boolean }>(
      '/public/notification-channels',
      { skipAuth: true },
    ),
};

// ===========================================
// Service status API (public read + admin write)
// ===========================================

export type ServiceStatusComponentStatus =
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance';

export type ServiceStatusIncidentStatus =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved';

export type ServiceStatusCheckType = 'manual' | 'internal_db' | 'statuspage';

export type ServiceStatusComponent = {
  key: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  currentStatus: ServiceStatusComponentStatus;
  currentMessageEn: string | null;
  currentMessageAr: string | null;
  displayOrder: number;
  isActive?: boolean;
  updatedAt: string;
  // Auto-detection layer (migration 0063). Public reads expose
  // `checkType`, `autoCheckedAt`, and `isManualOverride` so the
  // page can render "Last checked X · pinned by admin" without
  // a second round-trip. Admin reads include the full picture.
  checkType?: ServiceStatusCheckType;
  checkConfig?: Record<string, unknown> | null;
  autoStatus?: ServiceStatusComponentStatus | null;
  autoCheckedAt?: string | null;
  autoError?: string | null;
  isManualOverride?: boolean;
  manualOverrideStatus?: ServiceStatusComponentStatus | null;
  manualOverrideSetAt?: string | null;
  manualOverrideSetBy?: string | null;
};

export type ServiceStatusIncidentUpdate = {
  id: string;
  incidentId: string;
  status: ServiceStatusIncidentStatus;
  messageEn: string;
  messageAr: string | null;
  postedAt: string;
  postedBy: string | null;
};

export type ServiceStatusIncident = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  affectedComponents: string[];
  currentStatus: ServiceStatusIncidentStatus;
  severity: 'minor' | 'major' | 'critical';
  audience?: 'internal' | 'end_users';
  affectedRoles?: string[];
  rootCause?: string | null;
  correctiveActions?: string | null;
  linkedResolutionStrategy?:
    | 'soft_resolve'
    | 'auto_close'
    | 'leave_open'
    | null;
  startedAt: string;
  resolvedAt: string | null;
  updates: ServiceStatusIncidentUpdate[];
  linkedTicketsCount?: number;
};

export type IncidentBannerEntry = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  severity: 'minor' | 'major' | 'critical';
  currentStatus: ServiceStatusIncidentStatus;
  startedAt: string;
  latestUpdate: ServiceStatusIncidentUpdate | null;
};

export type LinkedTicketSummary = {
  ticketId: string;
  referenceNumber: string;
  subject: string;
  status: string;
  priority: string;
  studentId: string | null;
  linkedAt: string;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail?: string | null;
};

export type IncidentForTicket = {
  incidentId: string;
  titleEn: string;
  titleAr: string | null;
  severity: 'minor' | 'major' | 'critical';
  currentStatus: ServiceStatusIncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  linkedAt: string;
};

export type ActiveIncidentForLink = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  severity: 'minor' | 'major' | 'critical';
  currentStatus: ServiceStatusIncidentStatus;
  audience?: 'internal' | 'end_users';
  startedAt: string;
  linkedTicketsCount?: number;
};

export type IncidentReport = {
  incident: ServiceStatusIncident;
  updates: ServiceStatusIncidentUpdate[];
  linkedTickets: LinkedTicketSummary[];
  affectedUsersCount: number;
};

export type IncidentAffectedRole =
  | 'STUDENT'
  | 'INSTRUCTOR'
  | 'MANAGER'
  | 'TEACHING_ASSISTANT'
  | 'FINANCE';

export type ServiceStatusPublicResponse = {
  overallStatus: 'operational' | 'degraded' | 'down' | 'maintenance';
  components: ServiceStatusComponent[];
  activeIncidents: ServiceStatusIncident[];
  recentResolvedIncidents: ServiceStatusIncident[];
  generatedAt: string;
};

export type StatusHistoryIncident = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  severity: 'minor' | 'major' | 'critical';
  affectedComponents: string[];
  startedAt: string;
  resolvedAt: string;
  durationMinutes: number;
  latestUpdate: ServiceStatusIncidentUpdate | null;
};

export type StatusHistoryResponse = {
  incidents: StatusHistoryIncident[];
  page: number;
  pageSize: number;
  total: number;
};

export type StatusPublicSummary = {
  windowDays: number;
  incidentCount: number;
  avgResolutionMinutes: number;
};

export type StatusAnalytics = {
  range: { from: string; to: string };
  views: { total: number; uniqueSessions: number };
  incidents: {
    total: number;
    resolved: number;
    bySeverity: { minor: number; major: number; critical: number };
  };
  affectedUsersTotal: number;
  resolutionMinutes: { avg: number; median: number };
  topComponents: { component: string; count: number }[];
  monthlyTrend: {
    month: string;
    minor: number;
    major: number;
    critical: number;
    total: number;
  }[];
};

export const serviceStatusApi = {
  // Public — no auth, used by /[locale]/status
  getPublic: () =>
    api.get<ServiceStatusPublicResponse>('/public/service-status', {
      skipAuth: true,
    }),

  // Public — no auth, lightweight view tracker for the status page
  recordStatusView: (incidentId?: string) =>
    api.post<{ ok: true }>(
      `/public/service-status/view`,
      { incidentId },
      { skipAuth: true },
    ),

  // Public — small "last 30 days" stats for the /status footer
  getPublicSummary: () =>
    api.get<StatusPublicSummary>(`/public/service-status/summary`, {
      skipAuth: true,
    }),

  // Admin — full analytics rollup for the dashboard
  getAnalytics: (params: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    const qs = sp.toString();
    return api.get<StatusAnalytics>(
      `/admin/service-status/analytics${qs ? `?${qs}` : ''}`,
    );
  },

  // Admin — CSV export URL builder (callers redirect to this so the
  // browser handles the file download flow)
  exportIncidentsCsvUrl: (params: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    const qs = sp.toString();
    const base =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
    return `${base}/admin/service-status/incidents/export.csv${qs ? `?${qs}` : ''}`;
  },

  // Public — no auth, paginated archive used by /[locale]/status/history
  getPublicHistory: (params: {
    page?: number;
    pageSize?: number;
    from?: string;
    to?: string;
    severity?: 'minor' | 'major' | 'critical';
    component?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    if (params.severity) sp.set('severity', params.severity);
    if (params.component) sp.set('component', params.component);
    const qs = sp.toString();
    return api.get<StatusHistoryResponse>(
      `/public/service-status/history${qs ? `?${qs}` : ''}`,
      { skipAuth: true },
    );
  },

  // Admin
  listComponents: () =>
    api.get<ServiceStatusComponent[]>('/admin/service-status/components'),

  updateComponent: (
    key: string,
    data: {
      currentStatus: ServiceStatusComponentStatus;
      currentMessageEn?: string;
      currentMessageAr?: string;
    },
  ) =>
    api.put<{ success: true }>(
      `/admin/service-status/components/${encodeURIComponent(key)}`,
      data,
    ),

  clearComponentOverride: (key: string) =>
    api.post<{ success: true; alreadyAuto?: boolean }>(
      `/admin/service-status/components/${encodeURIComponent(key)}/clear-override`,
      {},
    ),

  listIncidents: (status?: 'active' | 'resolved' | 'all') => {
    const sp = new URLSearchParams();
    if (status) sp.set('status', status);
    const qs = sp.toString();
    return api.get<ServiceStatusIncident[]>(
      `/admin/service-status/incidents${qs ? `?${qs}` : ''}`,
    );
  },

  createIncident: (data: {
    titleEn: string;
    titleAr?: string;
    affectedComponents: string[];
    severity: 'minor' | 'major' | 'critical';
    initialStatus: ServiceStatusIncidentStatus;
    initialMessageEn: string;
    initialMessageAr?: string;
    audience?: 'internal' | 'end_users';
    affectedRoles?: IncidentAffectedRole[];
  }) => api.post<ServiceStatusIncident>('/admin/service-status/incidents', data),

  postIncidentUpdate: (
    incidentId: string,
    data: {
      status: ServiceStatusIncidentStatus;
      messageEn: string;
      messageAr?: string;
      linkedResolutionStrategy?: 'soft_resolve' | 'auto_close' | 'leave_open';
      notifyAudience?: boolean;
    },
  ) =>
    api.post<{ success: true }>(
      `/admin/service-status/incidents/${incidentId}/updates`,
      data,
    ),

  deleteIncident: (incidentId: string) =>
    api.delete<{ success: true }>(
      `/admin/service-status/incidents/${incidentId}`,
    ),

  // ─── Post-mortem ────────────────────────────────────────────
  getIncidentReport: (incidentId: string) =>
    api.get<IncidentReport>(
      `/admin/service-status/incidents/${incidentId}/report`,
    ),

  updateIncidentReport: (
    incidentId: string,
    data: { rootCause?: string; correctiveActions?: string },
  ) =>
    api.patch<{ success: true }>(
      `/admin/service-status/incidents/${incidentId}/report`,
      data,
    ),

  listTicketsForIncident: (incidentId: string) =>
    api.get<LinkedTicketSummary[]>(
      `/admin/service-status/incidents/${incidentId}/tickets`,
    ),

  // ─── Cross-dashboard banner + support-side linking ──────────
  //
  // These hit the authed (non-admin) routes so any logged-in user
  // can read the banner feed, and support agents can link tickets.

  listBannerIncidents: () =>
    api.get<IncidentBannerEntry[]>(`/service-status/banner-incidents`),

  listActiveForLink: () =>
    api.get<ActiveIncidentForLink[]>(`/service-status/active-for-link`),

  linkTicketToIncident: (incidentId: string, ticketId: string) =>
    api.post<{ success: true }>(
      `/service-status/incidents/${incidentId}/link-ticket`,
      { ticketId },
    ),

  unlinkTicketFromIncident: (incidentId: string, ticketId: string) =>
    api.delete<{ success: true }>(
      `/service-status/incidents/${incidentId}/link-ticket/${ticketId}`,
    ),

  listIncidentsForTicket: (ticketId: string) =>
    api.get<IncidentForTicket[]>(
      `/service-status/tickets/${ticketId}/incidents`,
    ),

  // Support-scoped — same payload as the admin endpoint but reachable
  // by support staff. Used by the SupportActiveIncidentsBar expand row.
  listTicketsForIncidentSupport: (incidentId: string) =>
    api.get<LinkedTicketSummary[]>(
      `/service-status/incidents/${incidentId}/tickets`,
    ),
};

// ===========================================
// Scheduled Maintenance API
// ===========================================
export type ScheduledMaintenanceStatus =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'cancelled';

export type ScheduledMaintenanceWindow = {
  id: string;
  titleEn: string;
  titleAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  affectedComponents: string[];
  startAt: string;
  endAt: string;
  preNotificationLeadMinutes: number;
  preNotificationSentAt: string | null;
  status: ScheduledMaintenanceStatus;
  createdBy: string | null;
  createdAt: string;
};

export const scheduledMaintenanceApi = {
  // Admin CRUD
  list: (status?: ScheduledMaintenanceStatus) => {
    const sp = new URLSearchParams();
    if (status) sp.set('status', status);
    const qs = sp.toString();
    return api.get<ScheduledMaintenanceWindow[]>(
      `/admin/maintenance/windows${qs ? `?${qs}` : ''}`,
    );
  },

  nextUpcoming: () =>
    api.get<ScheduledMaintenanceWindow | null>(
      `/admin/maintenance/windows/next-upcoming`,
    ),

  create: (data: {
    titleEn: string;
    titleAr?: string;
    descriptionEn?: string;
    descriptionAr?: string;
    affectedComponents?: string[];
    startAt: string;
    endAt: string;
    preNotificationLeadMinutes?: number;
  }) =>
    api.post<ScheduledMaintenanceWindow>(`/admin/maintenance/windows`, data),

  update: (
    id: string,
    data: Partial<{
      titleEn: string;
      titleAr: string;
      descriptionEn: string;
      descriptionAr: string;
      affectedComponents: string[];
      startAt: string;
      endAt: string;
      preNotificationLeadMinutes: number;
    }>,
  ) => api.patch<{ success: true }>(`/admin/maintenance/windows/${id}`, data),

  cancel: (id: string) =>
    api.delete<{ success: true }>(`/admin/maintenance/windows/${id}`),

  // Authed banner read — returns the single currently-relevant
  // window (active or within lead time), or null.
  banner: () =>
    api.get<ScheduledMaintenanceWindow | null>(`/maintenance/banner`),
};

// ===========================================
// Materials API (content management)
// ===========================================
export const materialsApi = {
  list: (courseId: string, params?: { type?: string; status?: string; moduleId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.type && params.type !== 'all') sp.set('type', params.type);
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.moduleId) sp.set('moduleId', params.moduleId);
    const qs = sp.toString();
    return api.get<CourseMaterialResponse[]>(`/courses/${courseId}/materials${qs ? `?${qs}` : ''}`);
  },

  upload: (courseId: string, file: File, title: string, type: string, moduleId?: string, autoTranscribe?: boolean) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    fd.append('type', type);
    if (moduleId) fd.append('moduleId', moduleId);
    if (autoTranscribe !== undefined) fd.append('autoTranscribe', String(autoTranscribe));
    return uploadFormData<CourseMaterialResponse>(`/courses/${courseId}/materials`, fd);
  },

  uploadWithProgress: (
    courseId: string,
    file: File,
    title: string,
    type: string,
    onProgress: (percent: number) => void,
    moduleId?: string,
    autoTranscribe?: boolean,
  ): Promise<CourseMaterialResponse> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/courses/${courseId}/materials`);

      const token = getAccessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const deviceId = getDeviceId();
      if (deviceId) xhr.setRequestHeader('X-Device-Id', deviceId);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(parseUploadError(xhr.status, xhr.responseText));
        }
      };

      xhr.onerror = () =>
        reject(new UploadError({ status: 'network', code: 'network', serverMessage: null }));

      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      fd.append('type', type);
      if (moduleId) fd.append('moduleId', moduleId);
      if (autoTranscribe !== undefined) fd.append('autoTranscribe', String(autoTranscribe));
      xhr.send(fd);
    });
  },

  update: (materialId: string, data: { title?: string; moduleId?: string | null; wcagStatus?: string; captionsUrl?: string; transcriptUrl?: string; autoTranscribe?: boolean }) =>
    api.patch<CourseMaterialResponse>(`/materials/${materialId}`, data),

  assignToModule: (materialId: string, moduleId: string) =>
    api.patch<CourseMaterialResponse>(`/materials/${materialId}`, { moduleId }),

  unlinkFromModule: (materialId: string) =>
    api.patch<CourseMaterialResponse>(`/materials/${materialId}`, { moduleId: null }),

  listUnassigned: (courseId: string) =>
    api.get<CourseMaterialResponse[]>(`/courses/${courseId}/materials?moduleId=none`),

  reorderInModule: (courseId: string, moduleId: string, materialIds: string[]) =>
    api.patch<{ message: string }>(`/courses/${courseId}/modules/${moduleId}/materials/reorder`, { materialIds }),

  replace: (materialId: string, file: File, title?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);
    return uploadFormData<CourseMaterialResponse>(`/materials/${materialId}/replace`, fd);
  },

  replaceWithProgress: (
    materialId: string,
    file: File,
    onProgress: (percent: number) => void,
    title?: string,
  ): Promise<CourseMaterialResponse> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/materials/${materialId}/replace`);

      const token = getAccessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const deviceId = getDeviceId();
      if (deviceId) xhr.setRequestHeader('X-Device-Id', deviceId);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(parseUploadError(xhr.status, xhr.responseText));
        }
      };

      xhr.onerror = () =>
        reject(new UploadError({ status: 'network', code: 'network', serverMessage: null }));

      const fd = new FormData();
      fd.append('file', file);
      if (title) fd.append('title', title);
      xhr.send(fd);
    });
  },

  delete: (materialId: string) =>
    api.delete<{ message: string }>(`/materials/${materialId}`),

  getStatus: (materialId: string) =>
    api.get<{
      id: string;
      status: string;
      processingStep: string | null;
      wcagStatus: string;
      captionsUrl: string | null;
      transcriptUrl: string | null;
      processingError: string | null;
    }>(`/materials/${materialId}/status`),

  getVariants: (materialId: string) =>
    api.get<import('@/types/instructor-dashboard').MaterialVariant[]>(`/materials/${materialId}/variants`),

  // ── Watch Analytics (Feature 7) ──
  getWatchAnalytics: (materialId: string) =>
    api.get<{
      totalViewers: number;
      bucketSize: number;
      retention: { bucket: number; viewers: number; percent: number }[];
      dropOffPoints: { bucket: number; drop: number }[];
    }>(`/materials/${materialId}/watch-analytics`),

  // ── Captions (Feature 5) ──
  getCaptions: (materialId: string) =>
    api.get<{ entries: { startTime: string; endTime: string; text: string }[]; raw: string }>(`/materials/${materialId}/captions`),

  saveCaptions: (materialId: string, entries: { startTime: string; endTime: string; text: string }[]) =>
    api.put<CourseMaterialResponse>(`/materials/${materialId}/captions`, { entries }),

  uploadCaptionFile: (materialId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFormData<CourseMaterialResponse>(`/materials/${materialId}/captions/upload`, fd);
  },

  // ── Version History (Feature 6) ──
  getVersionHistory: (materialId: string) =>
    api.get<Array<{ id: string; version: number; title: string; fileSize: number | null; mimeType: string | null; status: string; createdAt: string; isCurrent: boolean }>>(`/materials/${materialId}/versions`),

  rollback: (materialId: string, versionId: string) =>
    api.post<CourseMaterialResponse>(`/materials/${materialId}/rollback/${versionId}`, {}),
};

// ===========================================
// Reports API (binary file download)
// ===========================================
export type ReportType =
  | 'attendance'
  | 'gradebook'
  | 'enrollment'
  | 'completion'
  | 'cme-eligibility'
  | 'webinar-registrants'
  | 'satisfaction'
  | 'instructor-performance'
  | 'nelc-compliance'
  | 'course-catalog'
  | 'revenue';
export type ReportFormat = 'csv' | 'pdf' | 'xlsx';

export const reportsApi = {
  /**
   * Download a report as a binary file.
   * Triggers browser download automatically.
   */
  download: async (
    type: ReportType,
    params: { courseId?: string; sessionId?: string; format?: ReportFormat; dateFrom?: string; dateTo?: string },
  ): Promise<void> => {
    const sp = new URLSearchParams();
    if (params.courseId) sp.set('courseId', params.courseId);
    if (params.sessionId) sp.set('sessionId', params.sessionId);
    if (params.format) sp.set('format', params.format);
    if (params.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params.dateTo) sp.set('dateTo', params.dateTo);
    // Send user's local timezone so export formats dates correctly
    try { sp.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* fallback to server default */ }
    const qs = sp.toString();

    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const deviceId = getDeviceId();
    if (deviceId) headers['X-Device-Id'] = deviceId;

    const response = await fetch(
      `${API_URL}/instructor/reports/${type}${qs ? `?${qs}` : ''}`,
      { method: 'GET', headers, credentials: 'include' },
    );

    if (!response.ok) {
      // Try to parse JSON error
      const ct = response.headers.get('content-type');
      if (ct?.includes('application/json')) {
        const data = await response.json();
        throw new ApiError(response.status, data.message || 'Report generation failed');
      }
      throw new ApiError(response.status, 'Report generation failed');
    }

    // Extract filename from Content-Disposition header
    const disposition = response.headers.get('content-disposition');
    let filename = `report.${params.format || 'csv'}`;
    if (disposition) {
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      if (match) filename = match[1];
    }

    // Download the blob
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Scheduled Reports CRUD
  getScheduled: () =>
    api.get<Array<{
      id: string;
      userId: string;
      reportType: string;
      format: string;
      courseId: string | null;
      frequency: string;
      enabled: boolean;
      lastRunAt: string | null;
      nextRunAt: string | null;
      recipientEmail: string | null;
      createdAt: string;
    }>>('/instructor/reports/scheduled'),

  createScheduled: (data: { reportType: string; format?: string; courseId?: string; frequency: string; recipientEmail?: string }) =>
    api.post<{ id: string }>('/instructor/reports/scheduled', data),

  updateScheduled: (id: string, data: { enabled?: boolean; frequency?: string; format?: string }) =>
    api.patch<{ id: string }>(`/instructor/reports/scheduled/${id}`, data),

  deleteScheduled: (id: string) =>
    api.delete<{ message: string }>(`/instructor/reports/scheduled/${id}`),
};

// ===========================================
// Course Manager Dashboard API
// ===========================================

export interface InstructorListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar?: string | null;
  status?: 'available' | 'busy' | 'overloaded' | 'on_leave';
  coursesCount?: number;
  hoursThisWeek?: number;
  avgRating?: number;
}

export interface CreateCourseManagerData {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  deliveryType: 'zoom' | 'onsite' | 'blended' | 'self-paced' | 'webinar';
  thumbnail?: string;
  maxEnrollment?: number;
  cmeHours?: number;
  isCmeAccredited?: boolean;
  startDate?: string;
  endDate?: string;
  instructorId: string;
  cohort?: string;
  accreditationNumber?: string;
  nelcReviewLink?: string;
  overview?: string;
  overviewAr?: string;
  objectives?: string[];
  objectivesAr?: string[];
  features?: string[];
  featuresAr?: string[];
  targetAudience?: string[];
  targetAudienceAr?: string[];
  faqs?: Array<{
    question?: string;
    questionAr?: string;
    answer?: string;
    answerAr?: string;
  }>;
  requirements?: string;
  requirementsAr?: string;
  notices?: string;
  noticesAr?: string;
  price?: number;
  // Course-level sale (no coupon needed). salePercent 1..100; null clears it.
  salePercent?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  saleAllowsCoupon?: boolean;
  venue?: string;
  venueAr?: string;
  enrollmentDeadline?: string;
  language?: string;
  showContents?: boolean;
  sectionsOrder?: string[];
  visibleOnPublicSite?: boolean;
  /** Webinar Course only — surface the post-event recording in students' dashboards. */
  recordingShareEnabled?: boolean;
}

export interface SessionsParams {
  dateRange?: string;
  status?: string;
  courseId?: string;
  page?: number;
  limit?: number;
}

export interface SessionsResponse {
  data: CourseSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AssessmentsParams {
  courseId?: string;
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface AssessmentsResponse {
  data: AssessmentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const courseManagerApi = {
  // Get all courses (manager sees all)
  getCourses: (params?: InstructorCoursesParams) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.delivery && params.delivery !== 'all') sp.set('delivery', params.delivery);
    if (params?.search) sp.set('search', params.search);
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<InstructorCoursesResponse>(`/courses${qs ? `?${qs}` : ''}`);
  },

  // Create a new course (with instructorId assignment)
  createCourse: (data: CreateCourseManagerData) =>
    api.post<CourseDetailResponse>('/courses', data),

  // Upload course thumbnail image
  uploadThumbnail: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFormData<{ url: string; filename: string }>('/storage/upload', fd);
  },

  // Get list of instructors for dropdown
  getInstructors: () =>
    api.get<InstructorListItem[]>('/auth/instructors'),

  // Get list of available TAs for dropdown (uses course-assistants available endpoint)
  getAvailableTAs: () =>
    api.get<Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }>>('/courses/_/assistants/available'),

  // Sessions
  getSessions: (params?: SessionsParams & { instructorId?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateRange) sp.set('dateRange', params.dateRange);
    if (params?.status) sp.set('status', params.status);
    if (params?.courseId) sp.set('courseId', params.courseId);
    if (params?.instructorId) sp.set('instructorId', params.instructorId);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<SessionsResponse>(`/sessions${qs ? `?${qs}` : ''}`);
  },

  createSession: (data: Record<string, unknown>) =>
    api.post<CourseSession>('/sessions', data),

  updateSession: (sessionId: string, data: Record<string, unknown>) =>
    api.patch<CourseSession>(`/sessions/${sessionId}`, data),

  getUpcomingSessions: () =>
    api.get<CourseSession[]>('/sessions/upcoming'),

  // Webinar — registrants list and license precheck
  getWebinarRegistrants: (sessionId: string) =>
    api.get<{
      sessionId: string;
      zoomWebinarId: string | null;
      registrationUrl: string | null;
      totalRegistered: number;
      totalAttended: number;
      registrants: Array<{
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        nationalId: string | null;
        scfhsNumber: string | null;
        zoomRegistrantId: string | null;
        joinUrl: string | null;
        status: string;
        userId: string | null;
        attended: boolean;
        joinedAt: string | null;
        leftAt: string | null;
        attendedDurationMinutes: number;
        createdAt: string;
        source: 'platform' | 'external';
      }>;
    }>(`/sessions/${sessionId}/registrants`),

  checkWebinarLicense: (email: string) =>
    api.get<{
      userExists: boolean;
      hasWebinarLicense: boolean;
      userType: number | null;
      error?: string;
    }>(`/zoom/check-webinar-license?email=${encodeURIComponent(email)}`),

  getWebinarStartUrl: (sessionId: string) =>
    api.get<{ startUrl: string; joinUrl: string; hostEmail: string | null }>(
      `/sessions/${sessionId}/webinar-start`,
    ),

  reconfigureWebinarQuestions: (sessionId: string) =>
    api.post<{ ok: boolean; webinarId: string }>(
      `/sessions/${sessionId}/reconfigure-webinar-questions`,
      {},
    ),

  getSessionConflicts: () =>
    api.get<Array<{
      sessionA: { id: string; title: string; scheduledAt: string; durationMinutes: number };
      sessionB: { id: string; title: string; scheduledAt: string; durationMinutes: number };
      instructorName: string;
      instructorId: string;
    }>>('/sessions/conflicts'),

  // View attendance for a session
  getSessionAttendance: (sessionId: string) =>
    api.get<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`),

  // Session oversight actions
  cancelSessionOnBehalf: (sessionId: string, reason: string) =>
    api.post(`/sessions/${sessionId}/cancel-on-behalf`, { reason }),

  rescheduleSession: (sessionId: string, newScheduledAt: string, durationMinutes?: number) =>
    api.post(`/sessions/${sessionId}/reschedule`, { reason: "Rescheduled by manager", newScheduledAt, newDurationMinutes: durationMinutes }),

  assignSubstitute: (sessionId: string, instructorId: string) =>
    api.patch(`/sessions/${sessionId}/assign-substitute`, { instructorId }),

  getInstructorLoad: (instructorId: string, weekStart?: string) => {
    const params = weekStart ? `?weekStart=${weekStart}` : '';
    return api.get<{ instructorId: string; weekStart: string; sessionsCount: number; hoursTotal: number }>(
      `/sessions/instructor-load/${instructorId}${params}`
    );
  },

  // Instructor roster with workload metrics
  getInstructorRoster: () =>
    api.get<Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      avatar: string | null;
      department: string | null;
      specialty: string | null;
      avgRating: number | null;
      completionRate: number | null;
      coursesCount: number;
      studentsCount: number;
      sessionsThisWeek: number;
      hoursThisWeek: number;
      status: 'available' | 'busy' | 'overloaded' | 'on_leave';
      isMyInstructor?: boolean;
    }>>('/instructor/roster'),

  // Assign instructor to course
  assignInstructor: (courseId: string, instructorId: string) =>
    api.patch(`/courses/${courseId}/assign-instructor`, { instructorId }),

  // Instructor performance KPIs
  getInstructorPerformance: (instructorId: string) =>
    api.get<{
      instructor: { id: string; firstName: string | null; lastName: string | null; email: string; avatar: string | null };
      coursesCount: number;
      totalStudents: number;
      completionRate: number;
      attendanceRate: number;
      contentQuality: { approved: number; rejected: number; pending: number; total: number };
      sessions: { total: number; completed: number };
      courses: Array<{ id: string; title: string; status: string }>;
    }>(`/instructor/${instructorId}/performance`),

  // Instructor schedule (2-week view)
  getInstructorSchedule: (instructorId: string, startDate?: string, endDate?: string) => {
    const sp = new URLSearchParams();
    if (startDate) sp.set('startDate', startDate);
    if (endDate) sp.set('endDate', endDate);
    const qs = sp.toString();
    return api.get<Array<{
      id: string;
      title: string;
      courseId: string;
      courseTitle: string;
      type: string;
      scheduledAt: string | null;
      durationMinutes: number;
      status: string;
    }>>(`/sessions/instructor-schedule/${instructorId}${qs ? `?${qs}` : ''}`);
  },

  // Instructor suggestions (sorted by least-loaded)
  getInstructorSuggestions: () =>
    api.get<Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      coursesCount: number;
      studentsCount: number;
      sessionsThisWeek: number;
      hoursThisWeek: number;
      status: 'available' | 'busy' | 'overloaded';
      recommended: boolean;
    }>>('/instructor/suggestions'),

  // Dashboard summary (reuses instructor endpoint — MANAGER now has access)
  getDashboardSummary: () =>
    api.get<DashboardSummaryResponse>('/instructor/dashboard-summary'),

  // Assessments
  getAssessments: (params?: AssessmentsParams) => {
    const sp = new URLSearchParams();
    if (params?.courseId) sp.set('courseId', params.courseId);
    if (params?.type) sp.set('type', params.type);
    if (params?.status) sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<AssessmentsResponse>(`/assessments${qs ? `?${qs}` : ''}`);
  },

  // Assessment blueprint coverage
  getBlueprint: (courseId: string) =>
    api.get<{
      courseId: string;
      totalModules: number;
      coveredModules: number;
      gapModules: number;
      coveragePercent: number;
      matrix: Array<{
        moduleId: string;
        moduleTitle: string;
        orderIndex: number;
        covered: boolean;
        assessments: Array<{
          assessmentId: string;
          title: string;
          type: string;
          status: string;
          totalMarks: number;
          questionCount: number;
        }>;
      }>;
      unlinkedAssessments: Array<{
        assessmentId: string;
        title: string;
        type: string;
        status: string;
        totalMarks: number;
        questionCount: number;
      }>;
    }>(`/assessments/blueprint/${courseId}`),

  // Get submissions for an assessment
  getSubmissions: (assessmentId: string) =>
    api.get<Array<{
      id: string;
      studentId: string;
      studentFirstName: string;
      studentLastName: string;
      studentEmail: string;
      assessmentId: string;
      status: string;
      score: number | null;
      totalMarks: number | null;
      percentage: number | null;
      // Null for auto-graded "not submitted" rows
      submittedAt: string | null;
      answers?: Array<{ questionId: string; answer: string; isCorrect: boolean | null; marksAwarded: number | null }> | null;
      instructorComment?: string | null;
      // Retake grouping annotations
      attemptNumber?: number;
      totalAttempts?: number;
      isEffective?: boolean;
      hasUnusedRetakeGrant?: boolean;
    }>>(`/assessments/${assessmentId}/submissions`),

  // Get questions for an assessment (for preview)
  getAssessmentQuestions: (assessmentId: string) =>
    api.get<Array<{
      id: string;
      assessmentId: string | null;
      type: string;
      questionText: string;
      questionTextAr?: string;
      options?: Array<{ text: string; textAr?: string; isCorrect: boolean }>;
      correctAnswer?: string;
      marks: number;
      difficultyLevel?: string;
    }>>(`/assessments/${assessmentId}/questions`),

  // Grade a submission
  gradeSubmission: (assessmentId: string, submissionId: string, grades: Array<{ questionId: string; score: number; comment?: string }>, overallComment?: string) =>
    api.patch<{ message: string }>(`/assessments/${assessmentId}/submissions/${submissionId}/grade`, { grades, overallComment }),

  // Difficulty distribution for an assessment
  getDifficultyDistribution: (assessmentId: string) =>
    api.get<{
      easy: number;
      medium: number;
      hard: number;
      unset: number;
      total: number;
    }>(`/assessments/${assessmentId}/difficulty-distribution`),

  // Flag an assessment for review
  flagAssessment: (assessmentId: string, reason: string) =>
    api.post(`/assessments/${assessmentId}/flag`, { reason }),

  // Emergency override
  createOverride: (assessmentId: string, data: { studentId: string; overrideType: string; value: number; reason: string }) =>
    api.post(`/assessments/${assessmentId}/override`, data),

  // Allow a student to retake an assessment (manager only)
  allowRetake: (assessmentId: string, data: { studentId: string; reason?: string; newDueDate?: string }) =>
    api.post<{ id: string; assessmentId: string; studentId: string; createdAt: string }>(
      `/assessments/${assessmentId}/allow-retake`,
      data,
    ),

  getOverrides: (assessmentId: string) =>
    api.get<Array<{ id: string; assessmentId: string; studentId: string; overrideType: string; value: number; reason: string; grantedBy: string; expiresAt: string | null; createdAt: string; studentFirstName?: string; studentLastName?: string; granterFirstName?: string; granterLastName?: string }>>(`/assessments/${assessmentId}/overrides`),

  // Enrollments for a course
  getEnrollments: (params: { courseId: string }) =>
    api.get<CourseEnrollment[]>(`/courses/${params.courseId}/enrollments`),

  // Manager/admin — manually enrol a student. Bypasses capacity/waitlist.
  // Reason is captured in audit + on the enrollment row itself.
  manualEnrollStudent: (courseId: string, studentId: string, reason: string) =>
    api.post<CourseEnrollment>(`/courses/${courseId}/manual-enroll`, { studentId, reason }),

  // Manager/admin — remove an enrolled student. Reason is mandatory;
  // finance reads it to decide refund. Does NOT auto-refund.
  removeEnrolledStudent: (courseId: string, studentId: string, reason: string) =>
    api.delete<{ id: string; status: string }>(
      `/courses/${courseId}/enrollments/${studentId}`,
      { reason },
    ),

  // Per-course audit log for the manager/admin Audit tab. Legacy
  // per-entity endpoint (GET /audit-logs?entityType=course&entityId=...).
  // Includes create/update/duplicate/activate/archive/complete/cancel/
  // reschedule/reassign_instructor/manual_enroll/remove_enrollment/etc.
  getCourseAuditLogs: (courseId: string, page = 1, limit = 50) => {
    const sp = new URLSearchParams();
    sp.set('entityType', 'course');
    sp.set('entityId', courseId);
    sp.set('page', String(page));
    sp.set('limit', String(limit));
    return api.get<{
      data: Array<{
        id: string;
        entityType: string;
        entityId: string;
        action: string;
        performedBy: string | null;
        metadata: Record<string, unknown> | null;
        ipAddress: string | null;
        createdAt: string;
        performerFirstName: string | null;
        performerLastName: string | null;
        performerEmail: string | null;
      }>;
      total: number;
      page: number;
      limit: number;
    }>(`/audit-logs?${sp.toString()}`);
  },

  // Narrow student picker for the manual-enroll modal. Backed by
  // /auth/students-search, gated to MANAGER/ADMIN.
  searchStudents: (q: string, limit = 20) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    sp.set('limit', String(limit));
    return api.get<
      Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        scfhsNumber: string | null;
      }>
    >(`/auth/students-search?${sp.toString()}`);
  },

  // Course detail (single course with modules)
  getCourseDetail: (courseId: string) =>
    api.get<CourseDetailResponse>(`/courses/${courseId}`),

  // Update course
  updateCourse: (courseId: string, data: Record<string, unknown>) =>
    api.patch<CourseDetailResponse>(`/courses/${courseId}`, data),

  // Activate course (validates all content reviewed)
  activateCourse: (courseId: string) =>
    api.post<CourseDetailResponse>(`/courses/${courseId}/activate`, {}),

  // Deactivate (archive) an active course
  deactivateCourse: (courseId: string) =>
    api.post<CourseDetailResponse>(`/courses/${courseId}/deactivate`, {}),

  // Mark active course as completed
  completeCourse: (courseId: string) =>
    api.post<CourseDetailResponse>(`/courses/${courseId}/complete`, {}),

  // Toggle featured flag (homepage showcase)
  toggleFeatured: (courseId: string) =>
    api.patch<{ id: string; isFeatured: boolean }>(`/courses/${courseId}/feature`, {}),

  // Request changes on a course (sends back to instructor)
  requestChanges: (courseId: string, note: string) =>
    api.post<CourseDetailResponse>(`/courses/${courseId}/request-changes`, { note }),

  // Delete course (draft only)
  deleteCourse: (courseId: string) =>
    api.delete(`/courses/${courseId}`),

  // Duplicate course — clones everything except dates/enrollments; returns
  // the new draft row so the caller can navigate straight to its edit page.
  duplicateCourse: (courseId: string) =>
    api.post<{ id: string; title: string }>(`/courses/${courseId}/duplicate`, {}),

  // Content Review
  getPendingReviews: () =>
    api.get<{
      data: Array<{
        id: string;
        courseId: string;
        moduleId: string | null;
        title: string;
        type: string;
        status: string;
        fileUrl: string | null;
        fileSize: number | null;
        mimeType: string | null;
        wcagStatus: string;
        wcagDetails: string | null;
        reviewNote: string | null;
        createdAt: string;
        courseTitle: string;
        instructorFirstName: string | null;
        instructorLastName: string | null;
        instructorEmail: string;
      }>;
      stats: { pending: number; changesRequested: number; approved: number; rejected: number };
    }>('/materials/pending-review'),

  reviewMaterial: (id: string, data: { decision: 'approved' | 'rejected' | 'changes_requested'; comment?: string }) =>
    api.patch(`/materials/${id}/review`, data),

  bulkReviewMaterials: (materialIds: string[], decision: string, comment?: string) =>
    api.post<{ succeeded: number; failed: number; total: number }>('/materials/bulk-review', { materialIds, decision, comment }),

  getComplianceChecklist: (materialId: string) =>
    api.get<{
      materialId: string;
      courseId: string;
      overallStatus: 'passed' | 'review' | 'failed';
      passedCount: number;
      totalChecks: number;
      checks: Array<{
        rule: string;
        status: 'passed' | 'review' | 'failed';
        detail: string;
      }>;
    }>(`/materials/${materialId}/compliance-checklist`),

  // Course Ratings
  getAllCourseRatings: () =>
    api.get<Record<string, { avgRating: number; totalRatings: number }>>('/courses/ratings/all'),

  getManagerRatingStats: () =>
    api.get<{
      overall: {
        avgRating: number;
        totalRatings: number;
        totalCourses: number;
        coursesWithReviews: number;
      };
      topCourses: Array<{
        courseId: string;
        title: string;
        titleAr: string | null;
        avgRating: number;
        totalRatings: number;
      }>;
    }>('/courses/ratings/manager-stats'),

  getCourseRatings: (
    courseId: string,
    params?: { page?: number; limit?: number; rating?: number; sort?: 'newest' | 'oldest' | 'highest' | 'lowest'; search?: string },
  ) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.rating) sp.set('rating', String(params.rating));
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.search) sp.set('search', params.search);
    const qs = sp.toString();
    // NOTE: hits the MANAGER-view endpoint (all moderation states) so
    // the course-manager reviews page shows pending + rejected reviews
    // too. The public endpoint at /courses/:id/ratings hides those.
    return api.get<{
      data: Array<{
        id: string;
        rating: number;
        reviewText: string | null;
        createdAt: string;
        studentName: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      avgRating: number;
      totalRatings: number;
      distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
    }>(`/courses/${courseId}/ratings/manager-view${qs ? `?${qs}` : ''}`);
  },

  getCourseRatingStats: (courseId: string) =>
    api.get<{ avgRating: number; totalRatings: number }>(`/courses/${courseId}/ratings/stats`),

  // Reviews moderation (manager)
  getManagerReviews: (params?: {
    page?: number;
    limit?: number;
    moderationStatus?: 'pending' | 'approved' | 'rejected';
    publishedOnly?: boolean;
    unpublishedOnly?: boolean;
    courseId?: string;
    search?: string;
    sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
  }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.moderationStatus) sp.set('moderationStatus', params.moderationStatus);
    if (params?.publishedOnly) sp.set('publishedOnly', 'true');
    if (params?.unpublishedOnly) sp.set('unpublishedOnly', 'true');
    if (params?.courseId) sp.set('courseId', params.courseId);
    if (params?.search) sp.set('search', params.search);
    if (params?.sort) sp.set('sort', params.sort);
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        courseId: string;
        courseTitle: string;
        courseTitleAr: string | null;
        rating: number;
        reviewText: string | null;
        moderationStatus: 'pending' | 'approved' | 'rejected';
        isPublished: boolean;
        createdAt: string;
        reviewedAt: string | null;
        studentName: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      counts: { pending: number; approved: number; rejected: number };
    }>(`/courses/reviews/manager${qs ? `?${qs}` : ''}`);
  },

  approveReview: (courseId: string, ratingId: string) =>
    api.post<{ id: string }>(`/courses/${courseId}/ratings/${ratingId}/approve`, {}),

  rejectReview: (courseId: string, ratingId: string) =>
    api.post<{ id: string }>(`/courses/${courseId}/ratings/${ratingId}/reject`, {}),

  setReviewPublished: (courseId: string, ratingId: string, published: boolean) =>
    api.patch<{ id: string }>(`/courses/${courseId}/ratings/${ratingId}/publish`, { published }),

  deleteReview: (courseId: string, ratingId: string) =>
    api.delete<{ id: string }>(`/courses/${courseId}/ratings/${ratingId}`),

  // Instructor reviews — moderation list
  getManagerInstructorReviews: (params?: {
    page?: number;
    limit?: number;
    moderationStatus?: 'pending' | 'approved' | 'rejected';
    publishedOnly?: boolean;
    unpublishedOnly?: boolean;
    courseId?: string;
    search?: string;
    sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
  }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.moderationStatus) sp.set('moderationStatus', params.moderationStatus);
    if (params?.publishedOnly) sp.set('publishedOnly', 'true');
    if (params?.unpublishedOnly) sp.set('unpublishedOnly', 'true');
    if (params?.courseId) sp.set('courseId', params.courseId);
    if (params?.search) sp.set('search', params.search);
    if (params?.sort) sp.set('sort', params.sort);
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        courseId: string;
        instructorId: string;
        courseTitle: string;
        courseTitleAr: string | null;
        rating: number;
        reviewText: string | null;
        moderationStatus: 'pending' | 'approved' | 'rejected';
        isPublished: boolean;
        createdAt: string;
        reviewedAt: string | null;
        studentName: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      counts: { pending: number; approved: number; rejected: number };
    }>(`/courses/instructor-reviews/manager${qs ? `?${qs}` : ''}`);
  },

  approveInstructorReview: (courseId: string, ratingId: string) =>
    api.post<{ id: string }>(
      `/courses/${courseId}/instructor-ratings/${ratingId}/approve`,
      {},
    ),

  rejectInstructorReview: (courseId: string, ratingId: string) =>
    api.post<{ id: string }>(
      `/courses/${courseId}/instructor-ratings/${ratingId}/reject`,
      {},
    ),

  setInstructorReviewPublished: (
    courseId: string,
    ratingId: string,
    published: boolean,
  ) =>
    api.patch<{ id: string }>(
      `/courses/${courseId}/instructor-ratings/${ratingId}/publish`,
      { published },
    ),

  deleteInstructorReview: (courseId: string, ratingId: string) =>
    api.delete<{ id: string }>(
      `/courses/${courseId}/instructor-ratings/${ratingId}`,
    ),

  // Instructor reviews on a single course (for the manager course-detail switch)
  getCourseInstructorRatings: (
    courseId: string,
    params?: {
      page?: number;
      limit?: number;
      rating?: number;
      sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
      search?: string;
    },
  ) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.rating) sp.set('rating', String(params.rating));
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.search) sp.set('search', params.search);
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        rating: number;
        reviewText: string | null;
        createdAt: string;
        studentName: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      avgRating: number;
      totalRatings: number;
      distribution: Record<1 | 2 | 3 | 4 | 5, number>;
    }>(`/courses/${courseId}/instructor-ratings${qs ? `?${qs}` : ''}`);
  },

  // All approved reviews for a single instructor (manager side-sheet)
  getReviewsForInstructor: (instructorId: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return api.get<{
      data: Array<{
        id: string;
        courseId: string;
        courseTitle: string;
        courseTitleAr: string | null;
        rating: number;
        reviewText: string | null;
        createdAt: string;
        studentName: string;
      }>;
      avgRating: number;
      totalRatings: number;
    }>(`/instructor/${instructorId}/reviews${qs}`);
  },

  // Course Materials (manager access)
  getCourseMaterials: (courseId: string, moduleId?: string) =>
    api.get<Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      fileUrl: string | null;
      fileSize: number | null;
      mimeType: string | null;
      moduleId: string | null;
      wcagStatus: string | null;
      createdAt: string;
      uploadedBy: string;
    }>>(`/courses/${courseId}/materials${moduleId ? `?moduleId=${moduleId}` : ''}`),

  removeMaterial: (materialId: string, reason?: string) =>
    api.delete<{ message: string }>(`/materials/${materialId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`),

  // Certificates (manager sees only courses where managerId = their userId).
  // Admin callers can additionally pass managerId + search to filter across
  // all managers; both are ignored by the backend when the caller is not
  // a global admin.
  getCertificates: (params?: {
    courseId?: string;
    status?: string;
    page?: number;
    limit?: number;
    managerId?: string;
    search?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.courseId && params.courseId !== 'all') sp.set('courseId', params.courseId);
    // Send status even when it's "all" — the backend treats "all" as
    // "no status filter" but treats an ABSENT status as "default to
    // pending". Stripping "all" here meant callers who wanted every
    // status silently got pending-only. Callers that legitimately want
    // pending-only should NOT pass any status (backward compatible).
    if (params?.status) sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.managerId) sp.set('managerId', params.managerId);
    if (params?.search) sp.set('search', params.search);
    const qs = sp.toString();
    return api.get<CertificateListResponse>(`/instructor/certificates${qs ? `?${qs}` : ''}`);
  },

  getCertificateDetail: (id: string) =>
    api.get<CertificateRequestResponse>(`/certificates/${id}`),

  approveCertificate: (id: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/approve`, {}),

  rejectCertificate: (id: string, note: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/reject`, { note }),

  holdCertificate: (id: string, note: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/hold`, { note }),

  revokeCertificate: (id: string, reason: string) =>
    api.patch<CertificateRequestResponse>(`/certificates/${id}/revoke`, { reason }),

  batchCertificates: (ids: string[], action: 'approve' | 'reject' | 'hold', note?: string) =>
    api.post<BatchCertificateResult>('/certificates/batch', { ids, action, note }),

  downloadCertificate: async (certId: string) => {
    const blob = await fetchBlob(`/certificates/${certId}/download`);
    downloadBlob(blob, `certificate-${certId.slice(0, 8)}.pdf`);
  },

  batchDownloadCertificates: async (ids: string[]) => {
    const blob = await fetchBlob(`/certificates/batch-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    } as FetchOptions);
    downloadBlob(blob, `certificates-${new Date().toISOString().split('T')[0]}.zip`);
  },
};

// ===========================================
// Session Assistants API (NELC Auto-Allocation)
// ===========================================
export const sessionAssistantsApi = {
  getAssistants: (sessionId: string) =>
    api.get<Array<{
      id: string;
      sessionId: string;
      userId: string;
      role: string;
      assignedAt: string;
      assignedBy: string | null;
      isAutoAssigned: boolean;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }>>(`/sessions/${sessionId}/assistants`),

  assignAssistant: (sessionId: string, data: { userId: string; role?: string }) =>
    api.post<{ id: string; sessionId: string; userId: string; role: string }>(
      `/sessions/${sessionId}/assistants`,
      data,
    ),

  removeAssistant: (sessionId: string, userId: string) =>
    api.delete<{ message: string }>(`/sessions/${sessionId}/assistants/${userId}`),

  listAvailableTAs: (sessionId: string) =>
    api.get<Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }>>(`/sessions/${sessionId}/assistants/available`),
};

// ===========================================
// NELC Audit API
// ===========================================
export const nelcAuditApi = {
  getLogs: (params?: {
    eventType?: string;
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.eventType) sp.set('eventType', params.eventType);
    if (params?.entityType) sp.set('entityType', params.entityType);
    if (params?.entityId) sp.set('entityId', params.entityId);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        eventType: string;
        entityType: string;
        entityId: string | null;
        userId: string | null;
        metadata: Record<string, unknown> | null;
        ipAddress: string | null;
        createdAt: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/nelc-audit${qs ? `?${qs}` : ''}`);
  },

  getSummary: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<Array<{ eventType: string; count: number }>>(
      `/nelc-audit/summary${qs ? `?${qs}` : ''}`,
    );
  },

  exportCsv: async (params?: {
    eventType?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<void> => {
    const sp = new URLSearchParams();
    if (params?.eventType) sp.set('eventType', params.eventType);
    if (params?.entityType) sp.set('entityType', params.entityType);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    const blob = await fetchBlob(`/nelc-audit/export${qs ? `?${qs}` : ''}`);
    const ts = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `nelc-events-${ts}.csv`);
  },
};

// ===========================================
// Zoom Attendance API (Real-time tracking)
// ===========================================
export const zoomAttendanceApi = {
  /** Get granular join/leave logs for a session */
  getAttendanceLogs: (sessionId: string) =>
    api.get<Array<{
      id: string;
      sessionId: string;
      studentId: string | null;
      eventType: string;
      timestamp: string;
      zoomParticipantId: string | null;
      zoomUserEmail: string | null;
    }>>(`/sessions/${sessionId}/attendance-logs`),

  /** Trigger a mock Zoom webhook event (dev only) */
  sendMockWebhook: (data: {
    event: string;
    payload: Record<string, unknown>;
  }) => api.post<{ status: string }>('/zoom/mock-webhook', data),

  /** Trigger post-meeting Zoom sync for a session */
  syncZoomAttendance: (sessionId: string) =>
    api.post<{
      message: string;
      synced: number;
      skipped: number;
      details: Array<{
        name: string;
        email: string;
        joinTime: string | null;
        leaveTime: string | null;
        durationMinutes: number;
        action: 'synced' | 'updated_times' | 'skipped';
        reason?: string;
      }>;
    }>(
      `/sessions/${sessionId}/sync-zoom`,
      {},
    ),

  /** Get session recordings */
  getRecordings: (sessionId: string) =>
    api.get<Array<{
      id: string;
      sessionId: string;
      meetingId: string;
      recordingType: string;
      downloadUrl: string | null;
      playUrl: string | null;
      fileSize: number | null;
      fileType: string | null;
      recordingStart: string | null;
      recordingEnd: string | null;
      status: string;
      password: string | null;
    }>>(`/sessions/${sessionId}/recordings`),
};

// ===========================================
// NELC Compliance API
// ===========================================
export interface ComplianceCheck {
  rule: string;
  status: 'passed' | 'review' | 'failed';
  detail: string;
}

export interface SessionComplianceResult {
  sessionId: string;
  overallStatus: 'passed' | 'review' | 'failed';
  checks: ComplianceCheck[];
}

export interface CourseComplianceResult {
  courseId: string;
  overallStatus: 'passed' | 'review' | 'failed';
  sessionResults: SessionComplianceResult[];
  summary: { passed: number; review: number; failed: number; total: number };
}

export interface ComplianceSummary {
  totalCourses: number;
  totalSessions: number;
  passed: number;
  review: number;
  failed: number;
}

export const nelcComplianceApi = {
  getSummary: () =>
    api.get<ComplianceSummary>('/nelc-compliance/summary'),

  getSessionCompliance: (sessionId: string) =>
    api.get<SessionComplianceResult>(`/nelc-compliance/session/${sessionId}`),

  getCourseCompliance: (courseId: string) =>
    api.get<CourseComplianceResult>(`/nelc-compliance/course/${courseId}`),

  getAllCoursesCompliance: () =>
    api.get<Array<{
      courseId: string;
      courseTitle: string;
      instructorName: string;
      deliveryType: string | null;
      createdAt: string;
      overallStatus: 'passed' | 'review' | 'failed';
      overallScore: number;
      summary: { passed: number; review: number; failed: number; total: number };
    }>>('/nelc-compliance/all-courses'),

  downloadCsvReport: async () => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/nelc-compliance/export.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to export compliance report');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `nelc-compliance-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getCourseScorecard: (courseId: string) =>
    api.get<{
      courseId: string;
      overallStatus: 'passed' | 'review' | 'failed';
      overallScore: number;
      categories: Array<{
        category: string;
        label: string;
        icon: string;
        status: 'passed' | 'review' | 'failed';
        checks: Array<{ rule: string; status: 'passed' | 'review' | 'failed'; detail: string }>;
      }>;
    }>(`/nelc-compliance/course/${courseId}/scorecard`),

  getVirtualClassCompliance: () =>
    api.get<Array<{
      sessionId: string;
      sessionTitle: string;
      courseTitle: string;
      instructorName: string;
      type: string;
      scheduledAt: string | null;
      durationMinutes: number;
      status: string;
      hasZoomLink: boolean;
      hasRecording: boolean;
      overallStatus: 'passed' | 'review' | 'failed';
      checks: Array<{ rule: string; status: 'passed' | 'review' | 'failed'; detail: string }>;
    }>>('/nelc-compliance/virtual-classes'),

  downloadEvidence: async (courseId: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/nelc-compliance/course/${courseId}/evidence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to download evidence');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nelc-evidence-${courseId.slice(0, 8)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// ===========================================
// NELC xAPI Integration API (admin only)
// ===========================================
export type NelcXapiStatementStatus = 'pending' | 'sent' | 'failed';

export type NelcLrsMode = 'staging' | 'production';

export interface NelcXapiConfig {
  enabled: boolean;
  endpoint: string;
  username: string;
  passwordMasked: string;
  /** Active mode the endpoint+password reflect. Same value as
   *  {@link NelcXapiMode.mode} — duplicated for convenience. */
  mode: NelcLrsMode;
  platformIdentifier: string;
  platformNameEn: string;
  platformNameAr: string;
  lmsUrl: string;
  xapiVersion: string;
  maxAttempts: number;
  timeoutMs: number;
}

export interface NelcXapiMode {
  mode: NelcLrsMode;
  /** Where mode resolved from: db (admin toggle), env (NELC_LRS_MODE),
   *  default ('staging' fail-safe). */
  source: 'db' | 'env' | 'default';
  defaultMode: NelcLrsMode;
  endpoints: { staging: string; production: string };
  activeEndpoint: string;
  username: string;
  passwordsAvailable: { staging: boolean; production: boolean };
}

export interface NelcXapiStats {
  last24h: { total: number; sent: number; failed: number; pending: number };
  lastSuccessAt: string | null;
  pendingTotal: number;
  failedTotal: number;
}

export interface NelcXapiLogRow {
  id: string;
  verb: string;
  objectActivityId: string;
  objectType: string;
  actorUserId: string | null;
  courseId: string | null;
  status: NelcXapiStatementStatus;
  createdAt: string;
  sentAt: string | null;
  lastHttpStatus: number | null;
  lastError: string | null;
  attemptCount: number;
}

export interface NelcXapiLogDetail {
  id: string;
  payload: unknown;
  transmissions: Array<{
    attemptNo: number;
    httpStatus: number | null;
    responseBody: string | null;
    errorText: string | null;
    sentAt: string;
  }>;
}

export interface NelcXapiTestConnectionResult {
  ok: boolean;
  httpStatus: number | null;
  responseBody: string;
  errorText: string | null;
  endpoint: string;
}

export const nelcXapiApi = {
  getConfig: () => api.get<NelcXapiConfig>('/admin/integrations/nelc/config'),

  getStats: () => api.get<NelcXapiStats>('/admin/integrations/nelc/stats'),

  getLog: (params?: {
    status?: NelcXapiStatementStatus;
    verb?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.verb) sp.set('verb', params.verb);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.pageSize) sp.set('pageSize', String(params.pageSize));
    const qs = sp.toString();
    return api.get<{
      rows: NelcXapiLogRow[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/admin/integrations/nelc/log${qs ? `?${qs}` : ''}`);
  },

  getLogDetail: (id: string) =>
    api.get<NelcXapiLogDetail | null>(`/admin/integrations/nelc/log/${id}`),

  retry: (id: string) =>
    api.post<{ enqueued: boolean }>(`/admin/integrations/nelc/retry/${id}`, {}),

  testConnection: () =>
    api.post<NelcXapiTestConnectionResult>(
      '/admin/integrations/nelc/test-connection',
      {},
    ),

  /** Send the NELC "joined" administrative trigger statement. One-shot,
   *  fired after the platform is wired up — before any learner activity. */
  triggerJoined: () =>
    api.post<{ ok: boolean; statementId: string | null }>(
      '/admin/integrations/nelc/trigger/joined',
      {},
    ),

  /** Send the NELC "left" trigger — counterpart to joined, fired when
   *  the platform is offboarding from NELC. */
  triggerLeft: () =>
    api.post<{ ok: boolean; statementId: string | null }>(
      '/admin/integrations/nelc/trigger/left',
      {},
    ),

  /** Get current active mode + both endpoint URLs + which passwords
   *  are loaded in Secret Manager. Source field reveals whether the
   *  value came from the DB toggle, env default, or fail-safe. */
  getMode: () => api.get<NelcXapiMode>('/admin/integrations/nelc/mode'),

  /** Switch the active LRS environment. SUPER_ADMIN only — flipping to
   *  production routes every learner statement into NELC's permanent
   *  compliance record. The backend refuses if the target mode's
   *  password isn't loaded in Secret Manager. */
  setMode: (mode: NelcLrsMode) =>
    api.post<{ mode: NelcLrsMode; endpoint: string }>(
      '/admin/integrations/nelc/mode',
      { mode },
    ),
};

// ===========================================
// User Notifications API
// ===========================================
export interface UserNotification {
  id: string;
  recipientId: string;
  type: string;
  // Pre-rendered fallback. Prefer titleKey / messageKey when present.
  title: string;
  message: string;
  titleKey: string | null;
  titleParams: Record<string, string | number> | null;
  messageKey: string | null;
  messageParams: Record<string, string | number> | null;
  link: string | null;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export const userNotificationsApi = {
  // `scope='team'` widens to the whole SUPPORT team feed — server enforces
  // that only supervisors/admins can actually use it (others silently
  // fall back to own scope).
  getAll: (params?: { limit?: number; unreadOnly?: boolean; scope?: 'own' | 'team' }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.unreadOnly) sp.set('unreadOnly', 'true');
    if (params?.scope === 'team') sp.set('scope', 'team');
    const qs = sp.toString();
    return api.get<{ data: UserNotification[]; unreadCount: number }>(
      `/user-notifications${qs ? `?${qs}` : ''}`,
    );
  },

  getUnreadCount: (params?: { scope?: 'own' | 'team' }) => {
    const sp = new URLSearchParams();
    if (params?.scope === 'team') sp.set('scope', 'team');
    const qs = sp.toString();
    return api.get<{ unreadCount: number }>(
      `/user-notifications/unread-count${qs ? `?${qs}` : ''}`,
    );
  },

  markAsRead: (id: string) =>
    api.patch<UserNotification>(`/user-notifications/${id}/read`),

  markAllAsRead: () =>
    api.patch<{ message: string }>('/user-notifications/read-all'),

  clearAll: () =>
    api.delete<{ message: string }>('/user-notifications/clear-all'),
};

// ===========================================
// Student API
// ===========================================

import type {
  StudentDashboardStats,
  StudentEnrolledCoursesResponse,
  StudentCourseDetail,
  CourseProgress,
  StudentCertificate,
  RecentGrade,
  CalendarEvent,
  StudentTranscript,
  EnrollmentResponse,
  StudentAssessment,
  AssessmentResult,
  RecentActivityItem,
  ModuleMaterialsResponse,
  SubmissionReview,
  TicketsResponse,
  TicketDetail,
} from '@/types/student-dashboard';

export interface EnrollmentStatusEntry {
  isEnrolled: boolean;
  enrollmentId: string | null;
  status: 'active' | 'completed' | 'expired' | null;
  // Set when the student has already initiated a bank transfer for this
  // course but finance hasn't actioned the receipt yet. UI uses this to
  // route them back to /payment/bank-transfer/<id> instead of letting them
  // start a duplicate payment.
  pendingBankTransferPaymentId?: string | null;
}

export interface EnrollmentStatusResponse {
  byId: Record<string, EnrollmentStatusEntry>;
}

export const studentApi = {
  getDashboard: () =>
    api.get<StudentDashboardStats>('/student/dashboard'),

  /**
   * Bulk-check whether the current student is already enrolled in each of
   * the given course ids. Used by the course detail / cart / checkout
   * pages to hide payment methods for already-owned courses before the
   * buyer ever clicks Pay. Unknown ids come back as isEnrolled=false so
   * callers can render a Record<courseId, status> with no per-id error
   * handling. Backend caps at 50 ids per call.
   */
  getEnrollmentStatus: (courseIds: string[]) => {
    if (!courseIds || courseIds.length === 0) {
      return Promise.resolve<EnrollmentStatusResponse>({ byId: {} });
    }
    const qs = encodeURIComponent(courseIds.join(','));
    return api.get<EnrollmentStatusResponse>(
      `/student/enrollment-status?courseIds=${qs}`,
    );
  },

  getCourses: (params?: {
    status?: string;
    search?: string;
    delivery?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
    if (params?.delivery && params.delivery !== 'all') sp.set('delivery', params.delivery);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.sort) sp.set('sort', params.sort);
    const qs = sp.toString();
    return api.get<StudentEnrolledCoursesResponse>(
      `/student/courses${qs ? `?${qs}` : ''}`,
    );
  },

  getCourseDetail: (courseId: string) =>
    api.get<StudentCourseDetail>(`/student/courses/${courseId}`),

  getCourseProgress: (courseId: string) =>
    api.get<CourseProgress>(`/student/courses/${courseId}/progress`),

  updateProgress: (courseId: string, data: { moduleId: string; status?: string; materialId?: string; watchedSeconds?: number; totalSeconds?: number }) =>
    api.post<EnrollmentResponse>(`/student/courses/${courseId}/progress`, data),

  getModuleMaterials: (courseId: string, moduleId: string) =>
    api.get<ModuleMaterialsResponse>(
      `/student/courses/${courseId}/modules/${moduleId}/materials`,
    ),

  selfEnroll: (courseId: string) =>
    api.post<EnrollmentResponse>(`/student/enroll/${courseId}`, {}),

  dropCourse: (courseId: string) =>
    api.delete<EnrollmentResponse>(`/student/courses/${courseId}/drop`),

  getCertificates: () =>
    api.get<StudentCertificate[]>('/student/certificates'),

  getRecentGrades: (limit = 5) =>
    api.get<RecentGrade[]>(`/student/grades/recent?limit=${limit}`),

  requestCertificate: (courseId: string) =>
    api.post<{ id: string; status: string }>('/certificates', { courseId }),

  downloadCertificate: async (certId: string) => {
    const blob = await fetchBlob(`/student/certificates/${certId}/download`);
    downloadBlob(blob, `certificate-${certId.slice(0, 8)}.pdf`);
  },

  recordWatchEvents: (materialId: string, events: { eventType: string; position: number; fromPosition?: number }[]) =>
    api.post<{ recorded: number }>(`/student/materials/${materialId}/watch-events`, { events }),

  getSessionJoinUrl: (sessionId: string) =>
    api.get<{ joinUrl: string }>(`/student/sessions/${sessionId}/join`),

  getCalendar: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set('from', params.from);
    if (params?.to) sp.set('to', params.to);
    const qs = sp.toString();
    return api.get<CalendarEvent[]>(`/student/calendar${qs ? `?${qs}` : ''}`);
  },

  getRecentActivity: (params?: { limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<RecentActivityItem[]>(
      `/student/recent-activity${qs ? `?${qs}` : ''}`,
    );
  },

  getTranscript: () =>
    api.get<StudentTranscript>('/student/transcript'),

  getAssessment: (assessmentId: string) =>
    api.get<StudentAssessment>(`/student/assessments/${assessmentId}`),

  submitAssessment: (
    assessmentId: string,
    answers: { questionId: string; answer: string }[]
  ) =>
    api.post<AssessmentResult>(`/student/assessments/${assessmentId}/submit`, {
      answers,
    }),

  saveAssessmentProgress: (
    assessmentId: string,
    answers: { questionId: string; answer: string }[]
  ) =>
    api.post<{ submissionId: string; saved: boolean }>(
      `/student/assessments/${assessmentId}/save-progress`,
      { answers }
    ),

  getAssessmentProgress: (assessmentId: string) =>
    api.get<{
      answers: { questionId: string; answer: string }[];
      startedAt: string | null;
    } | null>(`/student/assessments/${assessmentId}/progress`),

  getSubmissionReview: (submissionId: string) =>
    api.get<SubmissionReview>(`/student/submissions/${submissionId}/review`),

  submitAssignment: async (assessmentId: string, files: File[], onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    return new Promise<{ submissionId: string; filesCount: number; status: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/student/assessments/${assessmentId}/submit-assignment`);
      const token = getAccessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });
  },

  // ── Tickets ──
  getTickets: (params?: { status?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString();
    return api.get<TicketsResponse>(`/student/tickets${qs ? `?${qs}` : ''}`);
  },

  getTicketDetail: (ticketId: string) =>
    api.get<TicketDetail>(`/student/tickets/${ticketId}`),

  createTicket: (data: {
    category: string;
    priority?: string;
    subject: string;
    description: string;
    courseId?: string;
    attachmentUrl?: string;
    attachmentUrls?: string[];
  }) => api.post<{ id: string }>('/student/tickets', data),

  replyToTicket: (ticketId: string, message: string) =>
    api.post<{ id: string }>(`/student/tickets/${ticketId}/reply`, { message }),

  uploadFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFormData<{ url: string; filename: string }>('/storage/upload', fd);
  },

  rateTicket: (ticketId: string, rating: number) =>
    api.post<{ success: boolean }>(`/student/tickets/${ticketId}/rate`, { rating }),

  getMyCourseRating: (courseId: string) =>
    api.get<{ id: string; rating: number; reviewText: string | null; createdAt: string } | null>(
      `/courses/${courseId}/ratings/me`,
    ),

  submitCourseRating: (courseId: string, rating: number, reviewText?: string) =>
    api.post<{ id: string; rating: number; reviewText: string | null; createdAt: string }>(
      `/courses/${courseId}/ratings`,
      { rating, reviewText },
    ),

  getMyInstructorRating: (courseId: string) =>
    api.get<{
      id: string;
      rating: number;
      reviewText: string | null;
      createdAt: string;
    } | null>(`/courses/${courseId}/instructor-ratings/me`),

  submitInstructorRating: (courseId: string, rating: number, reviewText?: string) =>
    api.post<{
      id: string;
      rating: number;
      reviewText: string | null;
      createdAt: string;
    }>(`/courses/${courseId}/instructor-ratings`, { rating, reviewText }),

  getReviewStatus: (courseId: string) =>
    api.get<{
      courseReviewSubmitted: boolean;
      instructorReviewSubmitted: boolean;
      instructorRequired: boolean;
      allRequiredSubmitted: boolean;
    }>(`/courses/${courseId}/review-status`),
};

// ===========================================
// Points API (student + admin)
// ===========================================

export interface PointsBalance {
  balance: number;
  expiringSoon: number;
}

export interface PointsTransaction {
  id: string;
  delta: number;
  reason: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  ruleKey: string | null;
  ruleDescription: string | null;
  ruleDescriptionAr: string | null;
}

export interface PointsTransactionsResponse {
  data: PointsTransaction[];
  page: number;
  limit: number;
  total: number;
}

export interface RedeemableCourse {
  id: string;
  title: string;
  titleAr: string | null;
  thumbnail: string | null;
  deliveryType: string;
  price: number;
  cmeHours: number;
  isCmeAccredited: boolean;
  costPoints: number;
  affordable: boolean;
  /**
   * Whether the user already has an active or completed enrollment in
   * this course. Populated by the backend so the UI can show an
   * "Enrolled" badge instead of the Redeem CTA. Phase 4.
   */
  alreadyEnrolled: boolean;
}

/**
 * Phase-4 hero summary — pairs the raw balance with a month-to-date earn
 * counter. Read from `GET /points/me`.
 */
export interface PointsMe {
  balance: number;
  earnedThisMonth: number;
}

export interface PointRule {
  id: string;
  ruleKey: string;
  pointsAmount: number;
  isActive: boolean;
  maxPerUser: number | null;
  cooldownSeconds: number | null;
  description: string | null;
  descriptionAr: string | null;
  expiresAfterDays: number | null;
}

export interface PointsConfig {
  id: number;
  conversionRatePointsPerSar: number;
  minRedemptionPoints: number;
  maxRedemptionPct: number;
  combinableWithCoupons: boolean;
  defaultExpirationDays: number | null;
}

export interface ActiveRule {
  ruleKey: string;
  pointsAmount: number;
  description: string | null;
  descriptionAr: string | null;
  expiresAfterDays: number | null;
  maxPerUser: number | null;
}

export const pointsApi = {
  getBalance: () => api.get<PointsBalance>('/points/me/balance'),

  /**
   * Phase-4 hero summary. Prefer this over `getBalance` for surfaces
   * that need the month-to-date earn counter alongside the balance.
   */
  getMe: () => api.get<PointsMe>('/points/me'),

  getActiveRules: () => api.get<ActiveRule[]>('/points/me/rules'),

  /** Alias used by Phase-4 components; points at the same endpoint. */
  getEarnRules: () => api.get<ActiveRule[]>('/points/me/rules'),

  getTransactions: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return api.get<PointsTransactionsResponse>(
      `/points/me/transactions${q ? `?${q}` : ''}`,
    );
  },

  getRedeemableCourses: () =>
    api.get<{ balance: number; courses: RedeemableCourse[] }>(
      '/points/me/redeemable-courses',
    ),

  redeemCourse: (courseId: string) =>
    api.post<{
      redemptionId: string;
      enrollmentId: string;
      courseId: string;
      pointsUsed: number;
      pointsSpent: number;
      newBalance: number;
    }>(`/points/me/redeem-course/${courseId}`),

  // ─── Rewards catalog ─────────────────────────────────────
  getRewards: () => api.get<RewardCardData[]>('/points/me/rewards'),

  getMyRedemptions: () =>
    api.get<RewardRedemptionRow[]>('/points/me/rewards/redemptions'),

  redeemReward: (
    rewardId: string,
    body: { selectedCourseId?: string; selectedDeliveryType?: string } = {},
  ) =>
    api.post<RedeemRewardResult>(
      `/points/me/rewards/${rewardId}/redeem`,
      body,
    ),

  /**
   * Comprehensive My-Rewards history. Backs the `/dashboard/student/my-rewards`
   * page. `unusedCouponCount` is what the sidebar red-dot listens to.
   */
  getMyRewardHistory: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return api.get<RewardHistoryPage>(
      `/points/me/rewards/history${q ? `?${q}` : ''}`,
    );
  },
};

// ─── Rewards types ─────────────────────────────────────────────

export type RewardType =
  | 'discount_coupon'
  | 'fixed_discount_coupon'
  | 'free_course'
  | 'free_webinar'
  | 'other';

/**
 * Envelope-level reward type reported by the My Rewards history endpoint.
 * Extends the catalog `RewardType` with `course_purchase` — a synthetic
 * marker for point-based course unlocks (rows from `point_redemptions`),
 * distinct from a reward-catalog `free_course` entry. `course_purchase`
 * is NEVER a valid `reward_catalog.type` value; keeping it out of
 * `RewardType` makes admin CRUD flows type-safe.
 */
export type RewardHistoryEnvelopeType = RewardType | 'course_purchase';

export interface RewardCardData {
  id: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  icon: string | null;
  type: RewardType;
  pointsCost: number;
  payload: Record<string, unknown>;
  stockLeft: number | null;
  perUserLeft: number | null;
  myRedemptionsCount: number;
  canRedeem: boolean;
  canAfford: boolean;
  inStock: boolean;
  withinUserCap: boolean;
  /**
   * Resolved course list for `free_course` rewards — the payload stores
   * only ids; the backend joins `courses` so the student picker doesn't
   * need a follow-up round trip. Empty array for every other reward type.
   */
  courses: Array<{
    id: string;
    title: string;
    titleAr: string | null;
    thumbnail: string | null;
    priceSar: number;
  }>;
}

export interface RewardRedemptionRow {
  id: string;
  rewardId: string;
  rewardNameEn: string;
  rewardNameAr: string | null;
  rewardType: RewardType;
  pointsSpent: number;
  status: 'pending' | 'fulfilled' | 'failed' | 'reversed';
  fulfillmentPayload: Record<string, unknown>;
  redeemedAt: string;
  expiresAt: string | null;
}

export interface RedeemRewardResult {
  redemptionId: string;
  pointsSpent: number;
  newBalance: number;
  status: 'pending' | 'fulfilled';
  type: RewardType;
  fulfillment: Record<string, unknown>;
  expiresAt: string | null;
}

// ─── My Rewards history (Phase 1) ─────────────────────────────

export type RewardHistoryStatus =
  | 'unused'
  | 'used'
  | 'expired'
  | 'pending'
  | 'fulfilled'
  | 'failed'
  | 'reversed';

export interface CouponHistoryItem {
  kind: 'coupon';
  code: string;
  expiresAt: string | null;
  currentUses: number;
  maxUses: number;
  status: 'unused' | 'used' | 'expired';
  usedInPaymentId?: string | null;
}

export interface FreeCourseHistoryItem {
  kind: 'free_course';
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  thumbnail: string | null;
  enrollmentId: string | null;
  enrolledAt: string | null;
  courseStartDate: string | null;
  courseSlug?: string | null;
}

export interface FreeWebinarHistoryItem {
  kind: 'free_webinar';
  sessionId: string;
  sessionTitle: string;
  sessionTitleAr: string | null;
  sessionStartAt: string | null;
  registrationStatus: string | null;
  joinUrl?: string | null;
}

export interface OtherHistoryItem {
  kind: 'other';
  status: 'pending' | 'fulfilled' | 'failed' | 'reversed';
  fulfilledAt: string | null;
  adminNote: string | null;
  /**
   * Reward-catalog `expectedDeliveryDays` echoed onto every projection so
   * the FE can render the "expected by" countdown without a second fetch.
   * Legacy rewards created before Phase 2 fall back to 7 on the server.
   */
  expectedDeliveryDays: number;
  /** Duplicate of the envelope's redeemedAt for convenience. */
  redeemedAt: string;
  /**
   * Only present when `status === 'fulfilled'`. Non-fulfilled statuses
   * always project `null` — the row on the server keeps the artifact for
   * audit trail but student projection is gated on status.
   */
  artifact: { kind: 'code' | 'link' | 'note'; value: string } | null;
}

/**
 * Point-based course purchase — sourced from `point_redemptions`, not
 * `reward_redemptions`. Distinct from `FreeCourseHistoryItem` (a
 * reward-catalog `free_course` entry) so the UI can show it in its own
 * card style ("Purchased with N points") without conflating the two.
 */
export interface CoursePurchaseHistoryItem {
  kind: 'course_purchase';
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  thumbnail: string | null;
  enrollmentId: string | null;
  enrollmentStatus: 'active' | 'completed' | 'dropped' | 'expired' | null;
  redeemedAt: string;
  pointsSpent: number;
}

export type RewardHistoryProjection =
  | CouponHistoryItem
  | FreeCourseHistoryItem
  | FreeWebinarHistoryItem
  | OtherHistoryItem
  | CoursePurchaseHistoryItem;

export interface RewardHistoryRow {
  redemptionId: string;
  rewardId: string;
  rewardName: string;
  rewardNameAr: string | null;
  rewardType: RewardHistoryEnvelopeType;
  pointsSpent: number;
  redeemedAt: string;
  projection: RewardHistoryProjection;
}

export interface RewardHistoryPage {
  items: RewardHistoryRow[];
  total: number;
  page: number;
  limit: number;
  unusedCouponCount: number;
}

export interface AdminCourseRedemption {
  id: string;
  title: string;
  titleAr: string | null;
  thumbnail: string | null;
  deliveryType: string;
  price: string | number;
  cmeHours: number;
  isCmeAccredited: boolean;
  redeemableForFree: boolean;
  freeUnlockCostPoints: number | null;
  maxRedemptionPct: number | null;
  /** 30-day count of redemptions actually applied. Read-only summary. */
  redemptionsLast30d: number;
  /** True when a row exists in course_redemption_settings, even if disabled. */
  configured: boolean;
}

export interface AdminWebinarSession {
  id: string;
  title: string;
  scheduledAt: string;
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  isWebinar: boolean;
}

export interface AdminUserSearchResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface AdminCourseRedemptionFilters {
  page?: number;
  limit?: number;
  search?: string;
  courseId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminCourseRedemptionRow {
  redemptionId: string;
  redeemedAt: string;
  pointsSpent: number;
  equivalentSar: number;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  course: {
    id: string;
    title: string;
    titleAr: string | null;
    priceSar: number;
  };
  enrollment: {
    id: string;
    status: string | null;
  } | null;
}

export interface AdminCourseRedemptionsPage {
  items: AdminCourseRedemptionRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    count: number;
    totalPointsSpent: number;
    equivalentValueSar: number;
  };
}

function buildCourseRedemptionQuery(
  filters: AdminCourseRedemptionFilters,
): string {
  const qs = new URLSearchParams();
  if (filters.page) qs.set('page', String(filters.page));
  if (filters.limit) qs.set('limit', String(filters.limit));
  if (filters.search) qs.set('search', filters.search);
  if (filters.courseId) qs.set('courseId', filters.courseId);
  if (filters.status && filters.status !== 'all') qs.set('status', filters.status);
  if (filters.startDate) qs.set('startDate', filters.startDate);
  if (filters.endDate) qs.set('endDate', filters.endDate);
  return qs.toString();
}

export const pointsAdminApi = {
  listRules: () => api.get<PointRule[]>('/admin/points/rules'),
  updateRule: (ruleKey: string, body: Partial<PointRule>) =>
    api.patch<PointRule>(`/admin/points/rules/${ruleKey}`, body),
  getConfig: () => api.get<PointsConfig>('/admin/points/config'),
  updateConfig: (body: Partial<PointsConfig>) =>
    api.patch<PointsConfig>('/admin/points/config', body),
  grant: (body: { userId: string; delta: number; reason: string }) =>
    api.post<{ rowId: string }>('/admin/points/grant', body),
  listCourses: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get<AdminCourseRedemption[]>(`/admin/points/courses${qs}`);
  },
  listWebinarSessions: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return api.get<AdminWebinarSession[]>(
      `/admin/points/webinar-sessions${qs}`,
    );
  },
  updateCourseRedemption: (
    courseId: string,
    body: Partial<{
      redeemableForFree: boolean;
      freeUnlockCostPoints: number | null;
      maxRedemptionPct: number | null;
    }>,
  ) =>
    api.patch<AdminCourseRedemption>(
      `/admin/points/courses/${courseId}`,
      body,
    ),
  deleteCourseRedemption: (courseId: string) =>
    api.delete<void>(`/admin/points/courses/${courseId}`),
  bulkEnableCourseRedemption: (multiplier: number) =>
    api.post<{ inserted: number; skipped: number; multiplier: number }>(
      `/admin/points/courses/bulk-enable`,
      { multiplier },
    ),
  searchUsers: (q: string) =>
    api.get<AdminUserSearchResult[]>(
      `/admin/points/users/search?q=${encodeURIComponent(q)}`,
    ),
  getUserTransactions: (
    userId: string,
    params?: { page?: number; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return api.get<PointsTransactionsResponse>(
      `/admin/points/users/${userId}/transactions${q ? `?${q}` : ''}`,
    );
  },
  getUserBalance: (userId: string) =>
    api.get<{ balance: number }>(`/admin/points/users/${userId}/balance`),

  // ─── Rewards catalog CRUD ───────────────────────────────
  listRewards: () => api.get<AdminReward[]>('/admin/points/rewards'),
  createReward: (body: AdminRewardInput) =>
    api.post<AdminReward>('/admin/points/rewards', body),
  updateReward: (id: string, body: Partial<AdminRewardInput>) =>
    api.patch<AdminReward>(`/admin/points/rewards/${id}`, body),
  deleteReward: (id: string) =>
    api.delete<void>(`/admin/points/rewards/${id}`),

  // ─── Redemptions history ────────────────────────────────
  listRedemptions: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    rewardId?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    if (params?.rewardId) qs.set('rewardId', params.rewardId);
    const q = qs.toString();
    return api.get<AdminRedemptionsPage>(
      `/admin/points/redemptions${q ? `?${q}` : ''}`,
    );
  },
  transitionRedemption: (
    id: string,
    body: {
      status: 'fulfilled' | 'failed' | 'reversed';
      artifact?: { kind: 'code' | 'link' | 'note'; value: string };
      adminNote?: string;
      reason?: string;
    },
  ) =>
    api.post<{ ok: boolean; status: string }>(
      `/admin/points/redemptions/${id}/transition`,
      body,
    ),

  // ─── Course redemptions (point-based course unlocks) ───────
  listCourseRedemptions: (filters: AdminCourseRedemptionFilters = {}) => {
    const qs = buildCourseRedemptionQuery(filters);
    return api.get<AdminCourseRedemptionsPage>(
      `/admin/points/course-redemptions${qs ? `?${qs}` : ''}`,
    );
  },
  exportCourseRedemptionsCsv: async (
    filters: AdminCourseRedemptionFilters = {},
  ) => {
    const qs = buildCourseRedemptionQuery(filters);
    const blob = await fetchBlob(
      `/admin/points/course-redemptions/export.csv${qs ? `?${qs}` : ''}`,
    );
    const ts = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `course-redemptions-${ts}.csv`);
  },
};

// ─── Admin reward types ────────────────────────────────────────

export interface AdminReward {
  id: string;
  nameEn: string;
  nameAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  /** @deprecated column kept in DB for legacy rows; no longer edited in UI. */
  icon: string | null;
  type: RewardType;
  pointsCost: number;
  payload: Record<string, unknown>;
  isActive: boolean;
  displayOrder: number;
  maxPerUser: number | null;
  totalStock: number | null;
  totalRedeemed: number;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRewardInput {
  nameEn: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  type: RewardType;
  pointsCost: number;
  payload: Record<string, unknown>;
  isActive?: boolean;
  displayOrder?: number;
  maxPerUser?: number | null;
  totalStock?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface AdminRedemptionRow {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  rewardId: string;
  rewardName: string;
  rewardType: RewardType;
  pointsSpent: number;
  status: 'pending' | 'fulfilled' | 'failed' | 'reversed';
  fulfillmentPayload: Record<string, unknown>;
  /**
   * Phase 2: artifact the admin attached when fulfilling an `other`-type
   * redemption. `null` for pending/failed/reversed and for every non-Other
   * reward type. `meta.note` — when set — holds the admin's private note.
   */
  fulfillmentArtifact: {
    kind: 'code' | 'link' | 'note';
    value: string;
    meta?: { note?: string } | null;
  } | null;
  /** Only set when rewardType === 'other' (else null). */
  expectedDeliveryDays: number | null;
  failureReason: string | null;
  redeemedAt: string;
  fulfilledAt: string | null;
}

export interface AdminRedemptionsPage {
  rows: AdminRedemptionRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===========================================
// Public API (no auth)
// ===========================================

export const publicApi = {
  getCourses: (params?: {
    search?: string;
    delivery?: string;
    pricing?: 'free' | 'paid';
    onSale?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.delivery) qs.set('delivery', params.delivery);
    if (params?.pricing) qs.set('pricing', params.pricing);
    if (params?.onSale) qs.set('onSale', 'true');
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const queryString = qs.toString();
    return api.get<PublicCoursesResponse>(
      `/courses/public${queryString ? `?${queryString}` : ''}`,
      { skipAuth: true },
    );
  },

  getInstructorPublicProfile: (instructorId: string) =>
    api.get<InstructorPublicProfile>(
      `/courses/instructors/${instructorId}/public`,
      { skipAuth: true },
    ),

  getCourseRatings: (
    courseId: string,
    params?: { page?: number; limit?: number; rating?: number; sort?: 'newest' | 'oldest' | 'highest' | 'lowest'; search?: string },
  ) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.rating) sp.set('rating', String(params.rating));
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.search) sp.set('search', params.search);
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        rating: number;
        reviewText: string | null;
        createdAt: string;
        studentName: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      avgRating: number;
      totalRatings: number;
      distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
    }>(`/courses/${courseId}/ratings${qs ? `?${qs}` : ''}`, { skipAuth: true });
  },
};

// ===========================================
// Course Assistants API (Course-level TA management)
// ===========================================
export interface CourseAssistantTA {
  id: string;
  courseId: string;
  userId: string;
  status: 'suggested' | 'approved' | 'rejected';
  priority: number;
  assignedAt: string;
  approvedAt: string | null;
  assignedBy: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  otherCourseCount: number;
}

export interface ThresholdStatus {
  enrolledCount: number;
  requiredTAs: number;
  activeTAs: number;
  suggestedTAs: number;
  deficit: number;
  warning: string | null;
  thresholds: { low: number; mid: number };
}

export interface TAAssignedCourse {
  id: string;
  courseId: string;
  status: 'approved' | 'suggested' | 'rejected';
  priority: number;
  assignedAt: string;
  approvedAt: string | null;
  courseTitle: string;
  courseThumbnail: string | null;
  courseStatus: string;
  instructorId: string;
  instructorFirstName: string | null;
  instructorLastName: string | null;
}

export const courseAssistantsApi = {
  getCourseTAs: (courseId: string) =>
    api.get<CourseAssistantTA[]>(`/courses/${courseId}/assistants`),

  assignTA: (courseId: string, data: { userId: string }) =>
    api.post<{ id: string; courseId: string; userId: string; status: string }>(
      `/courses/${courseId}/assistants`,
      data,
    ),

  suggestTA: (courseId: string, data: { userId: string }) =>
    api.post<{ id: string; courseId: string; userId: string; status: string }>(
      `/courses/${courseId}/assistants/suggest`,
      data,
    ),

  approveTA: (courseId: string, userId: string) =>
    api.patch<{ id: string; status: string }>(
      `/courses/${courseId}/assistants/${userId}/approve`,
    ),

  rejectTA: (courseId: string, userId: string, data: { reason: string }) =>
    api.patch<{ id: string; status: string }>(
      `/courses/${courseId}/assistants/${userId}/reject`,
      data,
    ),

  removeTA: (courseId: string, userId: string) =>
    api.delete<{ message: string }>(`/courses/${courseId}/assistants/${userId}`),

  updatePriority: (courseId: string, userId: string, priority: number) =>
    api.patch<{ id: string; priority: number }>(
      `/courses/${courseId}/assistants/${userId}/priority`,
      { priority },
    ),

  getThresholdStatus: (courseId: string) =>
    api.get<ThresholdStatus>(`/courses/${courseId}/assistants/threshold-status`),

  listAvailableTAs: (courseId: string) =>
    api.get<Array<{
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }>>(`/courses/${courseId}/assistants/available`),
};

// ===========================================
// Teaching Assistant API (TA Dashboard)
// ===========================================

/**
 * Result of `GET /sessions/:id/ta-join`. Time-gated: only returns a
 * `joinUrl` when the session is currently joinable (opens 15 min before
 * scheduled start; closes 30 min after scheduled end). Otherwise
 * returns the reason + boundaries so the client can render "Starts in
 * {rel}" / "Ended".
 */
export type TaSessionJoin =
  | {
      joinable: false;
      reason: 'not_yet' | 'ended' | 'not_authorized';
      startsAt?: string;
      endsAt?: string;
    }
  | {
      joinable: true;
      joinType: 'panelist' | 'meeting-attendee';
      joinUrl: string;
      displayName: string;
    };

export const taApi = {
  getSessionJoin: (sessionId: string) =>
    api.get<TaSessionJoin>(`/sessions/${sessionId}/ta-join`),
  getMyAssignedSessions: (params?: {
    dateRange?: string;
    status?: string;
    courseId?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.dateRange) sp.set('dateRange', params.dateRange);
    if (params?.status) sp.set('status', params.status);
    if (params?.courseId) sp.set('courseId', params.courseId);
    const qs = sp.toString();
    return api.get<Array<{
      id: string;
      courseId: string;
      courseName: string;
      instructorId: string;
      title: string;
      type: string;
      scheduledAt: string;
      durationMinutes: number;
      zoomLink: string | null;
      status: string;
      roomName: string | null;
      venueAddress: string | null;
      assistantRole: string;
      assessmentId: string | null;
    }>>(`/sessions/my-assigned${qs ? `?${qs}` : ''}`);
  },

  getSessionSubmissions: (assessmentId: string) =>
    api.get<Array<{
      id: string;
      assessmentId: string;
      studentId: string;
      score: number | null;
      totalMarks: number | null;
      percentage: number | null;
      startedAt: string | null;
      submittedAt: string | null;
      status: string;
      answers: unknown;
      submissionFiles: unknown;
      instructorComment: string | null;
      studentFirstName: string | null;
      studentLastName: string | null;
      studentEmail: string;
    }>>(`/assessments/${assessmentId}/submissions`),

  getMyAssignedCourses: () =>
    api.get<TAAssignedCourse[]>('/course-assistants/my-courses'),

  getCourseAssessments: (courseId: string) =>
    api.get<{ data: Array<{
      id: string;
      courseId: string;
      title: string;
      type: string;
      status: string;
      totalMarks: number | null;
      passingScore: number | null;
      createdAt: string;
    }>; total: number }>(`/assessments?courseId=${courseId}`),

  // Reuse the same course detail endpoint (TA role is now allowed)
  getCourseDetail: (courseId: string) =>
    api.get<CourseDetailResponse>(`/courses/${courseId}`),

  getCourseEnrollments: (courseId: string) =>
    api.get<CourseEnrollment[]>(`/courses/${courseId}/enrollments`),

  getCourseSessions: (courseId: string) =>
    api.get<CourseSessionsResponse>(`/sessions?courseId=${courseId}&limit=50`),
};

// ─── Support Dashboard API ──────────────────────────────

export const supportApi = {
  createTicket: (data: {
    category: string;
    priority?: string;
    subject: string;
    description: string;
    courseId?: string;
    attachmentUrl?: string;
    attachmentUrls?: string[];
    attachments?: {
      url: string;
      filename?: string;
      mimeType?: string;
      sizeBytes?: number;
    }[];
    source?: string;
    aboutUserId?: string;
  }) => api.post<{ id: string }>('/tickets', data),

  getTickets: (params?: {
    status?: string;
    priority?: string;
    category?: string;
    assigneeId?: string;
    search?: string;
    tags?: string;
    source?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.set(key, String(val));
        }
      });
    }
    const qs = searchParams.toString();
    return api.get<{
      tickets: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/tickets${qs ? `?${qs}` : ''}`);
  },

  getMyTickets: (params?: {
    status?: string;
    source?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.set(key, String(val));
        }
      });
    }
    const qs = searchParams.toString();
    return api.get<{
      tickets: any[];
      total: number;
      page: number;
      limit: number;
    }>(`/tickets/my-tickets${qs ? `?${qs}` : ''}`);
  },

  getTicket: (id: string) => api.get<any>(`/tickets/${id}`),

  // Role-agnostic CSAT — any requester can rate their own resolved
  // ticket. Mirrors legacy studentApi.rateTicket() but works for
  // instructor/CM/finance/TA roles too.
  rateTicket: (id: string, rating: number) =>
    api.post<{ success: boolean }>(`/tickets/${id}/rate`, { rating }),

  updateTicket: (
    id: string,
    data: {
      status?: string;
      priority?: string;
      assigneeId?: string;
      onHoldReason?: string;
    },
  ) => api.patch<any>(`/tickets/${id}`, data),

  addComment: (
    id: string,
    data: {
      message: string;
      isInternal?: boolean;
      attachmentUrls?: string[];
      attachments?: {
        url: string;
        filename?: string;
        mimeType?: string;
        sizeBytes?: number;
      }[];
    },
  ) => api.post<any>(`/tickets/${id}/comments`, data),

  // Hold-approval workflow. Agents submit; supervisors/admins decide.
  createHoldRequest: (
    ticketId: string,
    data: { reason: string; description?: string | null },
  ) =>
    api.post<{
      id: string;
      ticketId: string;
      reason: string;
      description: string | null;
      status: string;
      createdAt: string;
    }>(`/tickets/${ticketId}/hold-requests`, data),

  decideHoldRequest: (
    ticketId: string,
    requestId: string,
    data: { decision: 'approved' | 'rejected'; note?: string | null },
  ) =>
    api.patch<{ ok: boolean; decision: 'approved' | 'rejected' }>(
      `/tickets/${ticketId}/hold-requests/${requestId}`,
      data,
    ),

  resolveTicket: (id: string) => api.post<any>(`/tickets/${id}/resolve`),

  closeTicket: (id: string) => api.post<any>(`/tickets/${id}/close`),

  getKPIs: () =>
    api.get<{
      openTickets: number;
      highPriorityOpen: number;
      slaBreaches: number;
      slaCompliance: number;
      avgFrtMinutes: number | null;
      avgTtrMinutes: number | null;
      avgResolutionHours: number | null;
      resolvedThisWeek: number;
      csatAvgScore: number;
      csatResponses: number;
      csatResponseRate: number;
      npsScore: number;
      npsResponses: number;
      statusBreakdown: Record<string, number>;
      unassignedCount: number;
      alerts: {
        breached: { id: string; subject: string; priority: string }[];
        unassigned: { id: string; subject: string; priority: string }[];
        highPriority: { id: string; subject: string; priority: string }[];
      };
    }>('/tickets/kpis'),

  // Admin Support Overview — single-payload feed for the new Overview
  // tab on the admin support page. Read-only.
  //
  // Optional `dateFrom`/`dateTo` scope the health metrics block
  // (avg FRT, avg TTR, SLA compliance %, escalations + the created
  // trend). "Current open" numbers stay as a live snapshot regardless.
  getSupportOverview: (params?: { dateFrom?: string; dateTo?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params?.dateTo) qs.set("dateTo", params.dateTo);
    const s = qs.toString();
    return api.get<{
      openTickets: number;
      awaitingResponse: number;
      overdueTickets: number;
      byPriority: Record<string, number>;
      byCategory: { category: string; count: number }[];
      agentWorkload: {
        agentId: string;
        agentName: string;
        activeCount: number;
      }[];
      csat: {
        averageScore: number;
        responseCount: number;
        responseRate: number;
        distribution: Record<string, number>;
      };
      health: {
        avgFrtMinutes: number | null;
        avgTtrMinutes: number | null;
        slaCompliancePct: number;
        escalationCount: number;
        sampleSize: number;
        windowFrom: string;
        windowTo: string;
      };
      agentDistribution: {
        agentId: string;
        agentName: string;
        supportSubRole: 'supervisor' | 'agent' | null;
        activeCount: number;
      }[];
      atRisk: {
        id: string;
        referenceNumber: string;
        subject: string;
        priority: string;
        minutesRemaining: number;
        target: 'frt' | 'ttr';
        assigneeId: string | null;
        assigneeName: string | null;
      }[];
      recentActivity: {
        id: string;
        ticketId: string;
        type: string;
        subject: string;
        timestamp: string;
        actor: string | null;
      }[];
      trends: {
        createdLast7: number;
        createdPrev7: number;
        createdDelta: number;
      };
      cronHealth: {
        name: string;
        lastStartedAt: string | null;
        lastFinishedAt: string | null;
        status: string;
        durationMs: number | null;
        errorMessage: string | null;
      }[];
      pendingTeamRequests: number;
      generatedAt: string;
    }>(
      s
        ? `/tickets/admin/support-overview?${s}`
        : '/tickets/admin/support-overview',
    );
  },

  // Admin-only — supervisors list with team aggregate stats. Optional
  // date range filters; defaults to last 30 days when omitted.
  listSupervisorsWithStats: (params?: {
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params?.dateTo) qs.set("dateTo", params.dateTo);
    const s = qs.toString();
    return api.get<
      {
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        avatar: string | null;
        lastLoginAt: string | null;
        teamSize: number;
        activeTickets: number;
        ticketsHandled: number;
        avgFrtMinutes: number | null;
        avgTtrMinutes: number | null;
        csatScore: number | null;
        slaBreachCount: number;
      }[]
    >(`/tickets/admin/supervisors${s ? `?${s}` : ''}`);
  },

  // Admin-only — full supervisor detail bundle.
  getSupervisorDetail: (
    id: string,
    params?: { dateFrom?: string; dateTo?: string },
  ) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params?.dateTo) qs.set("dateTo", params.dateTo);
    const s = qs.toString();
    return api.get<{
      supervisor: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        avatar: string | null;
        phone: string | null;
        lastLoginAt: string | null;
      };
      team: {
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        avatar: string | null;
        phone: string | null;
        isActive: boolean | null;
        lastLoginAt: string | null;
        assignedAt: string;
        supportSubRole: string | null;
        performance: {
          userId: string;
          ticketsHandled: number;
          avgFrtMinutes: number | null;
          avgTtrMinutes: number | null;
          csatScore: number | null;
          slaBreachCount: number;
        } | null;
      }[];
      supervisorTickets: {
        id: string;
        referenceNumber: string | null;
        subject: string;
        priority: string;
        status: string;
        createdAt: string;
        slaBreachedFrt: boolean;
        slaBreachedTtr: boolean;
      }[];
      aggregates: {
        teamSize: number;
        ticketsHandled: number;
        avgFrtMinutes: number | null;
        avgTtrMinutes: number | null;
        csatScore: number | null;
        slaBreachCount: number;
      };
      dateRange: { dateFrom: string | null; dateTo: string | null };
    }>(`/tickets/admin/supervisors/${id}${s ? `?${s}` : ''}`);
  },

  // Admin-only — paginated support audit trail. Each entry is one
  // immutable row from the support actions audit log (created, replied,
  // status/priority/assignee changed, resolved, closed, reopened).
  getSupportAuditTrail: (page = 1, limit = 20) => {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(limit));
    return api.get<{
      data: AuditTrailEntry[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(`/tickets/admin/audit-trail?${qs.toString()}`);
  },

  // Supervisor-scoped audit trail. Same shape as the admin endpoint
  // above; agents are 403'd at the service. Backs the supervisor's
  // /alerts page.
  getSupervisorAuditTrail: (page = 1, limit = 20) => {
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(limit));
    return api.get<{
      data: AuditTrailEntry[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(`/tickets/audit-trail?${qs.toString()}`);
  },

  getActivity: (limit = 20) =>
    api.get<
      {
        id: string;
        ticketId: string;
        type: 'created' | 'resolved' | 'closed' | 'staff_reply' | 'student_reply';
        subject: string;
        at: string;
      }[]
    >(`/tickets/activity?limit=${limit}`),

  // Per-user sidebar stats (for the logged-in agent / supervisor)
  getMyPerformance: () =>
    api.get<{
      totalTickets: number;
      resolvedCount: number;
      avgFrtMinutes: number | null;
      csatAvgScore: number | null;
      csatResponses: number;
      frtBreaches: number;
      ttrBreaches: number;
    }>('/tickets/my-performance'),

  getAgents: () =>
    api.get<
      {
        userId: string;
        supportSubRole: string | null;
        firstName: string | null;
        lastName: string | null;
        email: string;
      }[]
    >('/tickets/agents'),

  createAgent: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => api.post<any>('/tickets/agents', data),

  // ─── Team Management ───────────────────────────────
  getMyTeam: () =>
    api.get<
      {
        membershipId: string;
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        avatar: string | null;
        phone: string | null;
        isActive: boolean;
        lastLoginAt: string | null;
        assignedAt: string;
        supportSubRole: string | null;
        performance: {
          totalTickets: number;
          openTickets: number;
          resolvedTickets: number;
          avgFrtMinutes: number | null;
          csatAvgScore: number | null;
          csatResponses: number;
          frtBreaches: number;
          ttrBreaches: number;
        } | null;
      }[]
    >('/tickets/team/my'),

  getAvailableAgents: () =>
    api.get<
      {
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        avatar: string | null;
        supportSubRole: string | null;
      }[]
    >('/tickets/team/available-agents'),

  getTeamMemberDetail: (agentId: string) =>
    api.get<{
      agent: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        avatar: string | null;
        phone: string | null;
        isActive: boolean;
        createdAt: string;
        lastLoginAt: string | null;
        assignedAt: string;
        supervisorId: string;
      };
      performance: {
        totalTickets: number;
        openTickets: number;
        resolvedTickets: number;
        avgFrtMinutes: number | null;
        avgTtrMinutes: number | null;
        csatAvgScore: number | null;
        csatResponses: number;
        frtBreaches: number;
        ttrBreaches: number;
      } | null;
      openTickets: {
        id: string;
        referenceNumber?: string | null;
        subject: string;
        status: string;
        priority: string;
        createdAt: string;
      }[];
      recentCsat: {
        score: number | null;
        comment: string | null;
        submittedAt: string | null;
        ticketId: string;
      }[];
    }>(`/tickets/team/members/${agentId}`),

  removeTeamMember: (agentId: string) =>
    api.delete<{ success: true }>(`/tickets/team/members/${agentId}`),

  // Admin-side: list of active Support Supervisors used to populate the
  // supervisor picker in Create User / Manage Roles / Reassign Team.
  listActiveSupervisors: () =>
    api.get<
      {
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        teamSize: number;
      }[]
    >('/tickets/team/active-supervisors'),

  // Admin-side: Support Agents without a supervisor. Powers the
  // orphans banner on Team Management.
  listOrphanAgents: () =>
    api.get<
      {
        userId: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        avatar: string | null;
        isActive: boolean;
        createdAt: string;
      }[]
    >('/tickets/team/orphans'),

  // Bulk-assign one or more orphan agents to a supervisor.
  bulkAssignOrphans: (data: { supervisorId: string; agentIds: string[] }) =>
    api.post<{ assigned: number; skipped: number }>(
      '/tickets/team/orphans/bulk-assign',
      data,
    ),

  // Move every agent from one supervisor's team to another. Required
  // before the admin can demote / remove SUPPORT from a supervisor
  // whose team has members.
  reassignSupervisorTeam: (data: {
    fromSupervisorId: string;
    toSupervisorId: string;
  }) => api.post<{ moved: number }>('/tickets/team/reassign', data),

  createTeamRequest: (data: {
    kind: 'add_existing' | 'add_new';
    candidateUserId?: string;
    candidateEmail?: string;
    candidateFirstName?: string;
    candidateLastName?: string;
    candidatePhone?: string;
    reason?: string;
  }) => api.post<{ id: string; status: string }>('/tickets/team/requests', data),

  getMyTeamRequests: () =>
    api.get<
      {
        id: string;
        kind: string;
        candidateUserId: string | null;
        candidateEmail: string | null;
        candidateFirstName: string | null;
        candidateLastName: string | null;
        reason: string | null;
        status: string;
        decisionReason: string | null;
        createdAt: string;
        reviewedAt: string | null;
      }[]
    >('/tickets/team/requests/mine'),

  // Admin only
  listTeamRequests: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return api.get<
      {
        id: string;
        supervisorId: string;
        kind: string;
        candidateUserId: string | null;
        candidateEmail: string | null;
        candidateFirstName: string | null;
        candidateLastName: string | null;
        candidatePhone: string | null;
        reason: string | null;
        status: string;
        reviewedBy: string | null;
        reviewedAt: string | null;
        decisionReason: string | null;
        createdAt: string;
        supervisorFirstName: string | null;
        supervisorLastName: string | null;
        supervisorEmail: string | null;
        candidateExistingFirstName: string | null;
        candidateExistingLastName: string | null;
        candidateExistingEmail: string | null;
        reviewerFirstName: string | null;
        reviewerLastName: string | null;
      }[]
    >(`/tickets/team/requests${qs}`);
  },

  getPendingTeamRequestCount: () =>
    api.get<{ count: number }>('/tickets/team/requests/pending-count'),

  decideTeamRequest: (
    id: string,
    data: { decision: 'approve' | 'reject'; reason?: string; tempPassword?: string },
  ) => api.post<any>(`/tickets/team/requests/${id}/decision`, data),

  getSlaPolicies: () =>
    api.get<
      {
        id: string;
        priority: string;
        frtMinutes: number;
        ttrMinutes: number;
        escalateAfterMinutes: number;
        active: boolean;
      }[]
    >('/tickets/sla-policies'),

  updateSlaPolicy: (
    priority: string,
    data: {
      frtMinutes?: number;
      ttrMinutes?: number;
      escalateAfterMinutes?: number;
    },
  ) =>
    api.put<{
      id: string;
      priority: string;
      frtMinutes: number;
      ttrMinutes: number;
      escalateAfterMinutes: number;
    }>(`/tickets/sla-policies/${priority}`, data),

  // Instructor: create ticket on behalf of learner (IN-01)
  createTicketOnBehalf: (data: {
    studentId: string;
    category: string;
    subject: string;
    description: string;
    courseId?: string;
  }) => api.post<{ id: string }>('/tickets/on-behalf', data),

  // Instructor: tickets I opened for learners (IN-04)
  getTicketsOpenedByMe: () =>
    api.get<any[]>('/tickets/opened-by-me'),

  // Course Manager: ticket count per course (CM-01)
  getCourseTicketCount: (courseId: string) =>
    api.get<{ courseId: string; openCount: number }>(
      `/tickets/course/${courseId}/count`,
    ),

  // Guest ticket (login issues only — no auth)
  createGuestTicket: (data: {
    name: string;
    email: string;
    category: string;
    subject: string;
    description: string;
    recaptchaToken?: string;
    attachmentUrls?: string[];
  }) =>
    api.post<{ ticket: { id: string }; trackingToken: string }>(
      '/tickets/guest',
      data,
      { skipAuth: true },
    ),

  getGuestTicket: (trackingToken: string) =>
    api.get<any>(`/tickets/track/${trackingToken}`, { skipAuth: true }),

  addGuestReply: (trackingToken: string, message: string) =>
    api.post<any>(
      `/tickets/track/${trackingToken}/reply`,
      { message },
      { skipAuth: true },
    ),

  // CSAT Surveys (public — no auth). NPS surveys removed; supervisor
  // KPI still exposes an NPS-equivalent via getNpsSummary below, but
  // it's derived from course_ratings (see backend support.service.ts).
  getCsatSurvey: (surveyId: string) =>
    api.get<any>(`/tickets/csat/${surveyId}`, { skipAuth: true }),

  submitCsat: (surveyId: string, data: { score: number; comment?: string }) =>
    api.post<any>(`/tickets/csat/${surveyId}`, data, { skipAuth: true }),

  // Pending CSAT prompts surfaced in the global dashboard popup
  // so the user can rate without digging into the resolved ticket.
  // Auth-required, capped at 5, within the 72h response window.
  getPendingCsat: () =>
    api.get<
      {
        surveyId: string;
        ticketId: string;
        ticketReferenceNumber: string;
        ticketSubject: string;
        resolvedAt: string | null;
        agentName: string | null;
      }[]
    >(`/tickets/csat/pending`),

  // CSAT/NPS Summaries (auth required)
  getCsatSummary: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<{
      totalSent: number;
      totalResponded: number;
      responseRate: number;
      avgScore: number;
      distribution: Record<string, number>;
    }>(`/tickets/csat/summary${qs ? `?${qs}` : ''}`);
  },

  getCsatByCategory: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<
      {
        category: string;
        responses: number;
        avgScore: number;
        detractors: number;
        promoters: number;
      }[]
    >(`/tickets/csat/by-category${qs ? `?${qs}` : ''}`);
  },

  getCsatByAgent: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<
      {
        agentId: string | null;
        agentName: string | null;
        responses: number;
        avgScore: number;
        detractors: number;
        promoters: number;
      }[]
    >(`/tickets/csat/by-agent${qs ? `?${qs}` : ''}`);
  },

  getCsatMonthlyTrend: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<
      {
        bucket: string;
        responses: number;
        avgScore: number;
        detractors: number;
        promoters: number;
      }[]
    >(`/tickets/csat/monthly${qs ? `?${qs}` : ''}`);
  },

  getLowRatingSurveys: (params?: {
    dateFrom?: string;
    dateTo?: string;
    status?: 'pending' | 'completed' | 'all';
  }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    if (params?.status) sp.set('status', params.status);
    const qs = sp.toString();
    return api.get<
      {
        surveyId: string;
        score: number;
        comment: string | null;
        submittedAt: string | null;
        followUpCompletedAt: string | null;
        ticketId: string;
        ticketReference: string;
        ticketSubject: string;
        ticketCategory: string;
        agentId: string | null;
        agentName: string | null;
        followUpBy: string | null;
      }[]
    >(`/tickets/csat/low-ratings${qs ? `?${qs}` : ''}`);
  },

  markCsatFollowedUp: (surveyId: string) =>
    api.post<{ surveyId: string; followUpCompletedAt: string }>(
      `/tickets/csat/${surveyId}/follow-up`,
      {},
    ),

  getSlaBreaches: () =>
    api.get<any[]>('/tickets/sla/breaches'),

  getSlaBacklog: () =>
    api.get<{ buckets: { label: string; count: number }[]; total: number }>(
      '/tickets/sla/backlog',
    ),

  getNpsSummary: () =>
    api.get<{
      totalSent: number;
      totalResponded: number;
      responseRate: number;
      promoters: number;
      passives: number;
      detractors: number;
      npsScore: number;
    }>('/tickets/nps/summary'),

  // Reports API
  getVolumeReport: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<any[]>(`/tickets/reports/volume${qs ? `?${qs}` : ''}`);
  },

  getTopIssues: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<any[]>(`/tickets/reports/issues${qs ? `?${qs}` : ''}`);
  },

  getSlaComplianceReport: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<any>(`/tickets/reports/sla-compliance${qs ? `?${qs}` : ''}`);
  },

  getAgentPerformance: (params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    const qs = sp.toString();
    return api.get<any[]>(`/tickets/reports/agent-performance${qs ? `?${qs}` : ''}`);
  },

  getTicketTrend: (params?: {
    dateFrom?: string;
    dateTo?: string;
    interval?: 'day' | 'week';
  }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    if (params?.interval) sp.set('interval', params.interval);
    const qs = sp.toString();
    return api.get<{ bucket: string; created: number; resolved: number }[]>(
      `/tickets/reports/trend${qs ? `?${qs}` : ''}`,
    );
  },

  getRecentCsatComments: (limit: number = 10) =>
    api.get<
      {
        id: string;
        score: number | null;
        comment: string | null;
        submittedAt: string | null;
        ticketId: string;
        ticketSubject: string;
        assigneeFirstName: string | null;
        assigneeLastName: string | null;
      }[]
    >(`/tickets/reports/csat-comments?limit=${limit}`),

  exportReport: (type: string, params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams({ type });
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    return api.get<{ csv: string; filename: string }>(`/tickets/reports/export?${sp.toString()}`);
  },

  // PDF export — returns a direct download URL (binary response)
  getExportPdfUrl: (type: string, params?: { dateFrom?: string; dateTo?: string }) => {
    const sp = new URLSearchParams({ type });
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    return `/tickets/reports/export-pdf?${sp.toString()}`;
  },

  // PDF export — fetches the binary, builds a download Blob, returns it.
  // Centralised here so report UIs don't poke at process.env directly or
  // re-implement the auth-header dance every call site.
  downloadExportPdf: async (
    type: string,
    params?: { dateFrom?: string; dateTo?: string },
  ): Promise<Blob> => {
    const endpoint = supportApi.getExportPdfUrl(type, params);
    return fetchBlob(endpoint);
  },

  // Macros CRUD
  getMacros: (opts?: { categoryKey?: string | null; includeInactive?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.categoryKey) params.set('categoryKey', opts.categoryKey);
    if (opts?.includeInactive) params.set('includeInactive', 'true');
    const qs = params.toString();
    return api.get<
      {
        id: string;
        title: string;
        bodyTemplate: string;
        bodyAr: string | null;
        categoryKey: string | null;
        kbArticleUrls: string[] | null;
        isActive: boolean;
        createdAt: string;
        creatorFirstName: string | null;
        creatorLastName: string | null;
        useCount: number;
        lastUsedAt: string | null;
      }[]
    >(`/tickets/macros${qs ? `?${qs}` : ''}`);
  },

  getMacro: (id: string) => api.get<any>(`/tickets/macros/${id}`),

  createMacro: (data: {
    title: string;
    bodyTemplate: string;
    bodyAr?: string | null;
    categoryKey?: string | null;
    variables?: string[];
    kbArticleUrls?: string[];
  }) => api.post<any>('/tickets/macros', data),

  updateMacro: (
    id: string,
    data: {
      title?: string;
      bodyTemplate?: string;
      bodyAr?: string | null;
      categoryKey?: string | null;
      kbArticleUrls?: string[];
      isActive?: boolean;
    },
  ) => api.patch<any>(`/tickets/macros/${id}`, data),

  deleteMacro: (id: string) =>
    api.delete<any>(`/tickets/macros/${id}`),

  applyMacro: (ticketId: string, macroId: string, locale?: string) =>
    api.post<{ resolvedBody: string; macroTitle: string }>(
      `/tickets/${ticketId}/apply-macro`,
      { macroId, locale },
    ),

  getMacroUsageStats: () =>
    api.get<{
      totalUses: number;
      totalMacros: number;
      unusedCount: number;
      perMacro: {
        id: string;
        title: string;
        categoryKey: string | null;
        isActive: boolean;
        useCount: number;
        lastUsedAt: string | null;
      }[];
      perCategory: {
        categoryKey: string;
        uses: number;
        macroCount: number;
      }[];
      monthly: { bucket: string; uses: number }[];
    }>('/tickets/macros/usage-stats'),

  // Manual ticket escalation. Supervisor + admin only.
  escalateTicket: (
    ticketId: string,
    data: { reason: string; bumpPriority?: 'medium' | 'high' },
  ) =>
    api.post<{
      success: true;
      escalatedAt: string;
      priority: string;
    }>(`/tickets/${ticketId}/escalate`, data),

  // ─── Phase 2 — Ticket collaborators ────────────────────

  listCollaborators: (ticketId: string) =>
    api.get<{
      collaborators: {
        id: string;
        userId: string;
        department: string;
        addedAt: string;
        userName: string | null;
        userEmail: string | null;
        addedBy: { id: string; name: string | null } | null;
      }[];
    }>(`/tickets/${ticketId}/collaborators`),

  addCollaborator: (
    ticketId: string,
    data: {
      userId: string;
      department: string;
      // Optional context reply posted as an internal comment so the
      // new collab can see WHY they were looped in. When both message
      // and attachments are absent the loop-in is silent (legacy
      // behavior). See addCollaborator() in support.service.ts.
      message?: string;
      attachments?: {
        url: string;
        filename?: string;
        mimeType?: string;
        sizeBytes?: number;
      }[];
    },
  ) =>
    api.post<{ id: string; alreadyActive: boolean }>(
      `/tickets/${ticketId}/collaborators`,
      data,
    ),

  removeCollaborator: (ticketId: string, userId: string) =>
    api.delete<{ ok: true; alreadyRemoved: boolean }>(
      `/tickets/${ticketId}/collaborators/${userId}`,
    ),

  getDepartmentMembers: (
    dept: string,
    opts?: { courseId?: string },
  ) => {
    const qs = opts?.courseId ? `?courseId=${encodeURIComponent(opts.courseId)}` : '';
    return api.get<{
      members: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        courseRoleLabel?: string;
      }[];
    }>(`/tickets/departments/${encodeURIComponent(dept)}/members${qs}`);
  },

  transferTicket: (
    ticketId: string,
    data: {
      toCategory: string;
      toDepartment: string;
      userId?: string;
      noteToRequester?: string;
      // Optional supporting docs pinned to the transfer system
      // message — visible to the requester alongside the note.
      attachments?: {
        url: string;
        filename?: string;
        mimeType?: string;
        sizeBytes?: number;
      }[];
    },
  ) =>
    api.post<{
      ok: true;
      toCategory: string;
      toDepartment: string;
      toUserId: string;
      systemMessage: string;
    }>(`/tickets/${ticketId}/transfer`, data),

  getLoopedInTickets: (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    return api.get<
      {
        id: string;
        referenceNumber: string;
        subject: string;
        category: string;
        priority: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        loopedInAt: string;
        loopedInAs: string;
        requesterName: string | null;
      }[]
    >(`/tickets/looped-in${qs}`);
  },

  // Knowledge Base CRUD
  getKbArticles: (params?: { category?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    return api.get<any[]>(
      `/tickets/kb/articles${qs ? `?${qs}` : ''}`,
      { skipAuth: true },
    );
  },

  getKbArticle: (id: string) =>
    api.get<any>(`/tickets/kb/articles/${id}`, { skipAuth: true }),

  createKbArticle: (data: {
    titleEn?: string;
    titleAr?: string;
    bodyEn?: string;
    bodyAr?: string;
    category: string;
    published?: boolean;
  }) => api.post<any>('/tickets/kb/articles', data),

  updateKbArticle: (id: string, data: any) =>
    api.patch<any>(`/tickets/kb/articles/${id}`, data),

  deleteKbArticle: (id: string) =>
    api.delete<any>(`/tickets/kb/articles/${id}`),

  // ─── Settings ─────────────────────────────────────
  getBusinessHours: () =>
    api.get<{
      workingDays: number[];
      openTime: string;
      closeTime: string;
      timezoneOffsetHours: number;
    }>('/tickets/settings/business-hours', { skipAuth: true }),

  setBusinessHours: (data: {
    workingDays?: number[];
    openTime?: string;
    closeTime?: string;
    timezoneOffsetHours?: number;
  }) => api.patch<any>('/tickets/settings/business-hours', data),

  getAutoAssignment: () =>
    api.get<{
      enabled: boolean;
      strategy: 'round_robin' | 'least_loaded' | 'manual';
      respectBusinessHours: boolean;
      maxConcurrentPerAgent: number;
    }>('/tickets/settings/auto-assignment'),

  setAutoAssignment: (data: {
    enabled?: boolean;
    strategy?: 'round_robin' | 'least_loaded' | 'manual';
    respectBusinessHours?: boolean;
    maxConcurrentPerAgent?: number;
  }) => api.patch<any>('/tickets/settings/auto-assignment', data),

  listTicketCategories: (params?: { role?: string }) => {
    const qs = params?.role ? `?role=${encodeURIComponent(params.role)}` : '';
    return api.get<
      {
        slug: string;
        nameEn: string;
        nameAr: string | null;
        autoPriority: 'high' | 'medium' | 'low' | null;
        applicableRoles: string[];
        builtin: boolean;
        requiresCourse: boolean;
        suggestedDepartment: string | null;
      }[]
    >(`/tickets/settings/ticket-categories${qs}`, { skipAuth: true });
  },

  addTicketCategory: (data: {
    slug?: string;
    nameEn: string;
    nameAr?: string;
    autoPriority?: 'high' | 'medium' | 'low';
    applicableRoles: string[];
  }) => api.post<{ slug: string }>('/tickets/settings/ticket-categories', data),

  updateTicketCategory: (
    slug: string,
    data: {
      nameEn?: string;
      nameAr?: string | null;
      autoPriority?: 'high' | 'medium' | 'low' | null;
      applicableRoles?: string[];
    },
  ) =>
    api.patch<{ slug: string }>(
      `/tickets/settings/ticket-categories/${encodeURIComponent(slug)}`,
      data,
    ),

  removeTicketCategory: (slug: string) =>
    api.delete<{ success: true }>(
      `/tickets/settings/ticket-categories/${encodeURIComponent(slug)}`,
    ),

  getSupportNotificationPrefs: () =>
    api.get<Record<string, boolean>>('/tickets/settings/notification-prefs'),

  setSupportNotificationPrefs: (data: Record<string, boolean>) =>
    api.patch<Record<string, boolean>>('/tickets/settings/notification-prefs', data),

  // Help Center categories
  listKbCategories: () =>
    api.get<
      {
        id: string;
        slug: string;
        nameEn: string;
        nameAr: string | null;
        icon: string;
        sortOrder: number;
        articleCount: number;
        createdAt: string;
      }[]
    >('/tickets/kb/categories', { skipAuth: true }),

  createKbCategory: (data: {
    slug?: string;
    nameEn: string;
    nameAr?: string;
    icon?: string;
    sortOrder?: number;
  }) => api.post<any>('/tickets/kb/categories', data),

  updateKbCategory: (
    id: string,
    data: { nameEn?: string; nameAr?: string; icon?: string; sortOrder?: number },
  ) => api.patch<any>(`/tickets/kb/categories/${id}`, data),

  deleteKbCategory: (id: string) =>
    api.delete<{ success: true }>(`/tickets/kb/categories/${id}`),

  // ── KB search analytics ────────────────────────────────────
  //
  // Log fires from the public help center after a debounced search.
  // Best-effort: failures are swallowed in the caller so a network
  // hiccup doesn't break the UI.

  logKbSearch: (data: { query: string; locale: string; resultsCount: number }) =>
    api.post<{ success: true }>('/tickets/kb/searches', data, {
      skipAuth: true,
    }),

  getKbSearchAnalytics: (params?: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.dateFrom) sp.set('dateFrom', params.dateFrom);
    if (params?.dateTo) sp.set('dateTo', params.dateTo);
    if (params?.limit) sp.set('limit', String(params.limit));
    return api.get<{
      totalSearches: number;
      zeroResultSearches: number;
      zeroResultRate: number;
      topQueries: {
        query: string;
        locale: string;
        searches: number;
        avgResults: string;
        zeroResultCount: number;
      }[];
    }>(`/tickets/kb/search-analytics${sp.toString() ? `?${sp.toString()}` : ''}`);
  },

  getMostViewedKbArticles: (params?: { limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    return api.get<
      {
        id: string;
        titleEn: string | null;
        titleAr: string | null;
        category: string;
        viewCount: number;
        updatedAt: string;
      }[]
    >(`/tickets/kb/articles/analytics/most-viewed${sp.toString() ? `?${sp.toString()}` : ''}`);
  },

  getLowEngagementKbArticles: (params?: { limit?: number; minAgeDays?: number }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.minAgeDays) sp.set('minAgeDays', String(params.minAgeDays));
    return api.get<
      {
        id: string;
        titleEn: string | null;
        titleAr: string | null;
        category: string;
        viewCount: number;
        createdAt: string;
      }[]
    >(`/tickets/kb/articles/analytics/low-engagement${sp.toString() ? `?${sp.toString()}` : ''}`);
  },

  // Image upload for article bodies — reuses the trainer-doc bucket
  // since it already accepts image MIME types and is public-served.
  uploadKbImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFormData<{ url: string; filename: string }>(
      '/storage/upload',
      fd,
    );
  },

  // ── Ticket tags ─────────────────────────────────────────────
  // The registry is readable by any support user (we need to render
  // chips); mutations are gated to supervisor/admin on the server.

  listTicketTags: (opts: { includeArchived?: boolean } = {}) =>
    api.get<
      {
        id: string;
        name: string;
        color: string;
        description: string | null;
        createdAt: string;
        archivedAt: string | null;
        usageCount: number;
        ruleCount: number;
      }[]
    >(
      `/tickets/tags${opts.includeArchived ? '?includeArchived=true' : ''}`,
    ),

  createTicketTag: (data: { name: string; color?: string; description?: string }) =>
    api.post<{ id: string; name: string; color: string }>('/tickets/tags', data),

  updateTicketTag: (
    id: string,
    data: { name?: string; color?: string; description?: string },
  ) => api.patch<{ id: string; name: string; color: string }>(`/tickets/tags/${id}`, data),

  deleteTicketTag: (id: string) =>
    api.delete<{ success: true }>(`/tickets/tags/${id}`),

  archiveTicketTag: (id: string) =>
    api.post<{ id: string; archivedAt: string }>(`/tickets/tags/${id}/archive`, {}),

  unarchiveTicketTag: (id: string) =>
    api.post<{ id: string }>(`/tickets/tags/${id}/unarchive`, {}),

  // ── Tag rules (auto-apply patterns) ─────────────────────────

  listTagRules: (tagId: string) =>
    api.get<
      {
        id: string;
        tagId: string;
        pattern: string;
        matchScope: 'subject' | 'description' | 'both';
        enabled: boolean;
        createdAt: string;
      }[]
    >(`/tickets/tags/${tagId}/rules`),

  createTagRule: (
    tagId: string,
    data: {
      pattern: string;
      matchScope?: 'subject' | 'description' | 'both';
      enabled?: boolean;
    },
  ) =>
    api.post<{ id: string; pattern: string }>(
      `/tickets/tags/${tagId}/rules`,
      data,
    ),

  updateTagRule: (
    ruleId: string,
    data: {
      pattern?: string;
      matchScope?: 'subject' | 'description' | 'both';
      enabled?: boolean;
    },
  ) =>
    api.patch<{ id: string; pattern: string }>(
      `/tickets/tag-rules/${ruleId}`,
      data,
    ),

  deleteTagRule: (ruleId: string) =>
    api.delete<{ success: true }>(`/tickets/tag-rules/${ruleId}`),

  // ── Tag analytics ───────────────────────────────────────────

  getTagAnalytics: () =>
    api.get<{
      totalTags: number;
      archivedTags: number;
      topTags: {
        tagId: string;
        name: string;
        color: string;
        archived: boolean;
        usageCount: number;
        last30Count: number;
        resolvedCount: number;
      }[];
      trend: { day: string; count: number }[];
      byCategory: {
        category: string;
        tags: { tagId: string; name: string; color: string; count: number }[];
      }[];
    }>('/tickets/tags/analytics/summary'),

  // Replace the ticket's full tag set. Server-side accepts an empty
  // array and clears the tags — matches the obvious UX of "deselect
  // all then save".
  setTicketTags: (ticketId: string, tagIds: string[]) =>
    api.patch<{ id: string; name: string; color: string }[]>(
      `/tickets/${ticketId}/tags`,
      { tagIds },
    ),

  // Download the ticket's full history as a CSV. Server picks the
  // filename and includes the human-readable reference in it.
  exportTicketHistory: async (ticketId: string, referenceNumber?: string | null) => {
    const blob = await fetchBlob(`/tickets/${ticketId}/export`);
    const ts = new Date().toISOString().slice(0, 10);
    const base = (referenceNumber || ticketId).replace(/[^a-zA-Z0-9-]/g, '_');
    downloadBlob(blob, `ticket_${base}_${ts}.csv`);
  },

  // Compliance ZIP — conversation + attachments + audit + SLA +
  // manifest. Larger payload than the CSV; suitable for legal/audit
  // handover, not for quick scrubbing.
  exportTicketArchive: async (ticketId: string, referenceNumber?: string | null) => {
    const blob = await fetchBlob(`/tickets/${ticketId}/export-archive`);
    const ts = new Date().toISOString().slice(0, 10);
    const base = (referenceNumber || ticketId).replace(/[^a-zA-Z0-9-]/g, '_');
    downloadBlob(blob, `ticket_${base}_${ts}.zip`);
  },

  // ── R3 governance ──────────────────────────────────────────

  getMergeCandidates: (sourceId: string) =>
    api.get<
      {
        id: string;
        referenceNumber: string;
        subject: string;
        status: string;
        priority: string;
        createdAt: string;
      }[]
    >(`/tickets/${sourceId}/merge-candidates`),

  // Chronological activity feed for the ticket's requester.
  // BE filters events by ticket.source — a multi-role user (e.g.
  // instructor + manager) won't see cross-role activity bleed.
  // Returns isGuest=true and empty events for guest tickets.
  getTicketStudentTimeline: (ticketId: string) =>
    api.get<{
      isGuest: boolean;
      role:
        | 'student'
        | 'instructor'
        | 'manager'
        | 'ta'
        | 'finance'
        | 'guest';
      events: {
        type:
          | 'ticket'
          | 'enrollment'
          | 'webinar'
          | 'payment'
          | 'certificate'
          | 'session'
          | 'intervention'
          | 'course_managed'
          | 'ta_assignment';
        timestamp: string;
        title: string;
        subtitle: string | null;
        status: string | null;
        linkTarget: { kind: 'ticket'; ticketId: string } | null;
      }[];
    }>(`/tickets/${ticketId}/student-timeline`),

  // Requester snapshot panel — at-a-glance KPIs scoped to the
  // ticket source role. BE dispatches by ticket.source so the
  // card never shows another role's data even when the user
  // holds multiple roles. Returns isGuest=true and snapshot=null
  // for guest tickets.
  getTicketStudentContext: (ticketId: string) =>
    api.get<{
      isGuest: boolean;
      role:
        | 'student'
        | 'instructor'
        | 'manager'
        | 'ta'
        | 'finance'
        | 'guest';
      snapshot:
        | {
            courses: { total: number; active: number; completed: number };
            webinars: { total: number; attended: number; upcoming: number };
            attendance: { percent: number | null; sessionCount: number };
            certificates: { issued: number; pending: number; revoked: number };
            cme: { earned: number; pending: number };
            payments: {
              totalPaidSar: number;
              completedCount: number;
              pendingCount: number;
              failedCount: number;
              refundedCount: number;
              lastPaymentAt: string | null;
            };
          }
        | {
            courses: { teaching: number };
            students: { total: number };
            sessions: { total: number; thisMonth: number };
            interventions: { total: number; thisMonth: number };
          }
        | {
            courses: { managed: number };
            instructors: { count: number };
            students: { total: number };
          }
        | {
            courses: { assisting: number };
            sessions: { total: number; thisMonth: number };
          }
        | { tickets: { raised: number } }
        | null;
    }>(`/tickets/${ticketId}/student-context`),

  // Per-course certificate & CME details for the ticket's student.
  // Powers the cert/CME panel in the ticket-detail right rail. Returns
  // isGuest=true and details=null for guest tickets (FE hides panel).
  getTicketCertificateDetails: (ticketId: string) =>
    api.get<{
      isGuest: boolean;
      details:
        | {
            courseId: string;
            courseTitle: string;
            courseTitleAr: string | null;
            deliveryType: string;
            isCmeAccredited: boolean;
            cmeHours: number;
            enrollmentStatus: string;
            eligibility:
              | 'eligible'
              | 'partial'
              | 'ineligible'
              | 'revoked'
              | 'not_requested';
            attendancePercent: number | null;
            attendanceThreshold: number;
            attendanceApplicable: boolean;
            assessmentStatus: 'passed' | 'failed' | 'not_attempted';
            certificate: {
              id: string;
              status: string;
              issuedAt: string | null;
              revokedAt: string | null;
              rejectedAt: string | null;
              verificationCode: string;
              certificateUrl: string | null;
            } | null;
          }[]
        | null;
    }>(`/tickets/${ticketId}/certificate-details`),

  // Trainer application context for the ticket — match by student
  // email (logged-in) OR guest email. Returns { application: null }
  // when there's no matching role_request; the FE hides the card.
  getTicketTrainerApplication: (ticketId: string) =>
    api.get<{
      application: {
        id: string;
        status: RoleRequestStatus;
        requestedRole: string;
        submittedAt: string;
        reviewedAt: string | null;
        reviewNote: string | null;
        missingRequirements: MissingRequirement[] | null;
        applicantId: string;
      } | null;
      events: RoleRequestEvent[];
    }>(`/tickets/${ticketId}/trainer-application`),

  mergeTicket: (sourceId: string, targetTicketId: string, note?: string) =>
    api.post<{ success: true; targetTicketId: string }>(
      `/tickets/${sourceId}/merge`,
      { targetTicketId, note },
    ),

  getTicketAuditLog: (ticketId: string, limit?: number) =>
    api.get<
      {
        id: string;
        action: string;
        performedBy: string;
        metadata: Record<string, unknown> | null;
        createdAt: string;
        performerFirstName: string | null;
        performerLastName: string | null;
        performerEmail: string | null;
      }[]
    >(`/tickets/${ticketId}/audit${limit ? `?limit=${limit}` : ''}`),

  recordAttachmentDownload: (ticketId: string, attachmentUrl: string) =>
    api.post<{ success: true }>(`/tickets/${ticketId}/attachment-download`, {
      attachmentUrl,
    }),

  getAttachmentDownloadLog: (ticketId: string) =>
    api.get<
      {
        id: string;
        attachmentUrl: string;
        downloadedAt: string;
        ipAddress: string | null;
        downloaderFirstName: string | null;
        downloaderLastName: string | null;
        downloaderEmail: string | null;
      }[]
    >(`/tickets/${ticketId}/attachment-download-log`),

  // Full version history — active + soft-deleted, with uploader and
  // (where applicable) remover. Staff-only — service enforces.
  getAttachmentHistory: (ticketId: string) =>
    api.get<
      {
        id: string;
        replyId: string | null;
        url: string;
        filename: string | null;
        sizeBytes: number;
        mimeType: string | null;
        uploadedAt: string;
        removedAt: string | null;
        sha256: string | null;
        uploaderId: string | null;
        uploaderFirstName: string | null;
        uploaderLastName: string | null;
        uploaderEmail: string | null;
        removerId: string | null;
        removerFirstName: string | null;
        removerLastName: string | null;
        removerEmail: string | null;
      }[]
    >(`/tickets/${ticketId}/attachment-history`),

  // Soft-delete an attachment (assignee / supervisor / admin).
  // The row stays — it just drops out of the active chip list.
  softDeleteAttachment: (ticketId: string, attachmentId: string) =>
    api.delete<{ success: true; attachmentId: string }>(
      `/tickets/${ticketId}/attachments/${attachmentId}`,
    ),

  getRetentionConfig: () =>
    api.get<{ retentionDays: number }>('/tickets/config/retention'),

  setRetentionConfig: (days: number) =>
    api.patch<{ success: true; retentionDays: number }>(
      '/tickets/config/retention',
      { days },
    ),
};

// ===========================================
// Payment API
// ===========================================

export const paymentApi = {
  initiate: (data: {
    // One element for express buys; multiple for cart checkout. Backend
    // validates 1..20 and de-duplicates.
    courseIds: string[];
    gateway: string;
    // Optional: send only for card-family gateways. Bank transfer leaves
    // this off entirely because the DB CHECK constraint on payment_method
    // doesn't include 'bank_transfer' (the value lives in `gateway`).
    paymentMethod?: string;
    // REAL coupon code the buyer typed (or an auto-applied code-based
    // early-bird). NEVER a synthetic `CAMPAIGN:xxx` string — the
    // direct-campaign leg rides on `applyActiveCampaign` below.
    discountCode?: string;
    // Opt-in for stacking the active direct-campaign discount on top of
    // the cart. Set when the auto-apply endpoint returned
    // `isCampaignDirect: true`. Backend re-validates eligibility.
    applyActiveCampaign?: boolean;
    locale?: string;
  }) => api.post<{ paymentId: string; redirectUrl: string; amount: number; currency: string }>('/payments/initiate', data),

  /**
   * Read-only quote for the bank-transfer "draft" page. Same validation as
   * /initiate (course exists, capacity, NELC, discount) — but no DB row is
   * created. Returns the line items + totals to render the summary.
   */
  quote: (data: {
    courseIds: string[];
    discountCode?: string;
    applyActiveCampaign?: boolean;
  }) =>
    api.post<{
      courseIds: string[];
      lineItems: Array<{
        id: string;
        title: string;
        titleAr: string | null;
        thumbnail: string | null;
        price: number;
        effectivePrice: number;
        onSale: boolean;
        salePercent: number | null;
        saleAllowsCoupon: boolean;
        deliveryType: string | null;
        startDate: string | null;
        cmeHours: number;
      }>;
      totals: {
        originalSubtotal: number;
        subtotal: number;
        saleDiscount: number;
        // Combined (campaign + coupon) — kept for backward compat.
        discountAmount: number;
        discountCode: string | null;
        discountId: string | null;
        // Coupon leg only.
        couponAmount: number;
        couponId: string | null;
        couponCode: string | null;
        // Direct-campaign leg (may be zero when only a coupon fired,
        // or non-zero when the buyer accepted an auto-applied campaign).
        campaignAmount: number;
        campaignId: string | null;
        campaignName: string | null;
        taxAmount: number;
        taxRate?: number;
        // Per-course treatment applied by the backend. 'exempt' and
        // 'zero_rated' both mean taxAmount === 0; 'standard' means the
        // global vatRate applied. UI uses this to render either "VAT
        // (rate%)", "Zero-rated (0%)", or omit the line entirely.
        vatTreatment?: 'standard' | 'exempt' | 'zero_rated';
        totalAmount: number;
        currency: string;
      };
    }>('/payments/quote', data),

  /**
   * Tabby background pre-scoring check. Called on checkout page mount + when
   * the cart amount changes. Returns { eligible: false, message: '...' } if
   * Tabby's underwriting would reject this buyer-cart pair — the FE then
   * hides the Tabby radio so the buyer isn't presented an option they
   * can't actually use. See backend prescoreTabby + Tabby docs:
   * https://docs.tabby.ai/pay-in-4-custom-integration/checkout-flow#background-pre-scoring-check
   */
  tabbyPreScore: (data: {
    courseIds: string[];
    discountCode?: string;
    applyActiveCampaign?: boolean;
    locale?: 'ar' | 'en';
  }) =>
    api.post<{ eligible: boolean; reason?: string; message?: string }>(
      '/payments/tabby/pre-score',
      data,
    ),

  /**
   * Which payment gateways admin has enabled at checkout right now.
   * Returns booleans for each of the four gateways. Missing key on the
   * server → true (backward-compat). Consumed by CheckoutPageClient on
   * mount and by BnplPromoWidgets to gate widget rendering.
   */
  getVisibleGateways: () =>
    api.get<VisibleGatewaysResponse>('/payments/gateways/visible'),

  verify: (paymentId: string) =>
    api.post<{ status: string; paymentId: string; amount?: string; currency?: string; gateway?: string; paidAt?: string; failureReason?: string }>(`/payments/verify/${paymentId}`),

  // Verify by the gateway's charge/invoice id (Moyasar redirects back with the
  // invoice id, not our payment_id). Returns our payment id in the response.
  verifyByCharge: (chargeId: string) =>
    api.post<{ status: string; paymentId: string; amount?: string; currency?: string; gateway?: string; paidAt?: string; failureReason?: string }>(`/payments/verify-charge/${chargeId}`),

  getMyPayments: (page = 1, limit = 10) =>
    api.get<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/payments/my-payments?page=${page}&limit=${limit}`),

  getAll: (
    page = 1,
    limit = 10,
    filters?: {
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      gateway?: string;
      paymentMethod?: string;
      includeAbandoned?: boolean;
    },
  ) => {
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.status && filters.status !== 'all') sp.set('status', filters.status);
    if (filters?.search) sp.set('search', filters.search);
    if (filters?.startDate) sp.set('startDate', filters.startDate);
    if (filters?.endDate) sp.set('endDate', filters.endDate);
    if (filters?.gateway && filters.gateway !== 'all') sp.set('gateway', filters.gateway);
    if (filters?.paymentMethod && filters.paymentMethod !== 'all') sp.set('paymentMethod', filters.paymentMethod);
    if (filters?.includeAbandoned) sp.set('includeAbandoned', 'true');
    return api.get<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/payments?${sp.toString()}`);
  },

  getDetail: (paymentId: string) =>
    api.get<{
      payment: {
        id: string;
        userId: string;
        userName: string;
        userEmail: string;
        courseId: string;
        courseTitle: string;
        courseTitleAr: string | null;
        gateway: string;
        gatewayChargeId: string | null;
        paymentMethod: string | null;
        amount: string;
        currency: string;
        status: string;
        gatewayResponse: Record<string, unknown> | null;
        errorCode: string | null;
        failureReason: string | null;
        metadata: Record<string, unknown> | null;
        paidAt: string | null;
        failedAt: string | null;
        createdAt: string;
        updatedAt: string;
        invoiceId: string | null;
        invoiceNumber: string | null;
        invoiceStatus: string | null;
        invoiceIssuedAt: string | null;
        invoiceTotal: string | null;
      };
      receipt: {
        id: string;
        fileName: string;
        mimeType: string;
        fileSizeBytes: number;
        scanStatus: string;
        reviewStatus: string;
        reviewerNote: string | null;
        financeInternalNote: string | null;
        reviewedAt: string | null;
        uploadedAt: string;
        refundAccountHolder: string | null;
        refundIban: string | null;
        refundBankName: string | null;
        refundNationalId: string | null;
        downloadUrl: string | null;
      } | null;
      refunds: Array<{
        id: string;
        amount: string;
        deductionAmount: string;
        reason: string;
        reasonNote: string | null;
        status: string;
        requestedAt: string;
        approvedAt: string | null;
        completedAt: string | null;
        rejectedAt: string | null;
        gatewayRefundId: string | null;
      }>;
      reconciliation: {
        id: string;
        driftType: string;
        status: string;
        createdAt: string;
        resolvedAt: string | null;
        escalationId: string | null;
        escalationStatus: string | null;
        escalationUrgency: string | null;
        escalationActionTaken: string | null;
      } | null;
      lineItems: Array<{
        paymentItemId: string | null;
        courseId: string;
        courseTitle: string | null;
        courseTitleAr: string | null;
        enrollmentId: string | null;
        enrollmentStatus: string | null;
        unitPrice: number;
        lineSubtotal: number;
        lineDiscount: number;
        lineVat: number;
        lineTotal: number;
        alreadyRefundedByRefundId: string | null;
      }>;
    }>(`/payments/${paymentId}/detail`),

  getAudit: (paymentId: string, limit = 50) =>
    api.get<Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>>(`/payments/${paymentId}/audit?limit=${limit}`),

  /**
   * Admin-triggered abandoned-payment sweep. Same logic the cron runs nightly;
   * surfaced as a button on the Payments page so finance can flip stale
   * pending rows immediately instead of waiting for the next tick.
   */
  runAbandonedSweep: () =>
    api.post<{ sweptCount: number; cutoff: string }>('/payments/abandoned-sweep/run'),
};

// ===========================================
// Bank Transfer API
// ===========================================

export interface BankTransferDetails {
  bankNameEn: string;
  bankNameAr: string;
  beneficiaryEn: string;
  beneficiaryAr: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  instructionsEn: string;
  instructionsAr: string;
}

export interface BankTransferReceiptSummary {
  id: string;
  fileName: string;
  scanStatus: 'pending' | 'clean' | 'infected' | 'error';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewerNote: string | null;
  uploadedAt: string;
}

export interface BankTransferPayment {
  payment: {
    id: string;
    courseId: string;
    amount: string;
    currency: string;
    status: string;
    gateway: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  };
  course: { id: string; title: string } | null;
  activeReceipt: BankTransferReceiptSummary | null;
}

export const bankTransferApi = {
  getDetails: () => api.get<BankTransferDetails>('/payments/bank-transfer/details'),

  getPayment: (paymentId: string) =>
    api.get<BankTransferPayment>(`/payments/bank-transfer/${paymentId}`),

  uploadReceipt: (
    paymentId: string,
    file: File,
    refundInfo: {
      refundAccountHolder: string;
      refundIban: string;
      refundBankName: string;
      refundNationalId?: string;
    },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('refundAccountHolder', refundInfo.refundAccountHolder);
    fd.append('refundIban', refundInfo.refundIban);
    fd.append('refundBankName', refundInfo.refundBankName);
    if (refundInfo.refundNationalId) {
      fd.append('refundNationalId', refundInfo.refundNationalId);
    }
    return uploadFormData<{ receiptId: string; paymentStatus: string; scanStatus: string }>(
      `/payments/bank-transfer/${paymentId}/receipts`,
      fd,
    );
  },

  getReceiptDownloadUrl: (receiptId: string) =>
    api.get<{ url: string; fileName: string }>(
      `/payments/bank-transfer/receipts/${receiptId}/download`,
    ),

  /**
   * One-shot draft submission — uploads the receipt AND creates the payment
   * row + line items in a single backend call. Use this from the draft
   * bank-transfer page. No DB row exists for this cart until this resolves.
   */
  submitDraft: (
    courseIds: string[],
    file: File,
    refundInfo: {
      refundAccountHolder: string;
      refundIban: string;
      refundBankName: string;
      refundNationalId?: string;
    },
    opts?: { discountCode?: string; applyActiveCampaign?: boolean },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('courseIds', courseIds.join(','));
    if (opts?.discountCode) fd.append('discountCode', opts.discountCode);
    if (opts?.applyActiveCampaign) fd.append('applyActiveCampaign', 'true');
    fd.append('refundAccountHolder', refundInfo.refundAccountHolder);
    fd.append('refundIban', refundInfo.refundIban);
    fd.append('refundBankName', refundInfo.refundBankName);
    if (refundInfo.refundNationalId) {
      fd.append('refundNationalId', refundInfo.refundNationalId);
    }
    return uploadFormData<{
      paymentId: string;
      receiptId: string;
      paymentStatus: string;
    }>(`/payments/bank-transfer/submit-draft`, fd);
  },

  // Fetches the PDF directly as a Blob so the FE can trigger a download
  // without ever exposing the buffer to a tab navigation. Goes through plain
  // fetch (not fetchApi) because fetchApi assumes JSON; we need the raw body.
  downloadProforma: async (
    paymentId: string,
    locale: 'en' | 'ar' = 'en',
  ): Promise<Blob> => {
    const token = getAccessToken();
    const res = await fetch(
      `${API_URL}/payments/bank-transfer/${paymentId}/proforma?locale=${locale}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) message = body.message;
      } catch {}
      throw new ApiError(res.status, message);
    }
    return res.blob();
  },

  // Draft-mode proforma: no payment row yet. Pass the same payload as the
  // quote endpoint and get the PDF Blob back.
  downloadProformaFromQuote: async (data: {
    courseIds: string[];
    discountCode?: string;
    applyActiveCampaign?: boolean;
    locale?: 'en' | 'ar';
  }): Promise<Blob> => {
    const token = getAccessToken();
    const res = await fetch(
      `${API_URL}/payments/bank-transfer/proforma/quote`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) message = body.message;
      } catch {}
      throw new ApiError(res.status, message);
    }
    return res.blob();
  },
};

// ===========================================
// Finance — Bank Transfer Queue API
// ===========================================

export interface BankTransferQueueItem {
  receiptId: string;
  uploadedAt: string;
  scanStatus: 'pending' | 'clean' | 'infected' | 'error';
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  fileName: string;
  fileSizeBytes: number;
  payment: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  };
  student: { id: string; name: string; email: string };
  course: { id: string; title: string };
}

export interface BankTransferReceiptDetail {
  receipt: {
    id: string;
    uploadedAt: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    scanStatus: 'pending' | 'clean' | 'infected' | 'error';
    scanCompletedAt: string | null;
    reviewStatus: 'pending' | 'approved' | 'rejected';
    reviewedBy: string | null;
    reviewedAt: string | null;
    reviewerNote: string | null;
    financeInternalNote: string | null;
    refundInfo: {
      accountHolder: string;
      iban: string;
      bankName: string;
      nationalId: string | null;
    };
    downloadUrl: string;
  };
  payment: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
    gateway: string;
    metadata: Record<string, unknown> | null;
  };
  student: { id: string; name: string; email: string };
  course: { id: string; title: string };
}

export const financeBankTransferApi = {
  listQueue: (opts: {
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const sp = new URLSearchParams();
    sp.set('status', opts.status || 'pending');
    if (opts.search) sp.set('search', opts.search);
    sp.set('page', String(opts.page || 1));
    sp.set('limit', String(opts.limit || 10));
    return api.get<{
      data: BankTransferQueueItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/payments/bank-transfer/queue/list?${sp.toString()}`);
  },

  getReceipt: (receiptId: string) =>
    api.get<BankTransferReceiptDetail>(
      `/payments/bank-transfer/queue/receipts/${receiptId}`,
    ),

  approve: (receiptId: string, opts: { internalNote?: string } = {}) =>
    api.patch<{ receiptId: string; paymentId: string; paymentStatus: string }>(
      `/payments/bank-transfer/queue/receipts/${receiptId}/approve`,
      opts,
    ),

  reject: (receiptId: string, body: { reviewerNote: string; internalNote?: string }) =>
    api.patch<{ receiptId: string; paymentId: string; paymentStatus: string }>(
      `/payments/bank-transfer/queue/receipts/${receiptId}/reject`,
      body,
    ),

  getSummary: (opts?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (opts?.startDate) sp.set('startDate', opts.startDate);
    if (opts?.endDate) sp.set('endDate', opts.endDate);
    const qs = sp.toString();
    return api.get<{
      live: {
        pendingCount: number;
        pendingAmount: number;
        scanPendingCount: number;
        oldestPendingHours: number;
        infectedCount: number;
      };
      window: {
        approvedCount: number;
        approvedAmount: number;
        rejectedCount: number;
        avgReviewHours: number;
      };
    }>(`/payments/bank-transfer/queue/summary${qs ? `?${qs}` : ''}`);
  },

  getReceiptAudit: (receiptId: string) =>
    api.get<Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>>(`/payments/bank-transfer/queue/receipts/${receiptId}/audit`),

  getReplacementChain: (receiptId: string) =>
    api.get<Array<{
      id: string;
      uploadedAt: string;
      fileName: string;
      scanStatus: 'pending' | 'clean' | 'infected' | 'error';
      reviewStatus: 'pending' | 'approved' | 'rejected';
      reviewedAt: string | null;
      reviewerNote: string | null;
      replacedById: string | null;
      isCurrent: boolean;
      isThis: boolean;
    }>>(`/payments/bank-transfer/queue/receipts/${receiptId}/replacement-chain`),
};

// ===========================================
// Finance — Reconciliation API
// ===========================================

export type ReconciliationDriftType =
  | 'missing_local'
  | 'missing_gateway'
  | 'amount_mismatch'
  | 'status_mismatch'
  | 'stuck_pending'
  | 'stuck_approval'
  | 'orphan_receipt'
  | 'paid_no_receipt';

export type ReconciliationGateway =
  | 'moyasar'
  | 'tamara'
  | 'tabby'
  | 'bank_transfer'
  | 'all';

export type ReconciliationFindingStatus = 'unresolved' | 'resolved' | 'ignored' | 'escalated';

export interface ReconciliationFinding {
  id: string;
  scanRunId: string;
  gateway: string;
  driftType: ReconciliationDriftType;
  paymentId: string | null;
  gatewayChargeId: string | null;
  ourValue: Record<string, unknown> | null;
  gatewayValue: Record<string, unknown> | null;
  status: ReconciliationFindingStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  courseTitle: string | null;
  // Linked-escalation context (populated when finding has been escalated).
  // Survives sendBack so finance can see admin's note even after the
  // finding goes back to UNRESOLVED.
  escalationId: string | null;
  escalationStatus: string | null;
  escalationActionTaken: string | null;
  escalationResolutionNote: string | null;
  escalationResolvedAt: string | null;
  escalationResolvedByName: string | null;
}

export interface ReconciliationScan {
  id: string;
  gateway: string;
  fromDate: string;
  toDate: string;
  status: 'running' | 'succeeded' | 'failed';
  recordsScanned: number;
  driftsFound: number;
  triggeredBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export const reconciliationApi = {
  getStats: () =>
    api.get<{
      unresolved: number;
      byDriftType: Record<string, number>;
      byGateway: Record<string, number>;
      lastScans: ReconciliationScan[];
    }>('/payments/reconciliation/stats'),

  listFindings: (opts: {
    status?: ReconciliationFindingStatus | 'all';
    gateway?: string;
    driftType?: ReconciliationDriftType | 'all';
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const sp = new URLSearchParams();
    if (opts.status) sp.set('status', opts.status);
    if (opts.gateway && opts.gateway !== 'all') sp.set('gateway', opts.gateway);
    if (opts.driftType && opts.driftType !== 'all') sp.set('driftType', opts.driftType);
    if (opts.fromDate) sp.set('fromDate', opts.fromDate);
    if (opts.toDate) sp.set('toDate', opts.toDate);
    sp.set('page', String(opts.page ?? 1));
    sp.set('limit', String(opts.limit ?? 20));
    return api.get<{
      data: ReconciliationFinding[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/payments/reconciliation/findings?${sp.toString()}`);
  },

  runScan: (
    opts: { gateway?: ReconciliationGateway; fromDate?: string; toDate?: string } = {},
  ) =>
    api.post<{ scanId: string; recordsScanned: number; driftsFound: number }>(
      '/payments/reconciliation/scan',
      opts,
    ),

  resolve: (findingId: string, note?: string) =>
    api.patch<{ id: string; status: string }>(
      `/payments/reconciliation/findings/${findingId}/resolve`,
      { note },
    ),

  ignore: (findingId: string, note: string) =>
    api.patch<{ id: string; status: string }>(
      `/payments/reconciliation/findings/${findingId}/ignore`,
      { note },
    ),

  bulkResolve: (ids: string[], note?: string) =>
    api.patch<{ requested: number; transitioned: number; skipped: number; status: string }>(
      '/payments/reconciliation/findings/bulk-resolve',
      { ids, note },
    ),

  bulkIgnore: (ids: string[], note: string) =>
    api.patch<{ requested: number; transitioned: number; skipped: number; status: string }>(
      '/payments/reconciliation/findings/bulk-ignore',
      { ids, note },
    ),

  /**
   * Download the current findings view as CSV / XLSX / PDF. Triggers a
   * browser download — returns nothing on success.
   */
  exportFindings: async (
    format: 'csv' | 'xlsx' | 'pdf',
    filters: {
      status?: ReconciliationFindingStatus | 'all';
      gateway?: string;
      driftType?: ReconciliationDriftType | 'all';
      fromDate?: string;
      toDate?: string;
    } = {},
  ) => {
    const token = getAccessToken();
    const sp = new URLSearchParams({ format });
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') sp.set(k, String(v));
    }
    const res = await fetch(`${API_URL}/payments/reconciliation/findings/export?${sp.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
    a.download = `reconciliation-findings-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// ===========================================
// Finance — Reconciliation Escalations API
// ===========================================
// When finance can't resolve a finding themselves (e.g. missing_local needs
// a manual enrollment which only admin can do), they Escalate to admin.

export type EscalationStatus =
  | 'pending'
  | 'in_progress'
  | 'resolved'
  | 'declined'
  | 'sent_back';

export type EscalationUrgency = 'low' | 'normal' | 'high';

export type EscalationProposedAction =
  | 'enroll'
  | 'refund'
  | 'investigate'
  | 'other'
  | 'system_inferred';

export type EscalationActionTaken =
  | 'enrolled'
  | 'refunded'
  | 'no_action'
  | 'sent_back';

export interface ReconciliationEscalationListItem {
  id: string;
  findingId: string;
  escalatedBy: string | null;
  escalatedAt: string;
  escalationNote: string;
  proposedAction: EscalationProposedAction;
  urgency: EscalationUrgency;
  status: EscalationStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  actionTaken: EscalationActionTaken | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  // Finding context
  driftType: ReconciliationDriftType;
  gateway: string;
  paymentId: string | null;
  gatewayChargeId: string | null;
  ourValue: Record<string, unknown> | null;
  gatewayValue: Record<string, unknown> | null;
  customerName: string | null;
  customerEmail: string | null;
  courseTitle: string | null;
  escalatedByName: string | null;
  claimedByName: string | null;
  resolvedByName: string | null;
}

export interface ReconciliationEscalationDetail extends ReconciliationEscalationListItem {
  findingCreatedAt: string;
  customerId: string | null;
  courseId: string | null;
  paymentAmount: string | null;
  paymentCurrency: string | null;
  paymentStatus: string | null;
  paymentGateway: string | null;
  paymentMethod: string | null;
  paymentCreatedAt: string | null;
}

export interface EscalationStats {
  pending: number;
  inProgress: number;
  highUrgencyOpen: number;
  avgResolutionMinutes: number;
}

export const escalationsApi = {
  create: (
    findingId: string,
    body: {
      note: string;
      proposedAction: EscalationProposedAction;
      urgency?: EscalationUrgency;
    },
  ) =>
    api.post<{ id: string; status: EscalationStatus }>(
      `/payments/reconciliation/findings/${findingId}/escalate`,
      body,
    ),

  list: (opts: {
    status?: EscalationStatus | 'all';
    gateway?: string;
    urgency?: EscalationUrgency;
    escalatedBy?: string;
    claimedBy?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const sp = new URLSearchParams();
    if (opts.status) sp.set('status', opts.status);
    if (opts.gateway) sp.set('gateway', opts.gateway);
    if (opts.urgency) sp.set('urgency', opts.urgency);
    if (opts.escalatedBy) sp.set('escalatedBy', opts.escalatedBy);
    if (opts.claimedBy) sp.set('claimedBy', opts.claimedBy);
    sp.set('page', String(opts.page ?? 1));
    sp.set('limit', String(opts.limit ?? 20));
    return api.get<{
      data: ReconciliationEscalationListItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/payments/reconciliation/escalations?${sp.toString()}`);
  },

  getStats: () =>
    api.get<EscalationStats>('/payments/reconciliation/escalations/stats'),

  get: (id: string) =>
    api.get<ReconciliationEscalationDetail>(
      `/payments/reconciliation/escalations/${id}`,
    ),

  claim: (id: string) =>
    api.patch<{ id: string; status: EscalationStatus }>(
      `/payments/reconciliation/escalations/${id}/claim`,
      {},
    ),

  sendBack: (id: string, note: string) =>
    api.patch<{ id: string; status: EscalationStatus; findingId: string }>(
      `/payments/reconciliation/escalations/${id}/send-back`,
      { note },
    ),

  close: (id: string, note: string) =>
    api.patch<{ id: string; status: EscalationStatus; findingId: string }>(
      `/payments/reconciliation/escalations/${id}/close`,
      { note },
    ),

  enroll: (
    id: string,
    body: { studentId: string; courseId: string; note: string },
  ) =>
    api.post<{
      escalationId: string;
      findingId: string;
      enrollmentId: string;
      paymentCreated: boolean;
      paymentFlipped: boolean;
      receiptApproved: boolean;
      paymentId: string | null;
    }>(`/payments/reconciliation/escalations/${id}/enroll`, body),

  refund: (
    id: string,
    body: { amount?: number; reason: string; note: string },
  ) =>
    api.post<{
      escalationId: string;
      findingId: string;
      refundId: string;
      gatewayRefundId: string | null;
    }>(`/payments/reconciliation/escalations/${id}/refund`, body),
};

// ===========================================
// Invoice API
// ===========================================

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  paymentId: string;
  userName: string | null;
  userEmail: string | null;
  courseTitle: string | null;
  courseTitleAr: string | null;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  issuedAt: string;
  paidAt: string | null;
  dueDate: string | null;
  gateway: string | null;
  refundStatus: string | null;
}

export interface InvoiceSummary {
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  refundedCount: number;
  refundedAmount: number;
  cancelledCount: number;
}

type InvoiceFilters = {
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  gateway?: string;
};

function buildInvoiceFilterParams(filters?: InvoiceFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') sp.set('status', filters.status);
  if (filters?.startDate) sp.set('startDate', filters.startDate);
  if (filters?.endDate) sp.set('endDate', filters.endDate);
  if (filters?.search) sp.set('search', filters.search);
  if (filters?.gateway && filters.gateway !== 'all') sp.set('gateway', filters.gateway);
  return sp;
}

export const invoiceApi = {
  getMyInvoices: (page = 1, limit = 10) =>
    api.get<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/invoices/my-invoices?page=${page}&limit=${limit}`),

  getAll: (page = 1, limit = 10, filters?: InvoiceFilters) => {
    const sp = buildInvoiceFilterParams(filters);
    sp.set('page', String(page));
    sp.set('limit', String(limit));
    return api.get<{
      data: InvoiceRow[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/invoices?${sp.toString()}`);
  },

  getSummary: (filters?: InvoiceFilters) => {
    const sp = buildInvoiceFilterParams(filters);
    const qs = sp.toString();
    return api.get<InvoiceSummary>(`/invoices/summary${qs ? `?${qs}` : ''}`);
  },

  getDetail: (invoiceId: string) =>
    api.get<{
      invoice: {
        id: string;
        invoiceNumber: string;
        paymentId: string;
        userId: string;
        courseId: string;
        subtotal: string;
        discountAmount: string;
        taxAmount: string;
        totalAmount: string;
        status: string;
        issuedAt: string;
        paidAt: string | null;
        dueDate: string | null;
        pdfUrl: string | null;
        metadata: Record<string, unknown> | null;
      };
      buyer: { id: string; name: string | null; email: string | null; nationalId: string | null };
      payment: {
        id: string;
        gateway: string | null;
        paymentMethod: string | null;
        status: string | null;
        gatewayChargeId: string | null;
      };
      course: { id: string; title: string | null; titleAr: string | null };
      lineItems: Array<{
        description: string;
        descriptionAr: string | null;
        deliveryType: string | null;
        amount: number;
      }>;
      refunds: Array<{
        id: string;
        amount: string;
        reason: string;
        reasonNote: string | null;
        status: string;
        requestedAt: string;
        approvedAt: string | null;
        completedAt: string | null;
        rejectedAt: string | null;
      }>;
    }>(`/invoices/${invoiceId}/detail`),

  getAudit: (invoiceId: string, limit = 100) =>
    api.get<Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>>(`/invoices/${invoiceId}/audit?limit=${limit}`),

  getPdfUrl: (invoiceId: string, locale: 'en' | 'ar' = 'en') =>
    api.get<{ url: string; invoiceNumber: string }>(
      `/invoices/${invoiceId}/pdf?locale=${locale}`,
    ),

  resend: (invoiceId: string, locale: 'en' | 'ar' = 'en') =>
    api.post<{ sent: boolean; invoiceNumber: string }>(
      `/invoices/${invoiceId}/resend`,
      { locale },
    ),

  regeneratePdf: (invoiceId: string, locale: 'en' | 'ar' = 'en') =>
    api.post<{ ok: boolean; invoiceNumber: string }>(
      `/invoices/${invoiceId}/regenerate-pdf`,
      { locale },
    ),

  cancel: (invoiceId: string, reason: string) =>
    api.post<{ ok: boolean; invoiceNumber: string }>(`/invoices/${invoiceId}/cancel`, { reason }),

  runOverdueSweep: () =>
    api.post<{ sweptCount: number; sweptAt: string }>('/invoices/overdue-sweep/run'),

  /**
   * Downloads the CSV export for the current filter set as a Blob — caller
   * is responsible for triggering the browser save. Bypasses the api wrapper
   * because the response is a binary stream, not JSON.
   */
  exportCsv: async (filters?: InvoiceFilters): Promise<Blob> => {
    const sp = buildInvoiceFilterParams(filters);
    const qs = sp.toString();
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');
    const url = `${base}/invoices/export.csv${qs ? `?${qs}` : ''}`;
    const token = getAccessToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`CSV export failed: ${res.status}`);
    return res.blob();
  },
};

// ===========================================
// Refund API
// ===========================================

export const refundApi = {
  request: (data: {
    paymentId: string;
    reason: string;
    reasonNote?: string;
    /** Optional subset of payment_items.id to refund. Absent = refund
     *  the whole payment (backwards-compatible). */
    paymentItemIds?: string[];
  }) => api.post<any>('/refunds', data),

  // Student-only: returns refunds where requesterId === current user.
  getMyRefunds: (page = 1, limit = 10) =>
    api.get<{
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/refunds/my-refunds?page=${page}&limit=${limit}`),

  getAll: (
    page = 1,
    limit = 10,
    filters?: {
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      gateway?: string;
      reason?: string;
    },
  ) => {
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.status && filters.status !== 'all') sp.set('status', filters.status);
    if (filters?.search) sp.set('search', filters.search);
    if (filters?.startDate) sp.set('startDate', filters.startDate);
    if (filters?.endDate) sp.set('endDate', filters.endDate);
    if (filters?.gateway && filters.gateway !== 'all') sp.set('gateway', filters.gateway);
    if (filters?.reason && filters.reason !== 'all') sp.set('reason', filters.reason);
    return api.get<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/refunds?${sp.toString()}`);
  },

  getSummary: (filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    gateway?: string;
    reason?: string;
  }) => {
    const sp = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') sp.set('status', filters.status);
    if (filters?.startDate) sp.set('startDate', filters.startDate);
    if (filters?.endDate) sp.set('endDate', filters.endDate);
    if (filters?.gateway && filters.gateway !== 'all') sp.set('gateway', filters.gateway);
    if (filters?.reason && filters.reason !== 'all') sp.set('reason', filters.reason);
    const qs = sp.toString();
    return api.get<{
      totalCount: number;
      pendingCount: number;
      approvedCount: number;
      processingCount: number;
      completedCount: number;
      rejectedCount: number;
      failedCount: number;
      pendingAmount: number;
      inFlightAmount: number;
      grossRefundedAmount: number;
      netRefundedAmount: number;
      deductionCaptured: number;
      avgResolutionHours: number;
      refundRateByAmount: number;
      paidWindowAmount: number;
    }>(`/refunds/summary${qs ? `?${qs}` : ''}`);
  },

  getById: (refundId: string) =>
    api.get<any>(`/refunds/${refundId}`),

  getDetail: (refundId: string) =>
    api.get<{
      id: string;
      paymentId: string;
      invoiceId: string | null;
      requestedBy: string;
      processedBy: string | null;
      reason: string;
      reasonNote: string | null;
      originalAmount: string;
      deductionAmount: string;
      deductionReason: string | null;
      refundAmount: string;
      status: string;
      gatewayRefundId: string | null;
      approvalNote: string | null;
      rejectionNote: string | null;
      createdAt: string;
      approvedAt: string | null;
      completedAt: string | null;
      rejectedAt: string | null;
      requesterName: string | null;
      requesterEmail: string | null;
      gateway: string | null;
      paymentMethod: string | null;
      paymentStatus: string | null;
      paymentAmount: string | null;
      gatewayChargeId: string | null;
      courseId: string | null;
      courseTitle: string | null;
      courseTitleAr: string | null;
      invoiceNumber: string | null;
      processorName: string | null;
      processorEmail: string | null;
      refundedItems: Array<{
        paymentItemId: string;
        courseId: string;
        courseTitle: string | null;
        courseTitleAr: string | null;
        lineAmount: string;
        lineVat: string;
        lineDiscount: string;
        lineTotal: string;
      }>;
    }>(`/refunds/${refundId}/detail`),

  getAudit: (refundId: string) =>
    api.get<Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>>(`/refunds/${refundId}/audit`),

  approve: (
    refundId: string,
    opts?: { approvalNote?: string; approvedAmount?: number },
  ) => {
    const body: { approvalNote?: string; approvedAmount?: number } = {};
    if (opts?.approvalNote) body.approvalNote = opts.approvalNote;
    if (opts?.approvedAmount !== undefined) body.approvedAmount = opts.approvedAmount;
    return api.patch<{ status: string; partialApproval?: boolean }>(
      `/refunds/${refundId}/approve`,
      body,
    );
  },

  reject: (refundId: string, rejectionNote: string) =>
    api.patch<{ status: string }>(`/refunds/${refundId}/reject`, { rejectionNote }),

  markFailed: (refundId: string, note: string) =>
    api.patch<{ status: string }>(`/refunds/${refundId}/mark-failed`, { note }),

  adminInitiate: (data: {
    paymentId: string;
    reason: string;
    reasonNote?: string;
    justification?: string;
    /** Optional partial refund amount. Backend enforces gateway support. */
    refundAmount?: number;
    /** Optional subset of payment_items.id to refund. Absent = refund
     *  every refundable line. */
    paymentItemIds?: string[];
    /** Bypass the lifecycle policy (course started / attendance / cert /
     *  CME). The bypass + the underlying reason are recorded in the audit
     *  log. */
    bypassPolicy?: boolean;
  }) => api.post<any>('/refunds/admin-initiate', data),

  getPreview: (
    paymentId: string,
    amount?: number,
    paymentItemIds?: string[],
  ) => {
    const sp = new URLSearchParams();
    if (amount !== undefined) sp.set('amount', String(amount));
    if (paymentItemIds && paymentItemIds.length > 0) {
      sp.set('paymentItemIds', paymentItemIds.join(','));
    }
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return api.get<{
      payment: {
        id: string;
        amount: number;
        gateway: string;
        paymentMethod: string | null;
        paidAt: string | null;
        gatewayChargeId: string | null;
      };
      buyer: { id: string; name: string; email: string } | null;
      course: { id: string; title: string; titleAr: string | null } | null;
      invoice: {
        id: string;
        invoiceNumber: string;
        issuedAt: string;
        paidAt: string | null;
      } | null;
      enrollment: {
        id: string;
        status: string;
        enrolledAt: string | null;
      } | null;
      eligibility: {
        eligible: boolean;
        blockedBy:
          | 'course_started'
          | 'attendance_recorded'
          | 'certificate_issued'
          | 'cme_granted'
          | null;
        reason: string | null;
      };
      capabilities: {
        supportsPartial: boolean;
        maxRefundAmount: number;
        minRefundAmount: number;
      };
      lineItems: Array<{
        paymentItemId: string | null;
        courseId: string;
        courseTitle: string | null;
        courseTitleAr: string | null;
        enrollmentId: string | null;
        enrollmentStatus: string | null;
        unitPrice: number;
        lineSubtotal: number;
        lineDiscount: number;
        lineVat: number;
        lineTotal: number;
        alreadyRefundedByRefundId: string | null;
        selected: boolean;
      }>;
      selection: {
        paymentItemIds: string[];
        selectedTotal: number;
        isFullPaymentRefund: boolean;
        isPartialCartRefund: boolean;
      };
      breakdown: {
        originalAmount: number;
        refundAmount: number;
        merchantFeeRate: number;
        merchantFeeAmount: number;
        merchantFeeReason: string | null;
        isPartial: boolean;
      };
      refundDestination: {
        kind: 'gateway' | 'card' | 'manual_bank';
        label: string;
      };
      consequences: {
        dropsEnrollment: boolean;
        reversesDiscount: boolean;
        revokesCertificate: boolean;
        cancelsFutureWebinarRegistrations: boolean;
      };
    }>(`/refunds/preview/${paymentId}${qs}`);
  },

  listRefundablePayments: (search?: string, limit = 25) => {
    const sp = new URLSearchParams({ limit: String(limit) });
    if (search) sp.set('search', search);
    return api.get<Array<{
      id: string;
      amount: string;
      gateway: string;
      paidAt: string;
      userId: string;
      userName: string;
      userEmail: string;
      courseId: string;
      courseTitle: string;
    }>>(`/refunds/refundable-payments?${sp.toString()}`);
  },

  export: async (params?: { status?: string; startDate?: string; endDate?: string }) => {
    const token = getAccessToken();
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();

    const res = await fetch(`${API_URL}/refunds/export${qs ? `?${qs}` : ''}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refunds-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// ===========================================
// Student Finance API — read-only umbrella for the /dashboard/student/billing
// page. Refund creation reuses refundApi.request(); invoice/PDF reuse invoiceApi.
// All endpoints are server-side guarded to "this row belongs to me".
// ===========================================

export type StudentPaymentStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_approval'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'chargeback';

export type StudentGatewayKey =
  | 'moyasar'
  | 'tamara'
  | 'tabby'
  | 'bank_transfer'
  | 'mock';

export interface StudentVatBreakdown {
  subtotalSar: number;
  vatSar: number;
  totalSar: number;
  vatRatePct: number;
  discountSar: number;
}

export interface StudentFinanceOverview {
  counts: {
    paid: number;
    pending: number;
    refunded: number;
    refundInFlight: number;
  };
  totals: {
    lifetimePaidSar: number;
    vatPaidYtdSar: number;
    currency: 'SAR';
  };
  recentPayments: Array<{
    id: string;
    amount: string;
    gateway: string;
    status: StudentPaymentStatus;
    paidAt: string | null;
    createdAt: string;
    courseTitle: string | null;
    courseTitleAr: string | null;
    latestRefundStatus: string | null;
  }>;
}

export interface StudentPaymentRow {
  id: string;
  amount: string;
  currency: string;
  gateway: string;
  paymentMethod: string | null;
  status: StudentPaymentStatus;
  paidAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  courseId: string;
  courseTitle: string | null;
  courseTitleAr: string | null;
  invoiceId: string | null;
  vatBreakdown: StudentVatBreakdown;
  hasInvoice: boolean;
  latestRefundStatus: string | null;
}

export interface StudentPaymentsListResponse {
  data: StudentPaymentRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface StudentPaymentDetailResponse {
  payment: {
    id: string;
    userId: string;
    courseId: string;
    enrollmentId: string | null;
    gateway: string;
    gatewayChargeId: string | null;
    paymentMethod: string | null;
    amount: string;
    currency: string;
    status: StudentPaymentStatus;
    metadata: Record<string, unknown> | null;
    paidAt: string | null;
    failedAt: string | null;
    failureReason: string | null;
    createdAt: string;
    courseTitle: string | null;
    courseTitleAr: string | null;
    courseDeliveryType: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    vatBreakdown: StudentVatBreakdown;
  };
  refunds: Array<{
    id: string;
    status: string;
    reason: string;
    reasonNote: string | null;
    originalAmount: string;
    refundAmount: string;
    deductionAmount: string;
    createdAt: string;
    approvedAt: string | null;
    completedAt: string | null;
    rejectedAt: string | null;
    rejectionNote: string | null;
  }>;
  /** Per-course breakdown — drives the per-line refund UI in the drawer
   *  and the multi-select in StudentRefundRequestModal. */
  lineItems: Array<{
    paymentItemId: string | null;
    courseId: string;
    courseTitle: string | null;
    courseTitleAr: string | null;
    enrollmentId: string | null;
    enrollmentStatus: string | null;
    unitPrice: number;
    lineSubtotal: number;
    lineDiscount: number;
    lineVat: number;
    lineTotal: number;
    alreadyRefundedByRefundId: string | null;
  }>;
  refundability: {
    canRequest: boolean;
    blockedBy: string | null;
    reason: string | null;
    partialAllowed: boolean;
    merchantDeductionPercent: number;
  };
}

export interface StudentFinancePolicySnapshot {
  rules: {
    blockAfterCourseStart: boolean;
    blockAfterAttendance: boolean;
    blockAfterCertificate: boolean;
    blockAfterCmeGranted: boolean;
  };
  perGateway: Record<
    StudentGatewayKey,
    { deductionPercent: number; partialRefundCapable: boolean }
  >;
  activeGateways: {
    moyasar:       { available: boolean; mode: 'test' | 'live' | null };
    tamara:        { available: boolean; mode: 'test' | 'live' | null };
    tabby:         { available: boolean; mode: 'test' | 'live' | null };
    bank_transfer: { available: boolean; mode: null };
  };
}

export interface StudentPaymentsFilters {
  status?: string;
  gateway?: string;
  dateFrom?: string;
  dateTo?: string;
  courseId?: string;
}

export const studentFinanceApi = {
  getOverview: () =>
    api.get<StudentFinanceOverview>('/student/finance/overview'),

  listPayments: (
    page = 1,
    limit = 20,
    filters?: StudentPaymentsFilters,
  ) => {
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.status && filters.status !== 'all') sp.set('status', filters.status);
    if (filters?.gateway && filters.gateway !== 'all') sp.set('gateway', filters.gateway);
    if (filters?.dateFrom) sp.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) sp.set('dateTo', filters.dateTo);
    if (filters?.courseId) sp.set('courseId', filters.courseId);
    return api.get<StudentPaymentsListResponse>(
      `/student/finance/payments?${sp.toString()}`,
    );
  },

  getPaymentDetail: (paymentId: string) =>
    api.get<StudentPaymentDetailResponse>(
      `/student/finance/payments/${paymentId}`,
    ),

  getPolicySnapshot: () =>
    api.get<StudentFinancePolicySnapshot>(
      '/student/finance/policy-snapshot',
    ),

  // Resolve enrollmentId → paymentId so course pages can deep-link a
  // student to their billing drawer. Throws 404 when no payment exists
  // (free enrollment, refunded, never paid) — caller hides the CTA on err.
  getPaymentByEnrollment: (enrollmentId: string) =>
    api.get<{ paymentId: string }>(
      `/student/finance/payment-by-enrollment/${enrollmentId}`,
    ),
};

// ===========================================
// Finance API
// ===========================================

export interface GatewaySettingsView {
  activeGateway: 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer' | null;
  testMode: boolean;
  currency: string;
  moyasar: { publishableKey: string | null; hasSecret: boolean; enabled: boolean };
  tamara: { merchantTokenMasked: string | null; hasSecret: boolean; enabled: boolean };
  tabby: { publicKey: string | null; hasSecret: boolean; enabled: boolean };
  bankTransfer: {
    bankNameEn: string;
    bankNameAr: string;
    beneficiaryEn: string;
    beneficiaryAr: string;
    accountNumber: string;
    iban: string;
    swiftCode: string;
    instructionsEn: string;
    instructionsAr: string;
    enabled: boolean;
  };
  hasWebhookSecret: boolean;
  invoiceFooterEn: string;
  invoiceFooterAr: string;
  autoSendReceipt: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string; email: string | null } | null;
}

/** Which gateways are visible on the checkout radios — reflects admin
 *  Settings → Payments toggles. Missing key defaults to true server-side
 *  (backward-compat rollout). Consumed by CheckoutPageClient + BnplPromoWidgets. */
export interface VisibleGatewaysResponse {
  moyasar: boolean;
  tamara: boolean;
  tabby: boolean;
  bank_transfer: boolean;
}

export type RefundGatewayKey = 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer' | 'mock';

export interface RefundPolicy {
  rules: {
    blockAfterCourseStart: boolean;
    blockAfterAttendance: boolean;
    blockAfterCertificate: boolean;
    blockAfterCmeGranted: boolean;
  };
  autoApproveEligible: boolean;
  perGateway: Record<
    RefundGatewayKey,
    { deductionPercent: number; partialRefundCapable: boolean }
  >;
}

export interface RefundPolicyResponse {
  policy: RefundPolicy;
  updatedAt: string | null;
  updatedBy: { id: string; name: string; email: string | null } | null;
}

export type VatTreatmentValue = 'standard' | 'exempt' | 'zero_rated';

export interface TaxSettings {
  vatEnabled: boolean;
  vatRate: number;
  taxNumber: string;
  companyNameEn: string;
  companyNameAr: string;
  defaultVatTreatment: VatTreatmentValue;
}

export interface TaxSettingsResponse {
  settings: TaxSettings;
  updatedAt: string | null;
  updatedBy: { id: string; name: string; email: string | null } | null;
}

export interface VatTreatmentRow {
  id: string;
  title: string;
  titleAr: string | null;
  deliveryType: string | null;
  price: string;
  vatTreatment: VatTreatmentValue;
  salesCount: number;
}

export interface VatTreatmentListResponse {
  data: VatTreatmentRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicTaxDisplay {
  vatEnabled: boolean;
  vatRate: number;
  defaultVatTreatment: VatTreatmentValue;
}

/** Unauthenticated tax display fields — used by the public cart/checkout. */
export const publicTaxApi = {
  getDisplay: () => api.get<PublicTaxDisplay>('/public/tax/display'),
};

export const financeApi = {
  /** Finance-side read-only view of payment-gateway configuration. */
  getGatewaySettings: () =>
    api.get<GatewaySettingsView>('/finance/settings/gateways'),

  /** Read the current refund policy + last-updated metadata. */
  getRefundPolicy: () =>
    api.get<RefundPolicyResponse>('/finance/settings/refund-policy'),

  /** Write the full refund policy. Audit-logged on the server. */
  updateRefundPolicy: (policy: RefundPolicy) =>
    api.put<{ policy: RefundPolicy }>(
      '/finance/settings/refund-policy',
      policy,
    ),

  // ─── Tax Settings ────────────────────────────────────────────────
  getTaxSettings: () =>
    api.get<TaxSettingsResponse>('/finance/settings/tax'),

  updateTaxSettings: (payload: TaxSettings) =>
    api.put<{ settings: TaxSettings }>('/finance/settings/tax', payload),

  listVatTreatments: (params: {
    search?: string;
    treatment?: VatTreatmentValue | 'all';
    page?: number;
    pageSize?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params.search) sp.set('search', params.search);
    if (params.treatment && params.treatment !== 'all')
      sp.set('treatment', params.treatment);
    if (params.page) sp.set('page', String(params.page));
    if (params.pageSize) sp.set('pageSize', String(params.pageSize));
    const qs = sp.toString();
    return api.get<VatTreatmentListResponse>(
      `/finance/settings/vat-treatments${qs ? `?${qs}` : ''}`,
    );
  },

  updateVatTreatment: (courseId: string, treatment: VatTreatmentValue) =>
    api.put<{ courseId: string; treatment: VatTreatmentValue }>(
      `/finance/settings/vat-treatments/${courseId}`,
      { treatment },
    ),

  bulkUpdateVatTreatments: (
    courseIds: string[],
    treatment: VatTreatmentValue,
  ) =>
    api.post<{ count: number }>(`/finance/settings/vat-treatments/bulk`, {
      courseIds,
      treatment,
    }),

  getSummary: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<any>(`/finance/summary${qs ? `?${qs}` : ''}`);
  },

  getRevenueBySource: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<any[]>(`/finance/revenue-by-source${qs ? `?${qs}` : ''}`);
  },

  getPaymentStatus: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<{ status: string; count: number; totalAmount: number }[]>(
      `/finance/payment-status${qs ? `?${qs}` : ''}`,
    );
  },

  /**
   * Manually retry the Authorise + Capture flow for a stuck Tamara payment.
   * Used by the "Retry Capture" button on the finance payments table when
   * a Tamara payment has been pending for too long (the automatic 10-min
   * cron is also retrying in the background; this is the human-triggered
   * variant). Returns the same action union the cron version returns so
   * the UI can toast accordingly.
   */
  retryTamaraCapture: (paymentId: string) =>
    api.post<{
      paymentId: string;
      action: 'paid' | 'failed' | 'refunded' | 'retried' | 'no_op';
      detail: string;
    }>(`/finance/tamara/retry/${paymentId}`),

  getRefundRate: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<any>(`/finance/refund-rate${qs ? `?${qs}` : ''}`);
  },

  getInvoiceAging: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<{
      current: { count: number; amount: number };
      thirtyDay: { count: number; amount: number };
      sixtyDay: { count: number; amount: number };
      ninetyPlus: { count: number; amount: number };
      paid: { count: number; amount: number };
    }>(`/finance/invoice-aging${qs ? `?${qs}` : ''}`);
  },

  getBankTransferReviewAging: () =>
    api.get<{
      asOf: string;
      underSix: { count: number; amount: number };
      sixToDay: { count: number; amount: number };
      dayToTwo: { count: number; amount: number };
      beyondTwo: { count: number; amount: number };
      scanQueue: { count: number; amount: number };
    }>(`/finance/bank-transfer-review-aging`),

  getRevenueTrend: (params?: { period?: 'day' | 'week' | 'month'; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.period) sp.set('period', params.period);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<Array<{ period: string; revenue: number; count: number }>>(`/finance/revenue-trend${qs ? `?${qs}` : ''}`);
  },

  getTopCourses: (params?: { limit?: number; startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<Array<{ courseId: string; title: string; titleAr: string | null; revenue: number; count: number }>>(`/finance/top-courses${qs ? `?${qs}` : ''}`);
  },

  exportCsv: async (params?: { startDate?: string; endDate?: string; status?: string; reportType?: string; locale?: string }) => {
    const token = getAccessToken();
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.status) query.set('status', params.status);
    if (params?.reportType) query.set('reportType', params.reportType);
    if (params?.locale) query.set('locale', params.locale);
    const qs = query.toString();

    const res = await fetch(`${API_URL}/finance/export${qs ? `?${qs}` : ''}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  exportPdf: async (params?: { startDate?: string; endDate?: string; status?: string; reportType?: string; locale?: string }) => {
    const token = getAccessToken();
    const query = new URLSearchParams({ format: 'pdf' });
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.status) query.set('status', params.status);
    if (params?.reportType) query.set('reportType', params.reportType);
    if (params?.locale) query.set('locale', params.locale);

    const res = await fetch(`${API_URL}/finance/export?${query.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-export-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  exportExcel: async (params?: { startDate?: string; endDate?: string; reportType?: string; locale?: string }) => {
    const token = getAccessToken();
    const query = new URLSearchParams({ format: 'xlsx' });
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.reportType) query.set('reportType', params.reportType);
    if (params?.locale) query.set('locale', params.locale);

    const res = await fetch(`${API_URL}/finance/export?${query.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  getRevenueByCourse: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<Array<{
      courseId: string;
      title: string;
      titleAr: string | null;
      revenue: number;
      refundAmount: number;
      netRevenue: number;
      marginPercent: number;
      enrollmentCount: number;
    }>>(`/finance/revenue-by-course${qs ? `?${qs}` : ''}`);
  },

  getRevenueByInstructor: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<Array<{
      instructorId: string | null;
      instructorName: string;
      courseCount: number;
      revenue: number;
      refundAmount: number;
      netRevenue: number;
      platformFee: number;
      netPayout: number;
      enrollmentCount: number;
    }>>(`/finance/revenue-by-instructor${qs ? `?${qs}` : ''}`);
  },

  getRevenueByDeliveryType: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<Array<{
      deliveryType: string;
      revenue: number;
      refundAmount: number;
      netRevenue: number;
      marginPercent: number;
      enrollmentCount: number;
      courseCount: number;
    }>>(`/finance/revenue-by-delivery-type${qs ? `?${qs}` : ''}`);
  },

  getChargebackRate: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<{
      chargebackCount: number;
      chargebackAmount: number;
      totalTransactions: number;
      chargebackRate: string;
      breakdown: Array<{
        courseId: string;
        courseTitle: string;
        gateway: string;
        chargebackCount: number;
        chargebackAmount: number;
      }>;
    }>(`/finance/chargeback-rate${qs ? `?${qs}` : ''}`);
  },

  // ── Audit Log ──

  getAuditLogs: (params?: {
    entityType?: string;
    action?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
    adminOnly?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.entityType) sp.set('entityType', params.entityType);
    if (params?.action) sp.set('action', params.action);
    if (params?.actorId) sp.set('actorId', params.actorId);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    if (params?.search) sp.set('search', params.search);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.adminOnly) sp.set('adminOnly', 'true');
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        entityType: string;
        entityId: string;
        action: string;
        performedBy: string | null;
        metadata: Record<string, unknown> | null;
        ipAddress: string | null;
        createdAt: string;
        performerFirstName: string | null;
        performerLastName: string | null;
        performerEmail: string | null;
      }>;
      total: number;
      page: number;
      limit: number;
    }>(`/audit-logs/finance${qs ? `?${qs}` : ''}`);
  },

  getAuditLogFilters: () => {
    return api.get<{ entityTypes: string[]; actions: string[] }>('/audit-logs/finance/filters');
  },

  getAuditLogActors: () => {
    return api.get<Array<{ id: string; name: string; email: string }>>(
      '/audit-logs/finance/actors',
    );
  },

  getAuditLogSummary: (params?: {
    entityType?: string;
    action?: string;
    actorId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    adminOnly?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.entityType) sp.set('entityType', params.entityType);
    if (params?.action) sp.set('action', params.action);
    if (params?.actorId) sp.set('actorId', params.actorId);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    if (params?.search) sp.set('search', params.search);
    if (params?.adminOnly) sp.set('adminOnly', 'true');
    const qs = sp.toString();
    return api.get<{
      totalEvents: number;
      uniqueActors: number;
      topActions: Array<{ action: string; count: number }>;
      topEntityTypes: Array<{ entityType: string; count: number }>;
    }>(`/audit-logs/finance/summary${qs ? `?${qs}` : ''}`);
  },

  /**
   * Unified audit log export — XLSX / CSV / PDF in one call. Backend
   * self-audits every download (entity type `audit_log_export`).
   */
  downloadAuditLog: async (
    format: 'csv' | 'xlsx' | 'pdf',
    params?: {
      entityType?: string;
      action?: string;
      actorId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) => {
    const token = getAccessToken();
    const query = new URLSearchParams({ format });
    if (params?.entityType) query.set('entityType', params.entityType);
    if (params?.action) query.set('action', params.action);
    if (params?.actorId) query.set('actorId', params.actorId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`${API_URL}/audit-logs/finance/export?${query.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // ─── Reports page: 8 spec-defined report previews + unified export ─────

  getReportRevenue: (params: { startDate?: string; endDate?: string; gateway?: string }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.gateway) sp.set('gateway', params.gateway);
    return api.get<{
      totals: { gross: number; refunds: number; net: number; vat: number; count: number };
      byGateway: Array<{ gateway: string; count: number; gross: number }>;
      byMethod: Array<{ method: string; count: number; gross: number }>;
    }>(`/finance/reports/revenue?${sp.toString()}`);
  },

  getReportRefunds: (params: { startDate?: string; endDate?: string; status?: string; gateway?: string; reason?: string }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.status) sp.set('status', params.status);
    if (params.gateway) sp.set('gateway', params.gateway);
    if (params.reason) sp.set('reason', params.reason);
    return api.get<Array<{
      id: string;
      requesterName: string | null;
      requesterEmail: string | null;
      processedByName: string | null;
      courseTitle: string | null;
      gateway: string | null;
      reason: string | null;
      reasonNote: string | null;
      originalAmount: number;
      refundAmount: number;
      deductionAmount: number;
      status: string;
      createdAt: string;
      approvedAt: string | null;
      completedAt: string | null;
    }>>(`/finance/reports/refunds?${sp.toString()}`);
  },

  getReportPayments: (params: { startDate?: string; endDate?: string; gateway?: string; status?: string; method?: string }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.gateway) sp.set('gateway', params.gateway);
    if (params.status) sp.set('status', params.status);
    if (params.method) sp.set('method', params.method);
    return api.get<Array<{
      id: string;
      userName: string | null;
      userEmail: string | null;
      courseTitle: string | null;
      gateway: string;
      paymentMethod: string;
      amount: number;
      currency: string;
      status: string;
      gatewayChargeId: string | null;
      createdAt: string;
      paidAt: string | null;
    }>>(`/finance/reports/payments?${sp.toString()}`);
  },

  getReportCourseSales: (params: { startDate?: string; endDate?: string; courseId?: string; deliveryType?: string }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.courseId) sp.set('courseId', params.courseId);
    if (params.deliveryType) sp.set('deliveryType', params.deliveryType);
    return api.get<Array<{
      courseId: string;
      courseTitle: string;
      courseTitleAr: string | null;
      deliveryType: string;
      units: number;
      gross: number;
      refunds: number;
      net: number;
    }>>(`/finance/reports/course-sales?${sp.toString()}`);
  },

  getReportWebinarSales: (params: { startDate?: string; endDate?: string; courseId?: string; sessionId?: string }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.courseId) sp.set('courseId', params.courseId);
    if (params.sessionId) sp.set('sessionId', params.sessionId);
    return api.get<Array<{
      sessionId: string;
      sessionTitle: string | null;
      scheduledAt: string;
      courseId: string;
      courseTitle: string;
      totalRegistrations: number;
      paidRegistrations: number;
      revenue: number;
    }>>(`/finance/reports/webinar-sales?${sp.toString()}`);
  },

  getReportStudentPurchases: (params: { startDate?: string; endDate?: string; search?: string; top?: number }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.search) sp.set('search', params.search);
    if (params.top) sp.set('top', String(params.top));
    return api.get<Array<{
      userId: string;
      userName: string;
      userEmail: string;
      paymentCount: number;
      courseCount: number;
      totalPaid: number;
      totalRefunded: number;
      netSpend: number;
      lastPurchaseAt: string;
    }>>(`/finance/reports/student-purchases?${sp.toString()}`);
  },

  getReportFinanceActivity: (params: { startDate?: string; endDate?: string; actorId?: string; entityType?: string; action?: string }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.actorId) sp.set('actorId', params.actorId);
    if (params.entityType) sp.set('entityType', params.entityType);
    if (params.action) sp.set('action', params.action);
    return api.get<Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      actorName: string | null;
      actorEmail: string | null;
      createdAt: string;
      ipAddress: string | null;
      metadata: Record<string, unknown> | null;
    }>>(`/finance/reports/finance-activity?${sp.toString()}`);
  },

  getReportVat: (params: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    return api.get<{
      totals: { invoiceCount: number; taxableBase: number; vatAmount: number; total: number };
      byMonth: Array<{ month: string; invoiceCount: number; taxableBase: number; vatAmount: number; total: number }>;
    }>(`/finance/reports/vat?${sp.toString()}`);
  },

  /**
   * Unified downloader. Supports CSV / XLSX / PDF for every Reports-page
   * report. Forwards all per-report filters as query params; the backend
   * /export endpoint ignores any it doesn't recognise.
   */
  downloadReport: async (
    reportType: string,
    format: 'csv' | 'xlsx' | 'pdf',
    filters: Record<string, string | undefined> = {},
  ) => {
    const token = getAccessToken();
    const sp = new URLSearchParams({ reportType, format });
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== '' && v !== 'all') sp.set(k, String(v));
    }
    const res = await fetch(`${API_URL}/finance/export?${sp.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
    a.download = `${reportType}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// ===========================================
// Discount API
// ===========================================

export interface CourseSaleItem {
  id: string;
  title: string;
  titleAr: string | null;
  thumbnail: string | null;
  status: string;
  price: number;
  effectivePrice: number;
  onSale: boolean;
  /** Set when the sale is a percentage; null when it's a fixed amount or off. */
  salePercent: number | null;
  /** Set when the sale is a fixed SAR amount; null when it's a percentage or off. */
  saleAmount: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  saleAllowsCoupon: boolean;
}

export const discountApi = {
  validate: (code: string, courseId: string) =>
    api.post<{ valid: boolean; discountAmount: number; discountId: string | null; error?: string }>('/discounts/validate', { code, courseId }),

  getAll: (
    page = 1,
    limit = 10,
    filters?: {
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      type?: 'percentage' | 'fixed';
      autoApply?: boolean;
      earlyBird?: boolean;
      campaignId?: string;
      scope?: 'all' | 'global' | 'course';
    },
  ) => {
    const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.status && filters.status !== 'all') sp.set('status', filters.status);
    if (filters?.search) sp.set('search', filters.search);
    if (filters?.startDate) sp.set('startDate', filters.startDate);
    if (filters?.endDate) sp.set('endDate', filters.endDate);
    if (filters?.type) sp.set('type', filters.type);
    if (filters?.autoApply !== undefined) sp.set('autoApply', String(filters.autoApply));
    if (filters?.earlyBird !== undefined) sp.set('earlyBird', String(filters.earlyBird));
    if (filters?.campaignId) sp.set('campaignId', filters.campaignId);
    if (filters?.scope) sp.set('scope', filters.scope);
    return api.get<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/discounts?${sp.toString()}`);
  },

  getById: (id: string) => api.get<any>(`/discounts/${id}`),

  getAnalytics: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<{
      totalSavings: number;
      avgDiscountPerUse: number;
      totalRedemptions: number;
      revenueLift: { withCoupon: number; withoutCoupon: number; liftPercentage: number };
      cannibalization: { totalCouponUsers: number; repeatBuyerCount: number; rate: number };
      topCoupons: Array<{ id: string; code: string; type: string; value: number; isActive: boolean; conversions: number; totalSaved: number }>;
    }>(`/discounts/analytics${qs ? `?${qs}` : ''}`);
  },

  getCampaignReport: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<Array<{ campaign: string; codeCount: number; totalRedemptions: number; totalSaved: number }>>(
      `/discounts/campaigns/report${qs ? `?${qs}` : ''}`,
    );
  },

  create: (data: {
    code: string;
    type: string;
    value: number;
    maxUses?: number;
    maxUsesPerUser?: number;
    campaign?: string;
    campaignId?: string;
    autoApply?: boolean;
    earlyBird?: boolean;
    minOrderAmount?: number;
    courseIds?: string[];
    validFrom?: string;
    validUntil?: string;
  }) => api.post<any>('/discounts', data),

  bulkGenerate: (data: {
    prefix: string;
    count: number;
    type: string;
    value: number;
    maxUses?: number;
    maxUsesPerUser?: number;
    campaign?: string;
    campaignId?: string;
    autoApply?: boolean;
    earlyBird?: boolean;
    minOrderAmount?: number;
    courseIds?: string[];
    validFrom?: string;
    validUntil?: string;
  }) => api.post<{ batchId: string; created: number; codes: string[] }>('/discounts/bulk', data),

  update: (id: string, data: any) =>
    api.patch<any>(`/discounts/${id}`, data),

  delete: (id: string) =>
    api.delete<{ deleted: boolean }>(`/discounts/${id}`),

  // Course-level sales (no coupon required) — finance-managed.
  listCourseSales: (search?: string) => {
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    const qs = sp.toString();
    return api.get<CourseSaleItem[]>(`/discounts/course-sales${qs ? `?${qs}` : ''}`);
  },

  setCourseSale: (
    courseId: string,
    data: {
      salePercent?: number | null;
      saleAmount?: number | null;
      saleStartsAt?: string | null;
      saleEndsAt?: string | null;
      saleAllowsCoupon?: boolean;
    },
  ) => api.put<CourseSaleItem>(`/discounts/course-sales/${courseId}`, data),

  // ─── Public / checkout ────────────────────────────────────────────

  /** Best auto-apply (early-bird) discount for a cart, or null. Public.
   * `code` is `null` when the winning discount is a direct-campaign
   * discount (no coupon-code row) — the frontend must render a campaign
   * banner in that case and MUST NOT paste the value into the coupon
   * input. `isCampaignDirect` flags that shape. */
  autoApply: (courseIds: string[], userId?: string) =>
    api.post<{
      code: string | null;
      discountId: string;
      discountAmount: number;
      applicableCourseId: string;
      campaign: { id: string; name: string; allowsCoupon?: boolean } | null;
      isCampaignDirect?: boolean;
    } | null>('/discounts/auto-apply', { courseIds, userId }),

  /** All active site-wide banner campaigns, newest-start first (capped
   * server-side at 10). Public, polled by the rotating banner strip.
   * `nameAr` / `descriptionAr` / `bannerCtaAr` are optional Arabic
   * variants; the banner falls back to the English text when they're
   * null. `scope` + `scopeCourseIds` let the banner route the CTA button
   * straight to a single course's detail page when applicable. */
  getActiveBannerCampaigns: () =>
    api.get<{
      campaigns: Array<{
        id: string;
        name: string;
        nameAr: string | null;
        description: string | null;
        descriptionAr: string | null;
        startsAt: string | null;
        endsAt: string | null;
        bannerCta: string | null;
        bannerCtaAr: string | null;
        scope: 'code_only' | 'all_paid' | 'by_delivery_type' | 'specific_courses';
        scopeCourseIds: string[];
      }>;
    }>('/discounts/active-banner-campaign'),

  // ─── Finance dashboard additions ──────────────────────────────────

  getSummary: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<{
      live: {
        activeCodes: number;
        autoApplyCodes: number;
        activeCampaigns: number;
      };
      window: {
        redemptions: number;
        totalSaved: number;
        avgSaved: number;
        uniqueUsers: number;
      };
    }>(`/discounts/summary${qs ? `?${qs}` : ''}`);
  },

  getAudit: (id: string) =>
    api.get<Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>>(`/discounts/${id}/audit`),

  // ─── Campaigns CRUD (finance) ─────────────────────────────────────

  listCampaigns: (opts?: {
    status?: 'active' | 'expired' | 'all';
    search?: string;
    page?: number;
    limit?: number;
    campaignType?: 'standard' | 'early_bird';
  }) => {
    const sp = new URLSearchParams();
    if (opts?.status) sp.set('status', opts.status);
    if (opts?.search) sp.set('search', opts.search);
    if (opts?.page) sp.set('page', String(opts.page));
    if (opts?.limit) sp.set('limit', String(opts.limit));
    if (opts?.campaignType) sp.set('campaignType', opts.campaignType);
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        name: string;
        nameAr: string | null;
        description: string | null;
        descriptionAr: string | null;
        startsAt: string | null;
        endsAt: string | null;
        budget: string | null;
        currentSpend: string;
        isActive: boolean;
        showOnSite: boolean;
        bannerCta: string | null;
        bannerCtaAr: string | null;
        bulkBatchId: string | null;
        createdAt: string;
        codeCount: number;
        campaignType?: 'standard' | 'early_bird';
        discountType?: 'none' | 'percentage' | 'fixed';
        discountValue?: string | number | null;
        scope?: 'code_only' | 'all_paid' | 'by_delivery_type' | 'specific_courses';
        scopeDeliveryTypes?: string[];
        scopeCourseIds?: string[];
        allowsCoupon?: boolean;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/discounts/campaigns${qs ? `?${qs}` : ''}`);
  },

  createCampaign: (data: {
    name: string;
    nameAr?: string | null;
    description?: string;
    descriptionAr?: string | null;
    startsAt?: string;
    endsAt?: string;
    budget?: number;
    showOnSite?: boolean;
    bannerCta?: string;
    bannerCtaAr?: string | null;
    campaignType?: 'standard' | 'early_bird';
    discountType?: 'none' | 'percentage' | 'fixed';
    discountValue?: number | null;
    scope?: 'code_only' | 'all_paid' | 'by_delivery_type' | 'specific_courses';
    scopeDeliveryTypes?: string[];
    scopeCourseIds?: string[];
    allowsCoupon?: boolean;
  }) => api.post<any>('/discounts/campaigns', data),

  getCampaign: (id: string) => api.get<any>(`/discounts/campaigns/${id}`),

  updateCampaign: (id: string, data: any) =>
    api.patch<any>(`/discounts/campaigns/${id}`, data),

  deleteCampaign: (id: string) =>
    api.delete<{ id: string; isActive: boolean }>(`/discounts/campaigns/${id}`),

  // ─── Overview / charts / activity (finance) ───────────────────────

  getChartSeries: (params?: { startDate?: string; endDate?: string }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();
    return api.get<{
      daily: Array<{ day: string; saved: number; redemptions: number }>;
      typeBreakdown: {
        percentage: number;
        fixed: number;
        earlyBird: number;
        campaign: number;
        autoApply: number;
      };
      topCodes: Array<{
        id: string;
        code: string;
        type: string;
        value: number;
        totalSaved: number;
        conversions: number;
      }>;
      funnel: {
        attempted: number;
        validated: number;
        redeemed: number;
        failed: number;
      };
    }>(`/discounts/chart-series${qs ? `?${qs}` : ''}`);
  },

  getRecentActivity: (limit = 10) =>
    api.get<{
      recentRedemptions: Array<{
        id: string;
        discountId: string | null;
        code: string | null;
        userEmail: string | null;
        amountSaved: number;
        paymentId: string;
        usedAt: string;
      }>;
      recentFailures: Array<{
        id: string;
        code: string | null;
        error: string | null;
        userEmail: string | null;
        createdAt: string;
      }>;
    }>(`/discounts/activity/recent?limit=${limit}`),

  listEarlyBird: () =>
    api.get<Array<{
      id: string;
      code: string;
      type: string;
      value: number;
      currentUses: number;
      maxUses: number | null;
      autoApply: boolean;
      applicableCourses: string[];
      validFrom: string | null;
      validUntil: string | null;
      isActive: boolean;
      campaign: string | null;
      campaignId: string | null;
      totalSaved: number;
      phase: 'scheduled' | 'live' | 'expired';
    }>>('/discounts/early-bird'),

  listBatches: (opts?: { page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (opts?.page) sp.set('page', String(opts.page));
    if (opts?.limit) sp.set('limit', String(opts.limit));
    const qs = sp.toString();
    return api.get<{
      data: Array<{
        id: string;
        prefix: string;
        requestedCount: number;
        createdCount: number;
        type: string;
        value: number;
        campaignLabel: string | null;
        campaignId: string | null;
        earlyBird: boolean;
        autoApply: boolean;
        validUntil: string | null;
        createdAt: string;
        redeemed: number;
        totalSaved: number;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/discounts/batches${qs ? `?${qs}` : ''}`);
  },

  export: async (params?: { status?: string; search?: string; startDate?: string; endDate?: string }) => {
    const token = getAccessToken();
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
    if (params?.startDate) sp.set('startDate', params.startDate);
    if (params?.endDate) sp.set('endDate', params.endDate);
    const qs = sp.toString();

    const res = await fetch(`${API_URL}/discounts/export${qs ? `?${qs}` : ''}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discounts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

export default api;
