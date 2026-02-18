// ─── Dashboard Summary API Response ──────────────────────────

export interface DashboardKPIs {
  activeCourses: number;
  todaysSessions: number;
  atRiskLearners: number;
}

export interface DashboardSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  type: 'zoom' | 'onsite' | 'hybrid';
  scheduledAt: string;
  durationMinutes: number;
  zoomLink: string | null;
  meetingId: string | null;
  roomName: string | null;
  venueAddress: string | null;
  status: string;
  enrolledCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardAtRiskLearner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  attendanceRate: number;
  lastAccessedAt: string | null;
  riskReasons: string[];
}

export interface DashboardCertificate {
  id: string;
  courseId: string;
  studentId: string;
  status: string;
  attendancePercent: string;
  assessmentPassed: boolean;
  courseCompleted: boolean;
  reviewNote: string | null;
  certificateUrl: string | null;
  createdAt: string;
  reviewedAt: string | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  courseName: string;
}

export interface DashboardCourse {
  id: string;
  title: string;
  titleAr: string | null;
  status: string;
}

export interface DashboardAssessmentScore {
  id: string;
  name: string;
  preScore: number;
  postScore: number;
}

export interface DashboardQuestionAnalysis {
  id: string;
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  correctRate: number;
}

export interface DashboardModuleProgress {
  name: string;
  percentage: number;
}

export interface DashboardMaterial {
  id: string;
  type: 'video' | 'pdf' | 'document' | 'image';
  name: string;
  version: string;
  status: 'live' | 'processing' | 'draft';
  wcagCompliant: boolean | 'warning';
  size?: string;
}

export interface DashboardTabAssessment {
  id: string;
  title: string;
  questions: number;
  submissions: number;
  avgScore: number;
}

export interface DashboardSummaryResponse {
  kpis: DashboardKPIs;
  todaySessions: DashboardSession[];
  upcomingSessions: DashboardSession[];
  atRiskLearners: DashboardAtRiskLearner[];
  pendingCertificates: DashboardCertificate[];
  activeCourses: DashboardCourse[];
  attendanceTrend: number[];
  moduleProgress: DashboardModuleProgress[];
  assessmentScores: DashboardAssessmentScore[];
  questionAnalysis: DashboardQuestionAnalysis[];
  materials: DashboardMaterial[];
  tabAssessments: DashboardTabAssessment[];
}

// ─── Course Enrollments API Response ────────────────────────

export interface CourseEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: string;
  progress: number;
  enrolledAt: string;
  completedAt: string | null;
  lastAccessedAt: string | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
}

// ─── Assessments API Response ───────────────────────────────

export interface AssessmentResponse {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  titleAr: string | null;
  type: string;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number | null;
  status: string;
  createdAt: string;
}

// ─── Course Listing (My Courses page) ────────────────────

export interface InstructorCourse {
  id: string;
  instructorId: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  deliveryType: 'zoom' | 'onsite' | 'blended';
  status: 'draft' | 'active' | 'completed' | 'archived';
  thumbnail: string | null;
  maxEnrollment: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  enrolledCount: number;
  completionRate: number;
  totalSessions: number;
  completedSessions: number;
  nextSessionAt: string | null;
  instructorName: string | null;
}

export interface InstructorCoursesResponse {
  data: InstructorCourse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InstructorCoursesParams {
  status?: string;
  delivery?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

// ─── Course Detail (single course page) ────────────────────

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  titleAr: string | null;
  orderIndex: number;
  type: string;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDetailResponse {
  id: string;
  instructorId: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  deliveryType: 'zoom' | 'onsite' | 'blended';
  status: 'draft' | 'active' | 'completed' | 'archived';
  thumbnail: string | null;
  maxEnrollment: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  modules: CourseModule[];
}

export interface CourseSession {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  type: 'zoom' | 'onsite' | 'hybrid';
  scheduledAt: string;
  durationMinutes: number;
  zoomLink: string | null;
  meetingId: string | null;
  roomName: string | null;
  venueAddress: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseSessionsResponse {
  data: CourseSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Attendance ─────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  durationMinutes: number | null;
  markedBy: string | null;
  note: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string;
}

// ─── Create Course ──────────────────────────────────────────

export interface CreateCourseData {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  deliveryType: 'zoom' | 'onsite' | 'blended';
  thumbnail?: string;
  maxEnrollment?: number;
  startDate?: string;
  endDate?: string;
}
