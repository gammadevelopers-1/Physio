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
      throw new ApiError(response.status, `Request failed with status ${response.status}`);
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
// FormData Upload (multipart/form-data)
// ===========================================
async function uploadFormData<T>(
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
} from '@/types/instructor-dashboard';

export const instructorApi = {
  // Aggregated dashboard summary
  getDashboardSummary: () =>
    api.get<DashboardSummaryResponse>('/instructor/dashboard-summary'),

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
  createAssessment: (data: { courseId: string; title: string; type: string; totalMarks: number; passingMarks: number; durationMinutes?: number; attemptsAllowed?: number; dueDate?: string; instructions?: string; moduleId?: string }) =>
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
  createCourse: (data: { title: string; titleAr?: string; description?: string; descriptionAr?: string; deliveryType: string; thumbnail?: string; maxEnrollment?: number; startDate?: string; endDate?: string }) =>
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

  cancelSession: (sessionId: string, cancelReason: string) =>
    api.patch<CourseSession>(`/sessions/${sessionId}/cancel`, { cancelReason }),

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

  // Interventions
  createIntervention: (data: CreateInterventionPayload) =>
    api.post<InterventionResponse>('/instructor/interventions', data),

  getStudentInterventions: (studentId: string) =>
    api.get<InterventionRecord[]>(`/instructor/students/${studentId}/interventions`),

  // Course Rating Stats
  getCourseRatingStats: (courseId: string) =>
    api.get<{ avgRating: number; totalRatings: number }>(`/courses/${courseId}/ratings/stats`),

  // Certificates
  getCertificates: (params?: { courseId?: string; status?: string; page?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.courseId && params.courseId !== 'all') sp.set('courseId', params.courseId);
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
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

  getMyCertificates: () =>
    api.get<{ id: string; courseId: string; status: string; certificateUrl: string | null; createdAt: string; reviewedAt: string | null; courseName: string; courseThumbnail: string | null }[]>('/certificates/my-certificates'),
};

// ===========================================
// Profile API (self-service)
// ===========================================
export const profileApi = {
  update: (data: { firstName?: string; lastName?: string; firstNameAr?: string; lastNameAr?: string; phone?: string; avatar?: string | null; bio?: string; location?: string; language?: string; department?: string; scfhsNumber?: string; nationalId?: string; nationality?: string; gender?: string; dateOfBirth?: string }) =>
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
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));

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
          reject(new Error(xhr.responseText || 'Replace failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Replace failed'));

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
};

// ===========================================
// Reports API (binary file download)
// ===========================================
export type ReportType = 'attendance' | 'gradebook' | 'enrollment' | 'completion' | 'course-catalog' | 'satisfaction' | 'instructor-performance' | 'nelc-compliance' | 'revenue';
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
}

export interface CreateCourseManagerData {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  deliveryType: 'zoom' | 'onsite' | 'blended';
  thumbnail?: string;
  maxEnrollment?: number;
  startDate?: string;
  endDate?: string;
  instructorId: string;
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

  getUpcomingSessions: () =>
    api.get<CourseSession[]>('/sessions/upcoming'),

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

  rescheduleSession: (sessionId: string, scheduledAt: string, durationMinutes?: number) =>
    api.patch(`/sessions/${sessionId}/reschedule`, { scheduledAt, durationMinutes }),

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

  getOverrides: (assessmentId: string) =>
    api.get<Array<{ id: string; assessmentId: string; studentId: string; overrideType: string; value: number; reason: string; grantedBy: string; expiresAt: string | null; createdAt: string; studentFirstName?: string; studentLastName?: string; granterFirstName?: string; granterLastName?: string }>>(`/assessments/${assessmentId}/overrides`),

  // Enrollments for a course
  getEnrollments: (params: { courseId: string }) =>
    api.get<{ data: CourseEnrollment[] }>(`/courses/${params.courseId}/enrollments`),

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

  // Delete course (draft only)
  deleteCourse: (courseId: string) =>
    api.delete(`/courses/${courseId}`),

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

  getCourseRatings: (courseId: string) =>
    api.get<Array<{
      id: string;
      rating: number;
      reviewText: string | null;
      createdAt: string;
      studentName: string;
    }>>(`/courses/${courseId}/ratings`),

  getCourseRatingStats: (courseId: string) =>
    api.get<{ avgRating: number; totalRatings: number }>(`/courses/${courseId}/ratings/stats`),

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

  exportCsv: async () => {
    const token = getAccessToken();
    const res = await globalThis.fetch(`/api/nelc-audit/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
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
      overallStatus: 'passed' | 'review' | 'failed';
      summary: { passed: number; review: number; failed: number; total: number };
    }>>('/nelc-compliance/all-courses'),

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
// User Notifications API
// ===========================================
export interface UserNotification {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export const userNotificationsApi = {
  getAll: (params?: { limit?: number; unreadOnly?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.unreadOnly) sp.set('unreadOnly', 'true');
    const qs = sp.toString();
    return api.get<{ data: UserNotification[]; unreadCount: number }>(
      `/user-notifications${qs ? `?${qs}` : ''}`,
    );
  },

  getUnreadCount: () =>
    api.get<{ unreadCount: number }>('/user-notifications/unread-count'),

  markAsRead: (id: string) =>
    api.patch<UserNotification>(`/user-notifications/${id}/read`),

  markAllAsRead: () =>
    api.patch<{ message: string }>('/user-notifications/read-all'),
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

export const studentApi = {
  getDashboard: () =>
    api.get<StudentDashboardStats>('/student/dashboard'),

  getCourses: (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status && params.status !== 'all') sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
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

  getCertificates: () =>
    api.get<StudentCertificate[]>('/student/certificates'),

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
};

// ===========================================
// Public API (no auth)
// ===========================================

export const publicApi = {
  getCourses: (params?: {
    search?: string;
    delivery?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.delivery) qs.set('delivery', params.delivery);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const queryString = qs.toString();
    return api.get<PublicCoursesResponse>(
      `/courses/public${queryString ? `?${queryString}` : ''}`,
      { skipAuth: true },
    );
  },
};

export default api;
