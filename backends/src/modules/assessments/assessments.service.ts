import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, isNull, inArray, aliasedTable } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../database';
import {
  assessments,
  questions,
  submissions,
  courses,
  users,
  assessmentOverrides,
  enrollments,
  ASSESSMENT_STATUS,
  QUESTION_TYPE,
  QuestionOption,
  SubmissionAnswer,
} from '../../database/schema';
import type { AssessmentFile } from '../../database/schema/assessments';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { StorageService } from '../storage/storage.service';

const ASSIGNMENT_ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly userNotificationsService: UserNotificationsService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('MANAGER')
    );
  }

  // ─── Assessment CRUD ──────────────────────────────────────

  /**
   * Create a new assessment.
   * - Instructor: verifies course belongs to them.
   * - Admin: can create for any course.
   */
  async create(user: AuthenticatedUser, dto: CreateAssessmentDto) {
    await this.verifyCourseAccess(dto.courseId, user);

    // Enforce 1 attempt for quiz/exam
    const attemptsAllowed =
      dto.type === 'quiz' || dto.type === 'exam'
        ? 1
        : dto.attemptsAllowed ?? 1;

    const [assessment] = await db
      .insert(assessments)
      .values({
        courseId: dto.courseId,
        moduleId: dto.moduleId,
        title: dto.title,
        type: dto.type,
        totalMarks: dto.totalMarks,
        passingMarks: dto.passingMarks,
        durationMinutes: dto.durationMinutes,
        attemptsAllowed,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        instructions: dto.instructions,
      })
      .returning();

    return assessment;
  }

  /**
   * List assessments with optional filters.
   * - Instructor: only assessments for their own courses.
   * - Admin: all assessments.
   */
  async findAll(
    user: AuthenticatedUser,
    params: {
      courseId?: string;
      type?: string;
      status?: string;
      moduleId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    // Instructor: scope to own courses only
    if (!this.isAdmin(user)) {
      const instructorCourseIds = await this.getInstructorCourseIds(user.id);
      if (instructorCourseIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      conditions.push(
        sql`${assessments.courseId} IN (${sql.join(
          instructorCourseIds.map((id) => sql`${id}`),
          sql`, `,
        )})` as any,
      );
    }

    if (params.courseId) {
      conditions.push(eq(assessments.courseId, params.courseId));
    }

    if (
      params.type &&
      ['quiz', 'exam', 'assignment'].includes(params.type)
    ) {
      conditions.push(eq(assessments.type, params.type));
    }

    if (
      params.status &&
      Object.values(ASSESSMENT_STATUS).includes(params.status as any)
    ) {
      conditions.push(eq(assessments.status, params.status));
    }

    if (params.moduleId) {
      conditions.push(eq(assessments.moduleId, params.moduleId));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(assessments)
      .where(whereClause)
      .orderBy(desc(assessments.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(assessments)
      .where(whereClause);

    // Batch-fetch submission counts per assessment
    const assessmentIds = data.map((a) => a.id);
    const subCountMap = new Map<string, number>();

    if (assessmentIds.length > 0) {
      const subCounts = await db
        .select({
          assessmentId: submissions.assessmentId,
          cnt: count(),
        })
        .from(submissions)
        .where(inArray(submissions.assessmentId, assessmentIds))
        .groupBy(submissions.assessmentId);

      for (const sc of subCounts) {
        subCountMap.set(sc.assessmentId, Number(sc.cnt));
      }
    }

    const enrichedData = data.map((a) => ({
      ...a,
      submissionCount: subCountMap.get(a.id) || 0,
    }));

    return {
      data: enrichedData,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    };
  }

  /**
   * Get assessment detail with questions.
   */
  async findOne(assessmentId: string, user: AuthenticatedUser) {
    const assessment = await this.verifyAssessmentAccess(
      assessmentId,
      user,
    );

    const assessmentQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId))
      .orderBy(asc(questions.createdAt));

    return { ...assessment, questions: assessmentQuestions };
  }

  /**
   * Update an assessment.
   */
  async update(
    assessmentId: string,
    user: AuthenticatedUser,
    dto: UpdateAssessmentDto,
  ) {
    const existing = await this.verifyAssessmentAccess(assessmentId, user);

    const effectiveType = dto.type || existing.type;

    // Strip attemptsAllowed for quiz/exam
    if (effectiveType === 'quiz' || effectiveType === 'exam') {
      delete dto.attemptsAllowed;
    }

    // If publishing, validate based on type
    if (dto.status === ASSESSMENT_STATUS.PUBLISHED) {
      if (effectiveType === 'assignment') {
        // Assignments need ≥1 file + dueDate
        const files = existing.assignmentFiles as AssessmentFile[] | null;
        if (!files || files.length === 0) {
          throw new BadRequestException(
            'Cannot publish an assignment with no files. Upload at least one file first.',
          );
        }
        const effectiveDueDate = dto.dueDate ? new Date(dto.dueDate) : existing.dueDate;
        if (!effectiveDueDate) {
          throw new BadRequestException(
            'Cannot publish an assignment without a deadline. Set a due date first.',
          );
        }
      } else {
        // Quiz/exam need ≥1 question
        const [questionCount] = await db
          .select({ count: count() })
          .from(questions)
          .where(eq(questions.assessmentId, assessmentId));

        if (!questionCount || Number(questionCount.count) === 0) {
          throw new BadRequestException(
            'Cannot publish an assessment with no questions. Add at least one question first.',
          );
        }
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = { ...dto, updatedAt: new Date() };
    if (dto.dueDate) {
      updateData.dueDate = new Date(dto.dueDate);
    }

    const [updated] = await db
      .update(assessments)
      .set(updateData)
      .where(eq(assessments.id, assessmentId))
      .returning();

    // Notify enrolled students when assessment is published
    if (dto.status === ASSESSMENT_STATUS.PUBLISHED && updated) {
      try {
        const enrolledStudents = await db
          .select({ studentId: enrollments.studentId })
          .from(enrollments)
          .where(eq(enrollments.courseId, updated.courseId));

        const studentIds = enrolledStudents.map((e) => e.studentId);

        if (studentIds.length > 0) {
          const [course] = await db
            .select({ title: courses.title })
            .from(courses)
            .where(eq(courses.id, updated.courseId))
            .limit(1);

          const courseName = course?.title || 'your course';

          await this.userNotificationsService.createBulk(studentIds, {
            type: 'assessment_published',
            title: 'New Assessment Published',
            message: `A new ${updated.type} "${updated.title}" has been published for ${courseName}.`,
            link: `/dashboard/student/courses/${updated.courseId}`,
            entityType: 'assessment',
            entityId: updated.id,
          });
        }
      } catch (err) {
        this.logger.error('Failed to notify students about published assessment', err);
      }
    }

    return updated;
  }

  /**
   * Delete an assessment — only draft assessments.
   */
  async remove(assessmentId: string, user: AuthenticatedUser) {
    const existing = await this.verifyAssessmentAccess(assessmentId, user);

    if (existing.status !== ASSESSMENT_STATUS.DRAFT) {
      throw new BadRequestException(
        'Only draft assessments can be deleted',
      );
    }

    await db.delete(assessments).where(eq(assessments.id, assessmentId));

    return { message: 'Assessment deleted successfully' };
  }

  // ─── Question Management ──────────────────────────────────

  /**
   * Add a question to an assessment.
   * courseId is derived from the assessment.
   */
  async addQuestion(
    assessmentId: string,
    user: AuthenticatedUser,
    dto: CreateQuestionDto,
  ) {
    const assessment = await this.verifyAssessmentAccess(
      assessmentId,
      user,
    );

    const [question] = await db
      .insert(questions)
      .values({
        assessmentId,
        courseId: assessment.courseId,
        type: dto.type,
        questionText: dto.questionText,
        questionTextAr: dto.questionTextAr,
        options: dto.options,
        correctAnswer: dto.correctAnswer,
        marks: dto.marks,
        difficultyLevel: dto.difficultyLevel,
      })
      .returning();

    return question;
  }

  /**
   * List questions for an assessment.
   */
  async getQuestions(assessmentId: string, user: AuthenticatedUser) {
    await this.verifyAssessmentAccess(assessmentId, user);

    const data = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId))
      .orderBy(asc(questions.createdAt));

    return data;
  }

  /**
   * Add a question to the course-level bank (no assessment).
   */
  async addCourseBankQuestion(
    courseId: string,
    user: AuthenticatedUser,
    dto: CreateQuestionDto,
  ) {
    await this.verifyCourseAccess(courseId, user);

    const [question] = await db
      .insert(questions)
      .values({
        assessmentId: null,
        courseId,
        type: dto.type,
        questionText: dto.questionText,
        questionTextAr: dto.questionTextAr,
        options: dto.options,
        correctAnswer: dto.correctAnswer,
        marks: dto.marks,
        difficultyLevel: dto.difficultyLevel,
      })
      .returning();

    return question;
  }

  /**
   * List course-level bank questions (assessmentId IS NULL).
   */
  async getCourseBankQuestions(courseId: string, user: AuthenticatedUser) {
    await this.verifyCourseAccess(courseId, user);

    const data = await db
      .select()
      .from(questions)
      .where(
        and(
          eq(questions.courseId, courseId),
          isNull(questions.assessmentId),
        ),
      )
      .orderBy(asc(questions.createdAt));

    return data;
  }

  /**
   * Update a question.
   * Verifies access through the question's course → instructor chain.
   */
  async updateQuestion(
    questionId: string,
    user: AuthenticatedUser,
    dto: UpdateQuestionDto,
  ) {
    await this.verifyQuestionAccess(questionId, user);

    const updateData: Record<string, unknown> = { ...dto };

    const [updated] = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, questionId))
      .returning();

    return updated;
  }

  /**
   * Delete a question.
   */
  async removeQuestion(questionId: string, user: AuthenticatedUser) {
    await this.verifyQuestionAccess(questionId, user);

    await db.delete(questions).where(eq(questions.id, questionId));

    return { message: 'Question deleted successfully' };
  }

  // ─── Submissions & Grading ────────────────────────────────

  /**
   * Submit answers for an assessment.
   * Auto-grades MCQ and true_false questions.
   * Essay and short_answer are left for manual grading.
   */
  async submit(
    assessmentId: string,
    user: AuthenticatedUser,
    dto: SubmitAssessmentDto,
  ) {
    // Get the assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.status !== ASSESSMENT_STATUS.PUBLISHED) {
      throw new BadRequestException(
        'Can only submit answers for published assessments',
      );
    }

    // Check attempts — count existing submissions by this student
    const [attemptCount] = await db
      .select({ count: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, user.id),
        ),
      );

    if (
      attemptCount &&
      Number(attemptCount.count) >= assessment.attemptsAllowed
    ) {
      throw new BadRequestException(
        `Maximum attempts (${assessment.attemptsAllowed}) reached`,
      );
    }

    // Get all questions for this assessment
    const assessmentQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId));

    const questionMap = new Map(
      assessmentQuestions.map((q) => [q.id, q]),
    );

    // Auto-grade
    let score = 0;
    let hasManualGrading = false;
    const gradedAnswers: SubmissionAnswer[] = [];

    for (const ans of dto.answers) {
      const question = questionMap.get(ans.questionId);
      if (!question) {
        gradedAnswers.push({
          questionId: ans.questionId,
          answer: ans.answer,
          isCorrect: null,
          marksAwarded: null,
        });
        continue;
      }

      let isCorrect: boolean | null = null;
      let marksAwarded: number | null = null;

      if (question.type === QUESTION_TYPE.MCQ) {
        // MCQ: answer is the option index (0-based)
        const optionIndex = parseInt(ans.answer, 10);
        const opts = (question.options as QuestionOption[]) || [];
        if (
          !isNaN(optionIndex) &&
          optionIndex >= 0 &&
          optionIndex < opts.length
        ) {
          isCorrect = opts[optionIndex].isCorrect === true;
        } else {
          isCorrect = false;
        }
        marksAwarded = isCorrect ? question.marks : 0;
        score += marksAwarded;
      } else if (question.type === QUESTION_TYPE.TRUE_FALSE) {
        // True/false: compare with correctAnswer
        const correctAnswer = (question.correctAnswer || '').toLowerCase().trim();
        const studentAnswer = ans.answer.toLowerCase().trim();
        isCorrect = studentAnswer === correctAnswer;
        marksAwarded = isCorrect ? question.marks : 0;
        score += marksAwarded;
      } else {
        // short_answer / essay — requires manual grading
        isCorrect = null;
        marksAwarded = null;
        hasManualGrading = true;
      }

      gradedAnswers.push({
        questionId: ans.questionId,
        answer: ans.answer,
        isCorrect,
        marksAwarded,
      });
    }

    const totalMarks = assessment.totalMarks;
    const percentage =
      totalMarks > 0
        ? ((score / totalMarks) * 100).toFixed(2)
        : '0.00';

    const submissionStatus = hasManualGrading ? 'submitted' : 'graded';

    const [submission] = await db
      .insert(submissions)
      .values({
        assessmentId,
        studentId: user.id,
        answers: gradedAnswers,
        score,
        totalMarks,
        percentage,
        startedAt: new Date(),
        submittedAt: new Date(),
        status: submissionStatus,
      })
      .returning();

    return submission;
  }

  /**
   * List submissions for an assessment.
   * - Instructor: only for their own courses' assessments.
   * - Admin: any assessment.
   */
  async getSubmissions(assessmentId: string, user: AuthenticatedUser) {
    await this.verifyAssessmentAccess(assessmentId, user);

    const data = await db
      .select({
        id: submissions.id,
        assessmentId: submissions.assessmentId,
        studentId: submissions.studentId,
        score: submissions.score,
        totalMarks: submissions.totalMarks,
        percentage: submissions.percentage,
        startedAt: submissions.startedAt,
        submittedAt: submissions.submittedAt,
        status: submissions.status,
        answers: submissions.answers,
        submissionFiles: submissions.submissionFiles,
        instructorComment: submissions.instructorComment,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(submissions)
      .innerJoin(users, eq(submissions.studentId, users.id))
      .where(eq(submissions.assessmentId, assessmentId))
      .orderBy(desc(submissions.submittedAt));

    return data;
  }

  /**
   * Manual grade a submission — for essay/short_answer questions.
   * Updates individual question grades and recalculates totals.
   */
  async gradeSubmission(
    submissionId: string,
    user: AuthenticatedUser,
    dto: GradeSubmissionDto,
  ) {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Verify access through the assessment
    await this.verifyAssessmentAccess(submission.assessmentId, user);

    // Get current answers
    const currentAnswers = (submission.answers as SubmissionAnswer[]) || [];

    // Build question comments from grade items
    const questionComments: Record<string, string> = (submission.questionComments as Record<string, string>) || {};

    // Apply grades
    for (const grade of dto.grades) {
      const answer = currentAnswers.find(
        (a) => a.questionId === grade.questionId,
      );
      if (answer) {
        answer.marksAwarded = grade.marksAwarded;
        answer.isCorrect = grade.marksAwarded > 0;
      }
      if (grade.comment) {
        questionComments[grade.questionId] = grade.comment;
      }
    }

    // Recalculate score
    const score = currentAnswers.reduce(
      (sum, a) => sum + (a.marksAwarded ?? 0),
      0,
    );
    const totalMarks = submission.totalMarks ?? 0;
    const percentage =
      totalMarks > 0
        ? ((score / totalMarks) * 100).toFixed(2)
        : '0.00';

    // Check if all answers are now graded
    const allGraded = currentAnswers.every(
      (a) => a.marksAwarded !== null && a.marksAwarded !== undefined,
    );
    const newStatus = allGraded ? 'graded' : 'submitted';

    const [updated] = await db
      .update(submissions)
      .set({
        answers: currentAnswers,
        score,
        percentage,
        status: newStatus,
        questionComments,
        instructorComment: dto.overallComment ?? submission.instructorComment,
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    return updated;
  }

  // ─── Assignment File Management ────────────────────────────

  async uploadAssignmentFile(
    assessmentId: string,
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    const assessment = await this.verifyAssessmentAccess(assessmentId, user);

    if (assessment.type !== 'assignment') {
      throw new BadRequestException('File upload is only available for assignments');
    }

    if (!ASSIGNMENT_ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(`File type '${file.mimetype}' is not allowed for assignments`);
    }

    const ext = file.originalname.split('.').pop() || 'bin';
    const storagePath = `assignments/${assessment.courseId}/${assessmentId}/${randomUUID()}.${ext}`;

    const fileUrl = await this.storageService.uploadPublic(
      file.buffer,
      storagePath,
      file.mimetype,
    );

    const newFile: AssessmentFile = {
      id: randomUUID(),
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    const currentFiles = (assessment.assignmentFiles as AssessmentFile[]) || [];
    const updatedFiles = [...currentFiles, newFile];

    await db
      .update(assessments)
      .set({ assignmentFiles: updatedFiles, updatedAt: new Date() })
      .where(eq(assessments.id, assessmentId));

    return newFile;
  }

  async removeAssignmentFile(
    assessmentId: string,
    fileId: string,
    user: AuthenticatedUser,
  ) {
    const assessment = await this.verifyAssessmentAccess(assessmentId, user);

    if (assessment.type !== 'assignment') {
      throw new BadRequestException('File operations are only available for assignments');
    }

    const currentFiles = (assessment.assignmentFiles as AssessmentFile[]) || [];
    const fileToRemove = currentFiles.find((f) => f.id === fileId);

    if (!fileToRemove) {
      throw new NotFoundException('File not found');
    }

    // Delete from storage
    try {
      const storagePath = this.extractStoragePath(fileToRemove.fileUrl);
      if (storagePath) {
        await this.storageService.deleteFile('public', storagePath);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete assignment file from storage: ${fileToRemove.fileUrl}`, err);
    }

    const updatedFiles = currentFiles.filter((f) => f.id !== fileId);

    await db
      .update(assessments)
      .set({ assignmentFiles: updatedFiles, updatedAt: new Date() })
      .where(eq(assessments.id, assessmentId));

    return { message: 'File removed successfully' };
  }

  // ─── Assignment Grading ────────────────────────────────────

  async gradeAssignment(
    submissionId: string,
    user: AuthenticatedUser,
    data: { score: number; comment?: string },
  ) {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const assessment = await this.verifyAssessmentAccess(submission.assessmentId, user);

    if (assessment.type !== 'assignment') {
      throw new BadRequestException('This endpoint is only for assignment grading');
    }

    const totalMarks = assessment.totalMarks;
    if (data.score > totalMarks) {
      throw new BadRequestException(`Score cannot exceed total marks (${totalMarks})`);
    }

    const percentage = totalMarks > 0
      ? ((data.score / totalMarks) * 100).toFixed(2)
      : '0.00';

    const [updated] = await db
      .update(submissions)
      .set({
        score: data.score,
        totalMarks,
        percentage,
        status: 'graded',
        instructorComment: data.comment || null,
      })
      .where(eq(submissions.id, submissionId))
      .returning();

    return updated;
  }

  private extractStoragePath(url: string): string | null {
    try {
      const parsed = new URL(url);
      // Remove leading slash from pathname
      return parsed.pathname.replace(/^\//, '');
    } catch {
      return url;
    }
  }

  // ─── Item Analysis ────────────────────────────────────────

  /**
   * Compute item analysis for an assessment:
   * - Difficulty index = correct_answers / total_attempts (per question)
   * - Discrimination index = top27% correct rate − bottom27% correct rate
   * - Pre/post comparison if multiple assessments exist for same course
   */
  async getItemAnalysis(assessmentId: string, user: AuthenticatedUser) {
    const assessment = await this.verifyAssessmentAccess(
      assessmentId,
      user,
    );

    // Get all graded submissions
    const allSubmissions = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.status, 'graded'),
        ),
      );

    if (allSubmissions.length === 0) {
      return {
        questions: [],
        totalSubmissions: 0,
        prePostComparison: null,
      };
    }

    // Get assessment questions
    const assessmentQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId));

    // Sort submissions by score for discrimination index
    const sortedSubs = [...allSubmissions].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0),
    );
    const n = sortedSubs.length;
    // Need at least 3 submissions for meaningful discrimination (top/bottom groups must not overlap)
    const canComputeDiscrimination = n >= 3;
    const topCount = canComputeDiscrimination ? Math.max(1, Math.ceil(n * 0.27)) : 0;
    const bottomCount = canComputeDiscrimination ? Math.max(1, Math.ceil(n * 0.27)) : 0;
    const topGroup = canComputeDiscrimination ? sortedSubs.slice(0, topCount) : [];
    const bottomGroup = canComputeDiscrimination ? sortedSubs.slice(n - bottomCount) : [];

    // Analyze each question
    const questionAnalysis = assessmentQuestions.map((question) => {
      let totalAttempts = 0;
      let correctAnswers = 0;

      // Difficulty index
      for (const sub of allSubmissions) {
        const answers = (sub.answers as SubmissionAnswer[]) || [];
        const answer = answers.find(
          (a) => a.questionId === question.id,
        );
        if (answer && answer.isCorrect !== null) {
          totalAttempts++;
          if (answer.isCorrect) correctAnswers++;
        }
      }

      const difficultyIndex =
        totalAttempts > 0 ? correctAnswers / totalAttempts : 0;

      // Discrimination index (requires at least 3 submissions to avoid overlap)
      let discriminationIndex = 0;
      if (canComputeDiscrimination) {
        let topCorrect = 0;
        let topTotal = 0;
        for (const sub of topGroup) {
          const answers = (sub.answers as SubmissionAnswer[]) || [];
          const answer = answers.find(
            (a) => a.questionId === question.id,
          );
          if (answer && answer.isCorrect !== null) {
            topTotal++;
            if (answer.isCorrect) topCorrect++;
          }
        }

        let bottomCorrect = 0;
        let bottomTotal = 0;
        for (const sub of bottomGroup) {
          const answers = (sub.answers as SubmissionAnswer[]) || [];
          const answer = answers.find(
            (a) => a.questionId === question.id,
          );
          if (answer && answer.isCorrect !== null) {
            bottomTotal++;
            if (answer.isCorrect) bottomCorrect++;
          }
        }

        const topRate = topTotal > 0 ? topCorrect / topTotal : 0;
        const bottomRate = bottomTotal > 0 ? bottomCorrect / bottomTotal : 0;
        discriminationIndex = topRate - bottomRate;
      }

      return {
        questionId: question.id,
        questionText: question.questionText,
        type: question.type,
        marks: question.marks,
        difficultyIndex: Math.round(difficultyIndex * 100) / 100,
        discriminationIndex:
          Math.round(discriminationIndex * 100) / 100,
        totalAttempts,
        correctAnswers,
      };
    });

    // Pre/post comparison — compare across assessments in the same course
    let prePostComparison: {
      assessmentId: string;
      title: string;
      type: string;
      averagePercentage: number;
      totalSubmissions: number;
    }[] | null = null;

    const courseAssessments = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        type: assessments.type,
        createdAt: assessments.createdAt,
      })
      .from(assessments)
      .where(eq(assessments.courseId, assessment.courseId))
      .orderBy(asc(assessments.createdAt));

    if (courseAssessments.length > 1) {
      const comparisons = [];
      for (const ca of courseAssessments) {
        const [avgResult] = await db
          .select({
            avgPercentage:
              sql<number>`COALESCE(ROUND(AVG(CAST(${submissions.percentage} AS NUMERIC)), 2), 0)`.as(
                'avg_percentage',
              ),
            totalSubmissions: count(),
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.assessmentId, ca.id),
              eq(submissions.status, 'graded'),
            ),
          );

        comparisons.push({
          assessmentId: ca.id,
          title: ca.title,
          type: ca.type,
          averagePercentage: Number(avgResult?.avgPercentage ?? 0),
          totalSubmissions: Number(avgResult?.totalSubmissions ?? 0),
        });
      }
      prePostComparison = comparisons;
    }

    return {
      questions: questionAnalysis,
      totalSubmissions: allSubmissions.length,
      prePostComparison,
    };
  }

  /**
   * Blueprint coverage: modules × assessments matrix for a course.
   * Shows which modules have assessment coverage and identifies gaps.
   */
  async getBlueprint(courseId: string, user: AuthenticatedUser) {
    await this.verifyCourseAccess(courseId, user);

    const { courseModules } = await import('../../database/schema');

    // Get all modules for the course
    const modules = await db
      .select({
        id: courseModules.id,
        title: courseModules.title,
        orderIndex: courseModules.orderIndex,
      })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex));

    // Get all assessments for the course
    const courseAssessments = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        type: assessments.type,
        moduleId: assessments.moduleId,
        totalMarks: assessments.totalMarks,
        status: assessments.status,
      })
      .from(assessments)
      .where(eq(assessments.courseId, courseId));

    // Get question counts per assessment
    const questionCounts = await db
      .select({
        assessmentId: questions.assessmentId,
        count: count(),
      })
      .from(questions)
      .where(eq(questions.courseId, courseId))
      .groupBy(questions.assessmentId);

    const qCountMap = new Map<string, number>();
    for (const qc of questionCounts) {
      if (qc.assessmentId) qCountMap.set(qc.assessmentId, Number(qc.count));
    }

    // Build matrix: each module → which assessments cover it
    const matrix = modules.map((mod) => {
      const linked = courseAssessments
        .filter((a) => a.moduleId === mod.id)
        .map((a) => ({
          assessmentId: a.id,
          title: a.title,
          type: a.type,
          status: a.status,
          totalMarks: a.totalMarks,
          questionCount: qCountMap.get(a.id) || 0,
        }));

      return {
        moduleId: mod.id,
        moduleTitle: mod.title,
        orderIndex: mod.orderIndex,
        covered: linked.length > 0,
        assessments: linked,
      };
    });

    // Assessments not linked to any module
    const unlinked = courseAssessments
      .filter((a) => !a.moduleId)
      .map((a) => ({
        assessmentId: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        totalMarks: a.totalMarks,
        questionCount: qCountMap.get(a.id) || 0,
      }));

    const coveredCount = matrix.filter((m) => m.covered).length;

    return {
      courseId,
      totalModules: modules.length,
      coveredModules: coveredCount,
      gapModules: modules.length - coveredCount,
      coveragePercent: modules.length > 0 ? Math.round((coveredCount / modules.length) * 100) : 100,
      matrix,
      unlinkedAssessments: unlinked,
    };
  }

  // ─── Difficulty Distribution ─────────────────────────────

  /**
   * GET /assessments/:id/difficulty-distribution
   * Returns easy/medium/hard/unset counts for questions in the assessment.
   */
  async getDifficultyDistribution(assessmentId: string, user: AuthenticatedUser) {
    await this.verifyAssessmentAccess(assessmentId, user);

    const distRows = await db
      .select({
        difficulty: questions.difficultyLevel,
        count: count(),
      })
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId))
      .groupBy(questions.difficultyLevel);

    const distribution = { easy: 0, medium: 0, hard: 0, unset: 0, total: 0 };
    for (const row of distRows) {
      const cnt = Number(row.count);
      distribution.total += cnt;
      if (row.difficulty === 'easy') distribution.easy += cnt;
      else if (row.difficulty === 'medium') distribution.medium += cnt;
      else if (row.difficulty === 'hard') distribution.hard += cnt;
      else distribution.unset += cnt;
    }

    return distribution;
  }

  // ─── Assessment Flagging ───────────────────────────────────

  /**
   * POST /assessments/:id/flag
   * Flag an assessment for review (MANAGER/ADMIN only).
   */
  async flagAssessment(assessmentId: string, user: AuthenticatedUser, reason: string) {
    await this.verifyAssessmentAccess(assessmentId, user);

    const [updated] = await db
      .update(assessments)
      .set({
        flaggedAt: new Date(),
        flaggedReason: reason,
        flaggedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(assessments.id, assessmentId))
      .returning();

    return updated;
  }

  // ─── Emergency Overrides ─────────────────────────────────

  /**
   * Grant an emergency override (time extension or extra attempts) for a student.
   */
  async createOverride(
    assessmentId: string,
    user: AuthenticatedUser,
    data: { studentId: string; overrideType: string; value: number; reason: string; expiresAt?: string },
  ) {
    await this.verifyAssessmentAccess(assessmentId, user);

    const [override] = await db
      .insert(assessmentOverrides)
      .values({
        assessmentId,
        studentId: data.studentId,
        overrideType: data.overrideType,
        value: data.value,
        reason: data.reason,
        grantedBy: user.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      })
      .returning();

    return override;
  }

  /**
   * List all overrides for an assessment, with student and granter names.
   */
  async getOverrides(assessmentId: string, user: AuthenticatedUser) {
    await this.verifyAssessmentAccess(assessmentId, user);

    const studentUsers = aliasedTable(users, 'student_users');
    const granterUsers = aliasedTable(users, 'granter_users');

    const data = await db
      .select({
        id: assessmentOverrides.id,
        assessmentId: assessmentOverrides.assessmentId,
        studentId: assessmentOverrides.studentId,
        overrideType: assessmentOverrides.overrideType,
        value: assessmentOverrides.value,
        reason: assessmentOverrides.reason,
        grantedBy: assessmentOverrides.grantedBy,
        expiresAt: assessmentOverrides.expiresAt,
        createdAt: assessmentOverrides.createdAt,
        studentFirstName: studentUsers.firstName,
        studentLastName: studentUsers.lastName,
        granterFirstName: granterUsers.firstName,
        granterLastName: granterUsers.lastName,
      })
      .from(assessmentOverrides)
      .innerJoin(studentUsers, eq(assessmentOverrides.studentId, studentUsers.id))
      .innerJoin(granterUsers, eq(assessmentOverrides.grantedBy, granterUsers.id))
      .where(eq(assessmentOverrides.assessmentId, assessmentId))
      .orderBy(desc(assessmentOverrides.createdAt));

    return data;
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Get course IDs for an instructor.
   */
  private async getInstructorCourseIds(
    instructorId: string,
  ): Promise<string[]> {
    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.instructorId, instructorId));
    return instructorCourses.map((c) => c.id);
  }

  /**
   * Verify the user can access the course.
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const conditions = [eq(courses.id, courseId)];
    if (!this.isAdmin(user)) {
      conditions.push(eq(courses.instructorId, user.id));
    }

    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  /**
   * Verify the user can access the assessment.
   * Returns the full assessment row.
   */
  private async verifyAssessmentAccess(
    assessmentId: string,
    user: AuthenticatedUser,
  ) {
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Verify course access
    if (!this.isAdmin(user)) {
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(
          and(
            eq(courses.id, assessment.courseId),
            eq(courses.instructorId, user.id),
          ),
        )
        .limit(1);

      if (!course) {
        throw new NotFoundException('Assessment not found');
      }
    }

    return assessment;
  }

  /**
   * Verify the user can access a question.
   * Access is through the question's courseId → instructor chain.
   */
  private async verifyQuestionAccess(
    questionId: string,
    user: AuthenticatedUser,
  ) {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Verify course access
    if (!this.isAdmin(user)) {
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(
          and(
            eq(courses.id, question.courseId),
            eq(courses.instructorId, user.id),
          ),
        )
        .limit(1);

      if (!course) {
        throw new NotFoundException('Question not found');
      }
    }

    return question;
  }
}
