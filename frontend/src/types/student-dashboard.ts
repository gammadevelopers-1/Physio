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
  sessionsAttended: number;
  totalSessions: number;
  attendanceRate: number;
  hasReviewed?: boolean;
  hasReviewedInstructor?: boolean;
  // Action-required indicators surfaced on the My Courses card pill.
  nelcReviewLink?: string | null;
  certificateRequestStatus?: 'pending' | 'approved' | 'rejected' | 'held' | 'revoked' | string | null;
  certificateRequestUrl?: string | null;
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
  isCompleted?: boolean;
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

export interface AttemptSummary {
  id: string;
  attemptNumber: number;
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  status: string;
  submittedAt: string | null;
  isEffective: boolean;
}

export interface CourseAssessmentWithSubmission {
  id: string;
  title: string;
  type: string;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number | null;
  attemptsAllowed: number;
  moduleId?: string | null;
  dueDate?: string | null;
  canRetake?: boolean;
  retakeScorePolicy?: string;
  submission: {
    id: string;
    assessmentId: string;
    score: number | null;
    totalMarks: number | null;
    percentage: string | null;
    status: string;
    submittedAt: string | null;
  } | null;
  allAttempts?: AttemptSummary[];
}

export interface StudentAttendanceRecord {
  sessionId: string;
  sessionTitle: string;
  sessionType: string;
  scheduledAt: string;
  sessionDurationMinutes: number | null;
  sessionStatus: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  joinedAt: string | null;
  leftAt: string | null;
  durationMinutes: number | null;
  presencePercent: number | null;
}

export interface CourseFaq {
  question?: string | null;
  questionAr?: string | null;
  answer?: string | null;
  answerAr?: string | null;
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
    language?: string | null;
    instructorName: string;
    isCmeAccredited: boolean;
    cmeHours: number;
    accreditationNumber?: string | null;
    nelcReviewLink?: string | null;
    isSequential?: boolean;
    faqs?: CourseFaq[] | null;
    // Extended instructor profile for the inline instructor card on the
    // student course-detail page. All optional; UI hides missing fields.
    instructorId?: string | null;
    instructorFirstName?: string | null;
    instructorLastName?: string | null;
    instructorFirstNameAr?: string | null;
    instructorLastNameAr?: string | null;
    instructorAvatar?: string | null;
    instructorBio?: string | null;
    instructorProfession?: string | null;
    instructorSpecialty?: string | null;
    instructorQualification?: string | null;
    instructorAvgRating?: number;
    instructorTotalRatings?: number;
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
  attendanceSummary: {
    total: number;
    attended: number;
    percentage: number;
  };
  attendanceRecords?: StudentAttendanceRecord[];
  assessmentSummary: {
    total: number;
    completed: number;
    averageScore: number;
  };
  myRating?: {
    id: string;
    rating: number;
    reviewText: string | null;
    createdAt: string;
  } | null;
  certificateRequest?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'held' | 'revoked' | string;
    certificateUrl: string | null;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
  } | null;
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
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  courseTitle: string;
  courseTitleAr: string | null;
  cmeHours: number | null;
  instructorName: string;
}

export interface RecentGrade {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  gradedAt: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  durationMinutes: number;
  eventType: 'session' | 'assessment' | 'assignment';
  sessionType: string;
  status: string;
  courseId: string;
  courseTitle: string;
  courseTitleAr: string | null;
  zoomLink: string | null;
  roomName: string | null;
  venueAddress: string | null;
  instructorName: string;
  /** Student's own attendance for this session: present | absent | late | excused | null */
  attendanceStatus?: string | null;
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

// ─── Module Material Types ──────────────────────────────

export interface MaterialVariant {
  id: string;
  resolution: string;
  fileUrl: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  bitrate: string | null;
  mimeType: string;
}

export interface MaterialProgressData {
  watchedSeconds: number;
  totalSeconds: number;
  furthestWatchedSecond: number;
  isCompleted: boolean;
}

export interface ModuleMaterial {
  id: string;
  title: string;
  type: 'video' | 'pdf' | 'document' | 'image';
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  captionsUrl: string | null;
  transcriptUrl: string | null;
  orderIndex: number;
  variants: MaterialVariant[];
  progress: MaterialProgressData | null;
}

export interface ModuleMaterialsResponse {
  materials: ModuleMaterial[];
}

// ─── Assessment Types ──────────────────────────────────

export interface AssessmentQuestion {
  id: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'essay' | 'file_upload';
  questionText: string;
  questionTextAr: string | null;
  options: { text: string; textAr?: string }[];
  marks: number;
  isMultiSelect?: boolean;
}

export interface StudentAssessmentFile {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
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
  canRetake?: boolean;
  retakeAvailableAt?: string | null;
  maxAttemptsReached?: boolean;
  latestSubmission?: {
    id: string;
    status: string;
    score: number | null;
  } | null;
  instructions?: string | null;
  // Time limit policy — false means duration/dueDate is advisory only
  timeLimitEnforced?: boolean;
  // Retake info — set when manager has granted an extra attempt
  currentAttemptNumber?: number; // 1 for original, 2+ for retakes
  isRetakeAttempt?: boolean; // true when this attempt is consuming an unused grant
  retakeScorePolicy?: string; // 'highest' | 'latest' | 'average'
  allAttempts?: AttemptSummary[]; // all past graded/submitted attempts
  questions: AssessmentQuestion[];
  // Assignment-specific
  dueDate?: string | null;
  assignmentFiles?: StudentAssessmentFile[];
  canSubmit?: boolean;
}

export interface GradedAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  questionText: string;
  questionType: string;
  questionMarks: number;
}

export interface AssessmentResult {
  submissionId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  status: string;
  passed: boolean;
  hasManualGrading?: boolean;
  gradedAnswers?: GradedAnswer[];
}

// ─── Support Ticket Types ──────────────────────────────

export type TicketStatus = 'new' | 'in_progress' | 'resolved' | 'closed';
export type TicketCategory = 'billing' | 'login' | 'content' | 'certificate' | 'technical' | 'other';
export type TicketPriority = 'high' | 'medium' | 'low';

export interface SupportTicket {
  id: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  status: TicketStatus;
  courseTitle: string | null;
  courseTitleAr: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface TicketReply {
  id: string;
  message: string;
  isStaffReply: boolean;
  createdAt: string;
  userName: string;
}

export interface TicketDetail {
  id: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  attachmentUrl: string | null;
  status: TicketStatus;
  satisfactionRating: number | null;
  courseTitle: string | null;
  courseTitleAr: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  replies: TicketReply[];
}

export interface TicketsResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  limit: number;
}

export interface SubmissionReview {
  submissionId: string;
  assessmentId: string;
  score: number;
  totalMarks: number;
  percentage: number;
  answers: Array<{
    questionId: string;
    answer: string;
    isCorrect: boolean | null;
    marksAwarded: number | null;
  }>;
  questions: Array<{
    id: string;
    type: string;
    questionText: string;
    questionTextAr: string | null;
    options: Array<{ text: string; textAr?: string; isCorrect: boolean }>;
    correctAnswer: string | null;
    marks: number;
  }>;
  // Assignment & grading comment fields
  submissionFiles?: StudentAssessmentFile[];
  instructorComment?: string | null;
  questionComments?: Record<string, string>;
}
