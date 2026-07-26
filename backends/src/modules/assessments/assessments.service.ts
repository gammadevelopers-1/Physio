import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, isNull, inArray, aliasedTable, or } from 'drizzle-orm';
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
  courseAssistants,
  sessionAssistants,
  sessions,
  ASSESSMENT_STATUS,
  QUESTION_TYPE,
  QuestionOption,
  SubmissionAnswer,
} from '../../database/schema';
import type { AssessmentFile } from '../../database/schema/assessments';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager, isTA } from '../../common/role-helpers';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { XapiService } from '../xapi/xapi.service';
import { toArabicIndic } from '../../common/platform-locale';
import { assessmentRetakeGrants } from '../../database/schema/assessment-retake-grants';
import { sanitizeRichText } from '../../common/sanitize-html';
import type { EmailLocale } from '../email/email-i18n';
import {
  computeEffectiveScoresByGroup,
  type AttemptForPolicy,
} from '../../common/score-policy';

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
    private readonly emailService: EmailService,
    private readonly adminSettings: AdminSettingsService,
    private readonly xapiService: XapiService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private addCourseOwnershipCondition(
    conditions: any[],
    user: AuthenticatedUser,
  ): void {
    if (isGlobalAdmin(user)) {
      // No filter
    } else if (isManager(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    } else {
      conditions.push(eq(courses.instructorId, user.id));
    }
  }

  // ─── Assessment CRUD ──────────────────────────────────────

  /**
   * Create a new assessment.
   * - Instructor: verifies course belongs to them.
   * - Admin: can create for any course.
   */
  async create(user: AuthenticatedUser, dto: CreateAssessmentDto) {
    await this.verifyCourseAccess(dto.courseId, user);

    // Inherit course-level assessment defaults at creation time
    const [course] = await db
      .select({
        deliveryType: courses.deliveryType,
        assessmentTimeLimitEnforced: courses.assessmentTimeLimitEnforced,
        assessmentMaxRetakes: courses.assessmentMaxRetakes,
        assessmentRetakeCoolingHours: courses.assessmentRetakeCoolingHours,
        assessmentRetakeScorePolicy: courses.assessmentRetakeScorePolicy,
        assessmentRetakeScope: courses.assessmentRetakeScope,
      })
      .from(courses)
      .where(eq(courses.id, dto.courseId))
      .limit(1);

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
        randomizeOrder: dto.type === 'quiz' || dto.type === 'exam' ? true : (dto.randomizeOrder ?? false),
        // Inherit course defaults so the manager's policy applies to new assessments
        timeLimitEnforced: course?.assessmentTimeLimitEnforced ?? true,
        maxRetakes: course?.assessmentMaxRetakes ?? 0,
        retakeCoolingHours: course?.assessmentRetakeCoolingHours ?? 24,
        retakeScorePolicy: course?.assessmentRetakeScorePolicy ?? 'highest',
        retakeScope: course?.assessmentRetakeScope ?? 'full',
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

    // Scope by role
    if (!isGlobalAdmin(user)) {
      let scopedCourseIds: string[];
      if (isManager(user)) {
        scopedCourseIds = await this.getManagedCourseIds(user.id);
      } else if (isTA(user)) {
        scopedCourseIds = await this.getTACourseIds(user.id);
      } else {
        scopedCourseIds = await this.getInstructorCourseIds(user.id);
      }
      if (scopedCourseIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      conditions.push(
        sql`${assessments.courseId} IN (${sql.join(
          scopedCourseIds.map((id) => sql`${id}`),
          sql`, `,
        )})` as any,
      );
      // TAs should only see published/closed assessments (not drafts)
      if (isTA(user)) {
        conditions.push(sql`${assessments.status} != 'draft'` as any);
      }
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
      // Count unique students who have at least one submission (not total
      // rows, which includes retakes). This drives the "Submissions" KPI.
      const subCounts = await db
        .select({
          assessmentId: submissions.assessmentId,
          cnt: sql<number>`COUNT(DISTINCT ${submissions.studentId})`,
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

    // Count DISTINCT students who have submitted so the drawer's
    // Submissions KPI is accurate. Historically the list endpoint
    // computed this but findOne skipped it, so the preview always
    // said "0" even when submissions existed.
    const [subCountRow] = await db
      .select({
        cnt: sql<number>`COUNT(DISTINCT ${submissions.studentId})`,
      })
      .from(submissions)
      .where(eq(submissions.assessmentId, assessmentId));
    const submissionCount = Number(subCountRow?.cnt || 0);

    return { ...assessment, questions: assessmentQuestions, submissionCount };
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
        // Quiz/exam need ≥1 question and marks must match totalMarks
        const assessmentQuestions = await db
          .select({ marks: questions.marks })
          .from(questions)
          .where(eq(questions.assessmentId, assessmentId));

        if (assessmentQuestions.length === 0) {
          throw new BadRequestException(
            'Cannot publish an assessment with no questions. Add at least one question first.',
          );
        }

        const effectiveTotalMarks = dto.totalMarks ?? existing.totalMarks;
        const sumMarks = assessmentQuestions.reduce((s, q) => s + (q.marks ?? 1), 0);
        if (sumMarks !== effectiveTotalMarks) {
          throw new BadRequestException(
            `Total question marks (${sumMarks}) must equal the assessment total marks (${effectiveTotalMarks}). Adjust your questions or update the total marks.`,
          );
        }

        // If questionsPerAttempt is set, all questions must have equal marks
        const effectiveQPA = existing.questionsPerAttempt;
        if (effectiveQPA && effectiveQPA > 0 && effectiveQPA < assessmentQuestions.length) {
          const markValues = new Set(assessmentQuestions.map((q) => q.marks ?? 1));
          if (markValues.size > 1) {
            throw new BadRequestException(
              'When using randomized question selection, all questions must have equal marks to ensure fairness.',
            );
          }
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

          // Group recipients by locale for bilingual notification
          const studentLocales = await db
            .select({ id: users.id, language: users.language })
            .from(users)
            .where(inArray(users.id, studentIds));

          const arIds: string[] = [];
          const enIds: string[] = [];
          for (const s of studentLocales) {
            if ((s.language || 'en') === 'ar') arIds.push(s.id);
            else enIds.push(s.id);
          }

          const typeArabicMap: Record<string, string> = {
            quiz: 'اختبار',
            exam: 'امتحان',
            assignment: 'واجب',
          };
          const typeAr = typeArabicMap[updated.type] || updated.type;

          if (enIds.length > 0) {
            await this.userNotificationsService.createBulk(enIds, {
              type: 'assessment_published',
              title: 'New Assessment Published',
              message: `A new ${updated.type} "${updated.title}" has been published for ${courseName}.`,
              link: `/dashboard/student/courses/${updated.courseId}`,
              entityType: 'assessment',
              entityId: updated.id,
            });
          }
          if (arIds.length > 0) {
            await this.userNotificationsService.createBulk(arIds, {
              type: 'assessment_published',
              title: 'تم نشر تقييم جديد',
              message: `تم نشر ${typeAr} جديد "${updated.title}" لدورة ${courseName}.`,
              link: `/dashboard/student/courses/${updated.courseId}`,
              entityType: 'assessment',
              entityId: updated.id,
            });
          }
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

    // Validate adding this question won't exceed totalMarks
    const questionMarks = dto.marks ?? 1;
    await this.validateQuestionMarks(assessmentId, assessment.totalMarks, questionMarks, null);

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
    await this.verifyCourseAccess(courseId, user, { allowCompleted: true });

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
    const question = await this.verifyQuestionAccess(questionId, user);

    // If marks are being changed, validate against assessment totalMarks
    if (dto.marks !== undefined && question.assessmentId) {
      const [assessment] = await db
        .select({ totalMarks: assessments.totalMarks })
        .from(assessments)
        .where(eq(assessments.id, question.assessmentId))
        .limit(1);

      if (assessment) {
        await this.validateQuestionMarks(
          question.assessmentId,
          assessment.totalMarks,
          dto.marks,
          questionId,
        );
      }
    }

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

      // Essay / short-answer responses come from a rich-text editor and
      // are stored as HTML. Sanitize before persisting so the grading
      // view (and any future surface that renders student answers) can
      // safely inject the markup without an XSS risk. MCQ/TF answers
      // are numbers/words — pass through unchanged.
      const isRichTextAnswer =
        question?.type === QUESTION_TYPE.ESSAY ||
        question?.type === QUESTION_TYPE.SHORT_ANSWER;
      const storedAnswer = isRichTextAnswer
        ? sanitizeRichText(ans.answer) ?? ''
        : ans.answer;

      gradedAnswers.push({
        questionId: ans.questionId,
        answer: storedAnswer,
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

    // NELC xAPI — emit attempted with sequential attempt-id +
    // passingMarks-as-min (NELC checklist 1.6 + 5.2). Manual-grading
    // assessments report passed=false here; the grade event will
    // re-emit with the final pass/fail.
    const passed =
      assessment.passingMarks > 0 && score >= assessment.passingMarks;
    void this.xapiService.emitAssessmentSubmitted(
      user.id,
      assessmentId,
      score,
      assessment.passingMarks,
      totalMarks,
      passed,
    );

    return submission;
  }

  /**
   * Lazy backfill for expired assessments. Idempotent.
   * - Assignment past dueDate (with timeLimitEnforced): every enrolled student who
   *   hasn't submitted gets a real graded row with score=0. Existing in_progress
   *   drafts are also marked as 0 (missed deadline).
   * - Quiz/exam in_progress drafts past startedAt+durationMinutes: auto-graded
   *   using whatever answers were saved, marked as submitted/graded.
   * Called from getSubmissions so the manager always sees the truth on read.
   * NOTE: a nightly cron version of this is intentionally deferred — see
   * memory/feedback_assessment_expiry_lazy_on_read.md.
   */
  private async backfillExpiredSubmissions(assessmentId: string): Promise<void> {
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment || !assessment.timeLimitEnforced) return;

    const now = new Date();

    // ─── Assignment branch ─────────────────────────────────
    if (assessment.type === 'assignment') {
      if (!assessment.dueDate || now <= new Date(assessment.dueDate)) return;

      // Consume any unused retake grants whose effective deadline has passed.
      // This covers the case where the manager granted a retake but the
      // student never opened the assignment — the grant should not block
      // future retake grants forever.
      const expiredGrants = await db
        .select({
          id: assessmentRetakeGrants.id,
          newDueDate: assessmentRetakeGrants.newDueDate,
        })
        .from(assessmentRetakeGrants)
        .where(
          and(
            eq(assessmentRetakeGrants.assessmentId, assessmentId),
            sql`${assessmentRetakeGrants.usedAt} IS NULL`,
          ),
        );
      for (const g of expiredGrants) {
        const effectiveDue = g.newDueDate
          ? new Date(g.newDueDate)
          : new Date(assessment.dueDate);
        if (now > effectiveDue) {
          await db
            .update(assessmentRetakeGrants)
            .set({ usedAt: now })
            .where(eq(assessmentRetakeGrants.id, g.id));
        }
      }

      const enrolledStudents = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, assessment.courseId),
            sql`${enrollments.status} IN ('active', 'completed')`,
          ),
        );
      if (enrolledStudents.length === 0) return;

      const existingSubs = await db
        .select({
          id: submissions.id,
          studentId: submissions.studentId,
          status: submissions.status,
        })
        .from(submissions)
        .where(eq(submissions.assessmentId, assessmentId));
      const existingByStudent = new Map(
        existingSubs.map((s) => [s.studentId, s]),
      );

      const totalMarks = assessment.totalMarks;
      const missedComment = 'Auto-graded: not submitted by deadline';

      for (const { studentId } of enrolledStudents) {
        const existing = existingByStudent.get(studentId);
        if (!existing) {
          // Never opened the assignment — create a real 0-mark row
          await db.insert(submissions).values({
            assessmentId,
            studentId,
            answers: [],
            score: 0,
            totalMarks,
            percentage: '0',
            startedAt: null,
            submittedAt: null,
            status: 'graded',
            instructorComment: missedComment,
          });
        } else if (existing.status === 'in_progress') {
          // Started a draft but never submitted — mark as missed
          await db
            .update(submissions)
            .set({
              score: 0,
              totalMarks,
              percentage: '0',
              submittedAt: null,
              status: 'graded',
              instructorComment: missedComment,
            })
            .where(eq(submissions.id, existing.id));
        }
        // else: already submitted/graded — leave alone
      }
      return;
    }

    // ─── Quiz/Exam branch ──────────────────────────────────
    if (assessment.type !== 'quiz' && assessment.type !== 'exam') return;
    if (!assessment.durationMinutes) return;

    const staleDrafts = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.status, 'in_progress'),
        ),
      );
    if (staleDrafts.length === 0) return;

    const allowedMs = assessment.durationMinutes * 60 * 1000;
    const expiredDrafts = staleDrafts.filter(
      (d) => d.startedAt && now.getTime() - new Date(d.startedAt).getTime() > allowedMs,
    );
    if (expiredDrafts.length === 0) return;

    const assessmentQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId));
    const questionMap = new Map(assessmentQuestions.map((q) => [q.id, q]));
    // Total possible marks across the whole assessment (not just answered ones)
    const fullTotalMarks = assessmentQuestions.reduce((sum, q) => sum + q.marks, 0);

    for (const draft of expiredDrafts) {
      const draftAnswers = (draft.answers as SubmissionAnswer[]) || [];
      let totalScore = 0;

      const gradedAnswers: SubmissionAnswer[] = draftAnswers.map((a) => {
        const q = questionMap.get(a.questionId);
        if (!q) {
          return { questionId: a.questionId, answer: a.answer, isCorrect: null, marksAwarded: 0 };
        }

        if (q.type === 'mcq' || q.type === 'true_false') {
          let isCorrect = false;
          if (q.options && Array.isArray(q.options)) {
            const correctOptions = (q.options as QuestionOption[]).filter((opt) => opt.isCorrect);
            if (q.type === 'mcq' && correctOptions.length > 1) {
              try {
                const selected: string[] = JSON.parse(a.answer);
                const correctTexts = correctOptions.map((o) => o.text);
                isCorrect =
                  selected.length === correctTexts.length &&
                  selected.every((s) => correctTexts.includes(s));
              } catch {
                isCorrect = false;
              }
            } else {
              const selectedOption = (q.options as QuestionOption[]).find((opt) => opt.text === a.answer);
              isCorrect = selectedOption?.isCorrect === true;
            }
          } else if (q.correctAnswer) {
            isCorrect =
              a.answer.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
          }
          if (isCorrect) totalScore += q.marks;
          return {
            questionId: a.questionId,
            answer: a.answer,
            isCorrect,
            marksAwarded: isCorrect ? q.marks : 0,
          };
        }
        // Essay/short_answer — needs manual grading
        return { questionId: a.questionId, answer: a.answer, isCorrect: null, marksAwarded: null };
      });

      const hasManualGrading = gradedAnswers.some((a) => a.isCorrect === null);
      const percentage =
        fullTotalMarks > 0 ? ((totalScore / fullTotalMarks) * 100).toFixed(2) : '0';

      await db
        .update(submissions)
        .set({
          answers: gradedAnswers,
          score: totalScore,
          totalMarks: fullTotalMarks,
          percentage,
          submittedAt: now,
          status: hasManualGrading ? 'submitted' : 'graded',
          instructorComment: 'Auto-submitted: time expired',
        })
        .where(eq(submissions.id, draft.id));

      // If this expired draft was a retake (the student already had a graded
      // submission before this draft was created), consume the most recent
      // unused grant so the manager can issue a new one if they want to.
      const [priorTerminal] = await db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.assessmentId, assessmentId),
            eq(submissions.studentId, draft.studentId),
            eq(submissions.status, 'graded'),
            sql`${submissions.id} != ${draft.id}`,
            sql`${submissions.submittedAt} IS NOT NULL`,
            sql`${submissions.submittedAt} < ${draft.startedAt}`,
          ),
        )
        .limit(1);
      if (priorTerminal) {
        const [grantToConsume] = await db
          .select({ id: assessmentRetakeGrants.id })
          .from(assessmentRetakeGrants)
          .where(
            and(
              eq(assessmentRetakeGrants.assessmentId, assessmentId),
              eq(assessmentRetakeGrants.studentId, draft.studentId),
              sql`${assessmentRetakeGrants.usedAt} IS NULL`,
            ),
          )
          .orderBy(desc(assessmentRetakeGrants.createdAt))
          .limit(1);
        if (grantToConsume) {
          await db
            .update(assessmentRetakeGrants)
            .set({ usedAt: now })
            .where(eq(assessmentRetakeGrants.id, grantToConsume.id));
        }
      }
    }
  }

  /**
   * List submissions for an assessment.
   * - Instructor: only for their own courses' assessments.
   * - Admin: any assessment.
   */
  async getSubmissions(assessmentId: string, user: AuthenticatedUser) {
    const assessment = await this.verifyAssessmentAccess(assessmentId, user);

    // Lazy backfill: finalize expired drafts and create auto-zero rows for
    // missed assignments. Idempotent and safe to call on every read.
    await this.backfillExpiredSubmissions(assessmentId);

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
        createdAt: submissions.createdAt,
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
      // Order by student then chronological so we can number attempts
      .orderBy(asc(submissions.studentId), asc(submissions.createdAt));

    // ─── Annotate attempt numbers ──────────────────────────
    // For each (student) bucket, number rows starting at 1. The total per
    // student is also attached so the UI can render "Attempt X of Y".
    const perStudentTotal = new Map<string, number>();
    for (const row of data) {
      perStudentTotal.set(row.studentId, (perStudentTotal.get(row.studentId) || 0) + 1);
    }

    // Look up which students have an unused retake grant pending so the
    // frontend can disable the "Allow Retake" button (one outstanding retake
    // at a time per student).
    const pendingGrants = await db
      .select({ studentId: assessmentRetakeGrants.studentId })
      .from(assessmentRetakeGrants)
      .where(
        and(
          eq(assessmentRetakeGrants.assessmentId, assessmentId),
          sql`${assessmentRetakeGrants.usedAt} IS NULL`,
        ),
      );
    const studentsWithPendingGrant = new Set(pendingGrants.map((g) => g.studentId));

    const perStudentSeen = new Map<string, number>();
    type AnnotatedRow = (typeof data)[number] & {
      attemptNumber: number;
      totalAttempts: number;
      isEffective: boolean;
      hasUnusedRetakeGrant: boolean;
    };
    const annotated: AnnotatedRow[] = data.map((row) => {
      const idx = (perStudentSeen.get(row.studentId) || 0) + 1;
      perStudentSeen.set(row.studentId, idx);
      return {
        ...row,
        attemptNumber: idx,
        totalAttempts: perStudentTotal.get(row.studentId) || 1,
        isEffective: false,
        hasUnusedRetakeGrant: studentsWithPendingGrant.has(row.studentId),
      };
    });

    // ─── Apply score policy to mark the "effective" attempt ─
    // For 'highest' / 'latest' the effective row is the one whose score the
    // gradebook should use. For 'average' no single row wins; the UI should
    // compute the average separately if it wants to display it.
    const policy = assessment.retakeScorePolicy || 'highest';
    const attemptsForPolicy: (AttemptForPolicy & { studentId: string })[] = annotated.map((r) => ({
      id: r.id,
      score: r.score,
      orderedAt: r.submittedAt || r.createdAt,
      studentId: r.studentId,
    }));
    const effectiveByStudent = computeEffectiveScoresByGroup(
      attemptsForPolicy,
      (a) => a.studentId,
      policy,
    );
    for (const row of annotated) {
      const eff = effectiveByStudent.get(row.studentId);
      if (eff?.effectiveAttempt && eff.effectiveAttempt.id === row.id) {
        row.isEffective = true;
      }
    }

    // For TAs: strip scores/grades unless assessment is closed (results published)
    if (user.roles.includes('TEACHING_ASSISTANT') && !isGlobalAdmin(user)) {
      const gradesPublished = assessment.status === 'closed';
      return annotated.map((row) => ({
        ...row,
        score: gradesPublished ? row.score : null,
        totalMarks: gradesPublished ? row.totalMarks : null,
        percentage: gradesPublished ? row.percentage : null,
        instructorComment: gradesPublished ? row.instructorComment : null,
      }));
    }

    return annotated;
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
    await this.verifyCourseAccess(courseId, user, { allowCompleted: true });

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
   * Grant an emergency override (currently only time_extension is enforced).
   * Fires student email + in-app and instructor in-app notifications when the
   * grant is created.
   */
  async createOverride(
    assessmentId: string,
    user: AuthenticatedUser,
    data: { studentId: string; overrideType: string; value: number; reason: string; expiresAt?: string },
  ) {
    const assessment = await this.verifyAssessmentAccess(assessmentId, user);

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

    // Fire notifications for time extensions (the only override type the
    // system actually enforces). Best-effort — failures are logged.
    if (data.overrideType === 'time_extension') {
      this.notifyTimeExtensionGranted(
        assessment,
        data.studentId,
        user.id,
        data.value,
        data.reason || null,
      ).catch((err) =>
        this.logger.warn(`Failed to send time extension notifications: ${err.message}`),
      );
    }

    return override;
  }

  /**
   * Sends time-extension notifications:
   * - Student: in-app + email (en/ar based on user.language)
   * - Instructor: in-app only (en/ar based on user.language)
   */
  private async notifyTimeExtensionGranted(
    assessment: { id: string; title: string; courseId: string; type: string },
    studentId: string,
    managerId: string,
    minutes: number,
    reason: string | null,
  ): Promise<void> {
    const [studentRow, managerRow, courseRow] = await Promise.all([
      db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          language: users.language,
        })
        .from(users)
        .where(eq(users.id, studentId))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({
          title: courses.title,
          titleAr: courses.titleAr,
          instructorId: courses.instructorId,
        })
        .from(courses)
        .where(eq(courses.id, assessment.courseId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    if (!studentRow || !courseRow) return;

    const studentName =
      `${studentRow.firstName || ''} ${studentRow.lastName || ''}`.trim() || 'Student';
    const managerName = managerRow
      ? `${managerRow.firstName || ''} ${managerRow.lastName || ''}`.trim() || 'Manager'
      : 'Manager';

    const studentIsAr = studentRow.language === 'ar';
    const studentLocale: EmailLocale = studentIsAr ? 'ar' : 'en';
    const courseName = (studentIsAr && courseRow.titleAr) || courseRow.title;

    // ── In-app: student ────────────────────────────────────
    await this.userNotificationsService.create({
      recipientId: studentId,
      type: 'time_extension_granted',
      title: studentIsAr ? 'تم منحك وقتاً إضافياً' : 'Extra Time Granted',
      message: studentIsAr
        ? `منحك مدير الدورة ${minutes} دقيقة إضافية لـ "${assessment.title}"`
        : `Your course manager has granted you ${minutes} extra minutes for "${assessment.title}"`,
      link: `/dashboard/student/assessments/${assessment.id}`,
      entityType: 'assessment',
      entityId: assessment.id,
    });

    // ── Email: student ─────────────────────────────────────
    if (studentRow.email) {
      await this.emailService.sendTimeExtensionGranted(
        studentRow.email,
        {
          studentName,
          assessmentTitle: assessment.title,
          courseName,
          minutes,
          reason,
        },
        studentLocale,
      );
    }

    // ── In-app: instructor ─────────────────────────────────
    if (courseRow.instructorId) {
      const [instructorRow] = await db
        .select({ language: users.language })
        .from(users)
        .where(eq(users.id, courseRow.instructorId))
        .limit(1);
      const instrIsAr = instructorRow?.language === 'ar';

      await this.userNotificationsService.create({
        recipientId: courseRow.instructorId,
        type: 'time_extension_granted_by_manager',
        title: instrIsAr ? 'تم منح وقت إضافي' : 'Extra Time Granted',
        message: instrIsAr
          ? `منح ${managerName} الطالب ${studentName} ${minutes} دقيقة إضافية لـ "${assessment.title}"`
          : `${managerName} granted ${studentName} ${minutes} extra minutes for "${assessment.title}"`,
        link: `/dashboard/instructor/assessments`,
        entityType: 'assessment',
        entityId: assessment.id,
      });
    }
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

  /**
   * Manager grants a student a retake on this assessment.
   * - Requires manager role (enforced at controller).
   * - The student must already have a graded submission (or an auto-zero
   *   "not submitted" row) — i.e. the first attempt has run its course.
   * - Inserts a row in `assessment_retake_grants` which `getAssessmentForStudent`
   *   uses to unlock another attempt.
   * - For assignments, an optional `newDueDate` is stored on the grant and
   *   used as the per-student deadline.
   * - Fires email + in-app notification to the student, plus an in-app
   *   notification to the course instructor.
   */
  async allowRetake(
    assessmentId: string,
    user: AuthenticatedUser,
    data: { studentId: string; reason?: string; newDueDate?: string },
  ) {
    const assessment = await this.verifyAssessmentAccess(assessmentId, user);

    // The student must have at least one terminal submission (graded) before
    // a retake can be granted. This includes auto-zero "not submitted" rows,
    // since those are also stored as status='graded'.
    const [existing] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, data.studentId),
          eq(submissions.status, 'graded'),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new BadRequestException(
        'A retake can only be granted after the first attempt has been graded.',
      );
    }

    // Block duplicate grants: only one outstanding retake at a time per student.
    // The manager must wait for the student to actually submit (or for the
    // backfill to expire the abandoned attempt) before granting another.
    const [pendingGrant] = await db
      .select({ id: assessmentRetakeGrants.id })
      .from(assessmentRetakeGrants)
      .where(
        and(
          eq(assessmentRetakeGrants.assessmentId, assessmentId),
          eq(assessmentRetakeGrants.studentId, data.studentId),
          sql`${assessmentRetakeGrants.usedAt} IS NULL`,
        ),
      )
      .limit(1);
    if (pendingGrant) {
      throw new BadRequestException(
        'This student already has an unused retake. Wait until the new attempt is graded before granting another retake.',
      );
    }

    // Insert the retake grant row.
    const newDueDate =
      assessment.type === 'assignment' && data.newDueDate
        ? new Date(data.newDueDate)
        : null;

    const [grant] = await db
      .insert(assessmentRetakeGrants)
      .values({
        assessmentId,
        studentId: data.studentId,
        grantedBy: user.id,
        reason: data.reason || null,
        newDueDate,
      })
      .returning();

    // Fire notifications (best-effort — failures are logged, not propagated).
    this.notifyRetakeGranted(assessment, data.studentId, user.id, data.reason || null, newDueDate)
      .catch((err) => this.logger.warn(`Failed to send retake notifications: ${err.message}`));

    return grant;
  }

  /**
   * Sends the two retake-granted notifications:
   * - Student: in-app + email (en/ar based on user.language)
   * - Instructor: in-app only (en/ar based on user.language)
   */
  private async notifyRetakeGranted(
    assessment: { id: string; title: string; courseId: string; type: string },
    studentId: string,
    managerId: string,
    reason: string | null,
    newDueDate: Date | null,
  ): Promise<void> {
    // Look up student, manager, and course in parallel
    const [studentRow, managerRow, courseRow] = await Promise.all([
      db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          language: users.language,
        })
        .from(users)
        .where(eq(users.id, studentId))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select({
          title: courses.title,
          titleAr: courses.titleAr,
          instructorId: courses.instructorId,
        })
        .from(courses)
        .where(eq(courses.id, assessment.courseId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    if (!studentRow || !courseRow) return;

    const studentName =
      `${studentRow.firstName || ''} ${studentRow.lastName || ''}`.trim() || 'Student';
    const managerName = managerRow
      ? `${managerRow.firstName || ''} ${managerRow.lastName || ''}`.trim() || 'Manager'
      : 'Manager';

    const studentIsAr = studentRow.language === 'ar';
    const studentLocale: EmailLocale = studentIsAr ? 'ar' : 'en';
    const courseName = (studentIsAr && courseRow.titleAr) || courseRow.title;

    // ── In-app: student ────────────────────────────────────
    await this.userNotificationsService.create({
      recipientId: studentId,
      type: 'retake_granted',
      title: studentIsAr ? 'تم منحك فرصة إعادة التقييم' : 'Retake Granted',
      message: studentIsAr
        ? `منحك مدير الدورة فرصة لإعادة "${assessment.title}"`
        : `Your course manager has granted you a retake for "${assessment.title}"`,
      link: `/dashboard/student/assessments/${assessment.id}`,
      entityType: 'assessment',
      entityId: assessment.id,
    });

    // ── Email: student ─────────────────────────────────────
    if (studentRow.email) {
      const localeSettings = await this.adminSettings.getPublicLocaleSettings().catch(() => ({
        numberSystem: 'western' as const,
        dateFormat: 'DD-MM-YYYY' as const,
      }));
      let newDueDateStr = newDueDate
        ? newDueDate.toLocaleString(studentIsAr ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : null;
      if (newDueDateStr && localeSettings.numberSystem === 'arabic_indic') {
        newDueDateStr = toArabicIndic(newDueDateStr);
      }
      await this.emailService.sendRetakeGranted(
        studentRow.email,
        {
          studentName,
          assessmentTitle: assessment.title,
          courseName,
          reason,
          newDueDate: newDueDateStr,
        },
        studentLocale,
      );
    }

    // ── In-app: instructor ─────────────────────────────────
    if (courseRow.instructorId) {
      const [instructorRow] = await db
        .select({ language: users.language })
        .from(users)
        .where(eq(users.id, courseRow.instructorId))
        .limit(1);
      const instrIsAr = instructorRow?.language === 'ar';

      await this.userNotificationsService.create({
        recipientId: courseRow.instructorId,
        type: 'retake_allowed',
        title: instrIsAr ? 'تم السماح بإعادة التقييم' : 'Retake Allowed',
        message: instrIsAr
          ? `سمح ${managerName} لـ ${studentName} بإعادة "${assessment.title}"`
          : `${managerName} allowed ${studentName} to retake "${assessment.title}"`,
        link: `/dashboard/instructor/assessments`,
        entityType: 'assessment',
        entityId: assessment.id,
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Validate that adding/updating a question's marks won't exceed assessment totalMarks.
   * @param excludeQuestionId — the question being updated (exclude from sum)
   */
  private async validateQuestionMarks(
    assessmentId: string,
    assessmentTotalMarks: number,
    newQuestionMarks: number,
    excludeQuestionId: string | null,
  ) {
    const existingQuestions = await db
      .select({ id: questions.id, marks: questions.marks })
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId));

    const currentSum = existingQuestions
      .filter((q) => q.id !== excludeQuestionId)
      .reduce((s, q) => s + (q.marks ?? 1), 0);

    const newSum = currentSum + newQuestionMarks;

    if (newSum > assessmentTotalMarks) {
      throw new BadRequestException(
        `Adding this question (${newQuestionMarks} marks) would make the total ${newSum}, which exceeds the assessment total of ${assessmentTotalMarks} marks. Remaining capacity: ${assessmentTotalMarks - currentSum} marks.`,
      );
    }
  }

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

  private async getManagedCourseIds(
    managerId: string,
  ): Promise<string[]> {
    const managedCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(or(eq(courses.managerId, managerId), sql`${courses.managerId} IS NULL`));
    return managedCourses.map((c) => c.id);
  }

  /**
   * Get course IDs for a TA (approved assignments only).
   */
  private async getTACourseIds(userId: string): Promise<string[]> {
    const taCourses = await db
      .select({ courseId: courseAssistants.courseId })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.userId, userId),
          eq(courseAssistants.status, 'approved'),
        ),
      );
    return taCourses.map((c) => c.courseId);
  }

  /**
   * Verify the user can access the course.
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
    options?: { allowCompleted?: boolean },
  ) {
    const conditions: any[] = [eq(courses.id, courseId)];
    this.addCourseOwnershipCondition(conditions, user);

    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId, status: courses.status })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!options?.allowCompleted && (course.status === 'completed' || course.status === 'archived')) {
      throw new BadRequestException('Cannot modify a completed or archived course');
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
    if (!isGlobalAdmin(user)) {
      const courseConditions: any[] = [eq(courses.id, assessment.courseId)];
      if (isManager(user)) {
        courseConditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
      } else {
        courseConditions.push(eq(courses.instructorId, user.id));
      }

      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(...courseConditions))
        .limit(1);

      if (!course) {
        // Check if user is a TA assigned to this course
        if (user.roles.includes('TEACHING_ASSISTANT')) {
          const [courseTA] = await db
            .select({ id: courseAssistants.id })
            .from(courseAssistants)
            .where(
              and(
                eq(courseAssistants.courseId, assessment.courseId),
                eq(courseAssistants.userId, user.id),
                eq(courseAssistants.status, 'approved'),
              ),
            )
            .limit(1);

          if (!courseTA) {
            // Also check session-level assignment
            const [sessionTA] = await db
              .select({ id: sessionAssistants.id })
              .from(sessionAssistants)
              .innerJoin(sessions, eq(sessionAssistants.sessionId, sessions.id))
              .where(
                and(
                  eq(sessions.courseId, assessment.courseId),
                  eq(sessionAssistants.userId, user.id),
                ),
              )
              .limit(1);

            if (!sessionTA) {
              throw new NotFoundException('Assessment not found');
            }
          }
        } else {
          throw new NotFoundException('Assessment not found');
        }
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
    if (!isGlobalAdmin(user)) {
      const courseConditions: any[] = [eq(courses.id, question.courseId)];
      if (isManager(user)) {
        courseConditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
      } else {
        courseConditions.push(eq(courses.instructorId, user.id));
      }

      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(...courseConditions))
        .limit(1);

      if (!course) {
        throw new NotFoundException('Question not found');
      }
    }

    return question;
  }
}
