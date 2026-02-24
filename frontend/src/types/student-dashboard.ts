// ─── Student Dashboard Types ──────────────────────────────────

export interface NextSessionInfo {
  id: string;
  title: string;
  courseTitle: string;
  courseTitleAr: string | null;
  scheduledAt: string;
  durationMinutes: number;
  sessionType: 'zoom' | 'onsite' | 'hybrid' | string;
  zoomLink: string | null;
  roomName: string | null;
  venueAddress: string | null;
  instructorName: string;
}

export interface StudentDashboardStats {
  enrolledCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  averageScore: number;
  certificatesEarned: number;
  upcomingSessions: number;
  // KPI fields
  averageProgress: number;
  attendanceRate: number;
  sessionsAttended: number;
  totalSessions: number;
  certificatesPending: number;
  certificatesExpiringSoon: number;
  nextSession: NextSessionInfo | null;
}

export interface StudentEnrolledCourse {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  deliveryType: string;
  thumbnail: string | null;
  startDate: string | null;
  endDate: string | null;
  enrollmentId: string;
  enrollmentStatus: string;
  progress: number;
  enrolledAt: string;
  completedAt: string | null;
  lastAccessedAt: string | null;
  instructorName: string;
  instructorAvatar: string | null;
  totalModules: number;
  totalHours: number;
  nextAction: string;
  nextDeadline: string | null;
  missingTasksCount: number;
}

export interface StudentEnrolledCoursesResponse {
  data: StudentEnrolledCourse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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

export interface CourseSession {
  id: string;
  title: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  zoomLink: string | null;
  roomName: string | null;
  venueAddress: string | null;
}

export interface CourseAssessmentWithSubmission {
  id: string;
  title: string;
  type: string;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number | null;
  attemptsAllowed: number;
  submission: {
    id: string;
    assessmentId: string;
    score: number | null;
    totalMarks: number | null;
    percentage: string | null;
    status: string;
    submittedAt: string | null;
  } | null;
}

export interface StudentCourseDetail {
  course: {
    id: string;
    title: string;
    titleAr: string | null;
    description: string | null;
    descriptionAr: string | null;
    deliveryType: string;
    thumbnail: string | null;
    startDate: string | null;
    endDate: string | null;
    instructorName: string;
  };
  enrollment: {
    id: string;
    status: string;
    progress: number;
    enrolledAt: string;
    completedAt: string | null;
  };
  modules: CourseModule[];
  sessions: CourseSession[];
  assessments: CourseAssessmentWithSubmission[];
}

export interface AttendanceRecord {
  sessionId: string;
  status: string;
  sessionTitle: string;
  scheduledAt: string;
}

export interface CourseProgress {
  enrollment: {
    id: string;
    progress: number;
    status: string;
  };
  modules: CourseModule[];
  attendance: AttendanceRecord[];
  sessionStats: {
    total: number;
    attended: number;
    percentage: number;
  };
}

export interface StudentCertificate {
  id: string;
  courseId: string;
  status: string;
  attendancePercent: string | null;
  assessmentPassed: boolean | null;
  courseCompleted: boolean | null;
  certificateUrl: string | null;
  createdAt: string;
  reviewedAt: string | null;
  courseTitle: string;
  courseTitleAr: string | null;
  instructorName: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  eventType: 'session';
  sessionType: string;
  status: string;
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  zoomLink: string | null;
  roomName: string | null;
  venueAddress: string | null;
  instructorName: string;
}

export type ActivityType =
  | 'assessment_submitted'
  | 'session_attended'
  | 'course_enrolled'
  | 'certificate_earned';

export interface RecentActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  courseTitle: string;
  courseTitleAr: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface TranscriptCourse {
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  deliveryType: string;
  startDate: string | null;
  endDate: string | null;
  enrolledAt: string;
  completedAt: string | null;
  progress: number;
  status: string;
  instructorName: string;
  totalHours: number;
  certificateStatus: string | null;
  certificateUrl: string | null;
}

export interface StudentTranscript {
  student: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    firstNameAr: string | null;
    lastNameAr: string | null;
    email: string;
  };
  courses: TranscriptCourse[];
  totalCompleted: number;
  totalInProgress: number;
  totalHours: number;
}

export interface EnrollmentResponse {
  id: string;
  courseId: string;
  studentId: string;
  status: string;
  progress: number;
  enrolledAt: string;
  completedAt: string | null;
  lastAccessedAt: string | null;
}

// ─── Assessment Types ──────────────────────────────────

export interface AssessmentQuestion {
  id: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'essay';
  questionText: string;
  questionTextAr: string | null;
  options: { text: string; textAr?: string }[];
  marks: number;
}

export interface StudentAssessment {
  id: string;
  title: string;
  type: string;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number | null;
  attemptsAllowed: number | null;
  attemptsTaken: number;
  questions: AssessmentQuestion[];
}

export interface AssessmentResult {
  submissionId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  status: string;
  passed: boolean;
}
