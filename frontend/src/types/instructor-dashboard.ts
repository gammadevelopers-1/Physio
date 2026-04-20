// ─── Dashboard Summary API Response ──────────────────────────

export interface DashboardKPIs {
  activeCourses: number;
  totalStudents: number;
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
  city: string | null;
  status: string;
  enrolledCount: number;
  courseThumbnail: string | null;
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
  enrolledCourseIds: string[];
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
  deliveryType?: string;
  cohort?: string | null;
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

export interface DashboardPendingSubmission {
  id: string;
  studentName: string;
  assessmentTitle: string;
  courseName: string;
  submittedAt: string;
  daysOverdue: number;
  assessmentId: string;
}

export interface DashboardFeedbackItem {
  id: string;
  learnerName: string;
  learnerInitials: string;
  courseName: string;
  rating: number;
  comment: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  date: string;
}

export interface DashboardRecentFeedback {
  overallRating: number;
  totalReviews: number;
  feedbackItems: DashboardFeedbackItem[];
}

export interface DashboardPassFailStats {
  totalStudents: number;
  passed: number;
  failed: number;
  passRate: number;
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
  tabAssessments?: DashboardTabAssessment[];
  pendingSubmissions: DashboardPendingSubmission[];
  recentFeedback?: DashboardRecentFeedback;
  passFailStats?: DashboardPassFailStats;
  notifications?: { id: string; title: string; message: string; type: string; read: boolean; date: string }[];
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
  studentScfhsNumber?: string | null;
}

// ─── Assessment Files ────────────────────────────────────────

export interface AssessmentFile {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
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
  attemptsAllowed: number;
  status: string;
  // Proctoring
  proctoringEnabled: boolean;
  proctoringRules: {
    webcamRequired?: boolean;
    browserLockdown?: boolean;
    tabSwitchAlert?: boolean;
  } | null;
  timeLimitEnforced: boolean;
  // Retake rules
  maxRetakes: number;
  retakeCoolingHours: number;
  retakeScorePolicy: string;
  retakeScope: string;
  // Flagging
  flaggedAt: string | null;
  flaggedReason: string | null;
  flaggedBy: string | null;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
  // Assignment-specific
  assignmentFiles?: AssessmentFile[];
  instructions?: string | null;
  dueDate?: string | null;
}

export interface AssessmentsListResponse {
  data: AssessmentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Questions ──────────────────────────────────────────────

export interface QuestionOption {
  text: string;
  textAr?: string;
  isCorrect: boolean;
}

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'essay';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface AssessmentQuestion {
  id: string;
  assessmentId: string | null;
  courseId: string;
  type: QuestionType;
  questionText: string;
  questionTextAr?: string;
  options?: QuestionOption[];
  correctAnswer?: string;
  marks: number;
  difficultyLevel?: DifficultyLevel;
  createdAt: string;
}

// ─── Submissions ────────────────────────────────────────────

export interface SubmissionAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

export interface AssessmentSubmission {
  id: string;
  assessmentId: string;
  studentId: string;
  answers: SubmissionAnswer[];
  score: number | null;
  totalMarks: number | null;
  percentage: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  status: 'in_progress' | 'submitted' | 'graded';
  createdAt: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  // Assignment & grading comment fields
  submissionFiles?: AssessmentFile[];
  instructorComment?: string | null;
  questionComments?: Record<string, string>;
  // Retake grouping annotations
  attemptNumber?: number;
  totalAttempts?: number;
  isEffective?: boolean;
  hasUnusedRetakeGrant?: boolean;
}

// ─── Item Analysis ──────────────────────────────────────────

export interface ItemAnalysisQuestion {
  questionId: string;
  questionText: string;
  type: string;
  marks: number;
  difficultyIndex: number;
  discriminationIndex: number;
  totalAttempts: number;
  correctAnswers: number;
}

export interface PrePostComparison {
  assessmentId: string;
  title: string;
  type: string;
  averagePercentage: number;
  totalSubmissions: number;
}

export interface ItemAnalysisResponse {
  questions: ItemAnalysisQuestion[];
  totalSubmissions: number;
  prePostComparison: PrePostComparison[] | null;
}

// ─── Course Listing (My Courses page) ────────────────────

export interface InstructorCourse {
  id: string;
  instructorId: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  deliveryType: 'zoom' | 'onsite' | 'blended' | 'self-paced';
  status: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'completed' | 'archived';
  thumbnail: string | null;
  maxEnrollment: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  price: number;
  enrolledCount: number;
  completionRate: number;
  totalSessions: number;
  completedSessions: number;
  nextSessionAt: string | null;
  instructorName: string | null;
  cohort?: string | null;
  totalModules?: number;
  cmeHours?: number | null;
  visibleOnPublicSite?: boolean;
  isFeatured?: boolean;
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
  deliveryType: 'zoom' | 'onsite' | 'blended' | 'self-paced';
  status: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'completed' | 'archived';
  reviewNote?: string | null;
  thumbnail: string | null;
  maxEnrollment: number | null;
  cmeHours: number | null;
  isCmeAccredited: boolean;
  startDate: string | null;
  endDate: string | null;
  cohort: string | null;
  createdAt: string;
  updatedAt: string;
  // Course-level assessment defaults (set by manager)
  assessmentTimeLimitEnforced?: boolean;
  assessmentProctoringEnabled?: boolean;
  assessmentMaxRetakes?: number;
  assessmentRetakeCoolingHours?: number;
  assessmentRetakeScorePolicy?: string;
  assessmentRetakeScope?: string;
  isFeatured?: boolean;
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
  city: string | null;
  status: 'scheduled' | 'live' | 'ended' | 'completed' | 'cancelled' | 'missed' | 'rescheduled';
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Makeup session fields
  isMakeup?: boolean;
  parentSessionId?: string | null;
  // Capacity fields (from enriched backend response)
  enrolledCount?: number;
  nelcLimit?: number;
  capacityPercent?: number;
}

export interface CourseSessionsResponse {
  data: CourseSession[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Attendance ─────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'unmarked';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  joinedAt: string | null;
  leftAt: string | null;
  durationMinutes: number | null;
  markedBy: string | null;
  note: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string;
  studentScfhsNumber?: string | null;
}

// ─── Instructor Students ────────────────────────────────────

export interface InstructorStudent {
  studentId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  scfhsNumber?: string | null;
  totalEnrollments: number;
  averageProgress: number;
  lastAccessedAt: string | null;
  attendanceRate: number | null;
  assessmentAverage: number | null;
}

export interface AtRiskStudent {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  attendanceRate: number;
  lastAccessedAt: string | null;
  riskReasons: string[];
  enrolledCourseIds: string[];
}

export interface StudentDetailEnrollment {
  id: string;
  courseId: string;
  status: string;
  progress: number;
  enrolledAt: string;
  completedAt: string | null;
  lastAccessedAt: string | null;
  courseTitle: string;
  courseTitleAr: string | null;
}

export interface StudentAttendanceSummary {
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export interface StudentAssessmentScore {
  assessmentId: string;
  title: string;
  score: number;
  maxScore: number;
  classAverage: number;
}

export interface StudentAttendanceRecord {
  sessionId: string;
  status: AttendanceStatus;
  sessionTitle: string;
  scheduledAt: string;
  courseId: string;
  courseTitle: string;
}

export interface CoursePerformance {
  courseId: string;
  courseTitle: string;
  courseTitleAr?: string | null;
  enrollmentStatus: string;
  progress: number;
  enrolledAt: string;
  completedAt?: string | null;
  attendance: StudentAttendanceSummary;
  assessments: StudentAssessmentScore[];
  assessmentAverage: number | null;
  attendanceRecords: StudentAttendanceRecord[];
}

export interface StudentDetailResponse {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  scfhsNumber?: string | null;
  enrollments: StudentDetailEnrollment[];
  coursePerformance?: CoursePerformance[];
  attendanceSummary: StudentAttendanceSummary;
  assessmentScores: StudentAssessmentScore[];
  attendanceRecords: StudentAttendanceRecord[];
}

// ─── Create Course ──────────────────────────────────────────

export interface CreateCourseData {
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  deliveryType: 'zoom' | 'onsite' | 'blended' | 'self-paced';
  thumbnail?: string;
  maxEnrollment?: number;
  startDate?: string;
  endDate?: string;
}

// ─── Course Materials ──────────────────────────────────────

export type MaterialType = 'video' | 'pdf' | 'document' | 'image';
export type MaterialStatus = 'processing' | 'pending_review' | 'live' | 'failed' | 'archived' | 'changes_requested';

export interface CourseMaterialResponse {
  id: string;
  courseId: string;
  moduleId: string | null;
  title: string;
  type: MaterialType;
  fileUrl: string | null;
  fileSize: number | string;
  mimeType: string;
  version: number;
  previousVersionId: string | null;
  status: MaterialStatus;
  wcagStatus: string;
  wcagDetails: string | null;
  captionsUrl: string | null;
  transcriptUrl: string | null;
  processingStep: string | null;
  processingError: string | null;
  autoTranscribe?: boolean;
  uploadedBy: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialVariant {
  id: string;
  materialId: string;
  resolution: string;
  fileUrl: string;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  bitrate: string | null;
  mimeType: string;
  createdAt: string;
}

// ─── Certificate Requests ──────────────────────────────────

export type CertificateStatus = 'pending' | 'approved' | 'rejected' | 'held' | 'revoked';

export interface CertificateRequestResponse {
  id: string;
  courseId: string;
  studentId: string;
  status: CertificateStatus;
  attendancePercent: string | null;
  assessmentPassed: boolean | null;
  courseCompleted: boolean | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  certificateUrl: string | null;
  createdAt: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  courseName?: string;
}

export interface CertificateListResponse {
  data: CertificateRequestResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BatchCertificateResult {
  processed: number;
  successful: number;
  failed: number;
  results: { id: string; status: string; error?: string }[];
}

// ─── Interventions ──────────────────────────────────────────

export type InterventionType = 'email' | 'makeup_session' | 'ticket';

export interface CreateInterventionPayload {
  type: InterventionType;
  studentId: string;
  courseId?: string;
  message?: string;
}

export interface InterventionResponse {
  id: string;
  instructorId: string;
  studentId: string;
  courseId: string | null;
  type: InterventionType;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface InterventionRecord {
  id: string;
  type: InterventionType;
  message: string | null;
  instructorName: string;
  courseName: string | null;
  createdAt: string;
}

// ─── Public Course Listing ──────────────────────────────────

export interface PublicCourseSession {
  id: string;
  title: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  venueAddress: string | null;
  roomName: string | null;
  city: string | null;
  status: string;
}

export interface PublicCourseMaterial {
  id: string;
  title: string;
  type: string;
  orderIndex: number;
}

export interface PublicCourseModule {
  id: string;
  title: string;
  titleAr: string | null;
  orderIndex: number;
  type: string;
  durationMinutes: number | null;
  materials?: PublicCourseMaterial[];
}

export interface PublicCourseRating {
  rating: number;
  reviewText: string | null;
  createdAt: string;
  studentName: string;
}

export interface PublicCourse {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  deliveryType: string;
  thumbnail: string | null;
  startDate: string | null;
  endDate: string | null;
  enrolledCount: number;
  totalHours: number;
  avgRating: number;
  totalRatings: number;
  instructorName: string;
  price: number;
  cmeHours: number;
  isCmeAccredited: boolean;
  enrollmentDeadline: string | null;
  language: string;
  maxEnrollment: number | null;
  remainingSeats: number;
  isFull: boolean;
  sessionCount: number;
  status?: string;
  availabilityStatus?: 'open' | 'completed' | 'full' | 'deadline_passed';
  // Content fields
  overview: string | null;
  overviewAr: string | null;
  objectives: string[] | null;
  objectivesAr: string[] | null;
  features: string[] | null;
  featuresAr: string[] | null;
  targetAudience: string[] | null;
  targetAudienceAr: string[] | null;
  requirements: string | null;
  requirementsAr: string | null;
  notices: string | null;
  noticesAr: string | null;
  venue: string | null;
  venueAr: string | null;
  showContents: boolean | null;
  sectionsOrder: string[] | null;
  // Related data
  sessions: PublicCourseSession[];
  modules: PublicCourseModule[];
  ratings: PublicCourseRating[];
}

export interface PublicCoursesResponse {
  data: PublicCourse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
