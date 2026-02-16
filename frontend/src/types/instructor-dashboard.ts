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
