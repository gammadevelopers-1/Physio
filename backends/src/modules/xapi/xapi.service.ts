import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  xapiStatements,
  submissions,
  XAPI_STATEMENT_STATUS,
  type NewXapiStatement,
} from '../../database/schema';
import {
  XAPI_QUEUE_NAMES,
  XAPI_JOB_NAMES,
  type TransmitStatementJobData,
} from './constants';
import {
  buildRegisteredStatement,
  buildInitializedStatement,
  buildWatchedStatement,
  buildCompletedStatement,
  buildAttemptedStatement,
  buildRatedStatement,
  buildEarnedStatement,
  buildProgressedStatement,
  buildLoggedInStatement,
  buildAttendedStatement,
  type PlatformBlock,
  type RegisteredStatementInput,
  type WatchedStatementInput,
  type AttemptedStatementInput,
  type RatedStatementInput,
  type EarnedStatementInput,
  type ProgressedStatementInput,
  type AttendedStatementInput,
} from './statement-builders';
import type { XapiBaseContext, XapiBrowser } from './types';
import {
  NELC_VERB,
  NELC_ACTIVITY_TYPE,
  type NelcVerb,
} from './nelc-spec';
import { XapiContextHelper } from './xapi-context.helper';

/**
 * Discriminated union of every event the service knows how to emit.
 * Each shape matches the corresponding builder's input — the service
 * picks the builder by `event` and forwards the rest.
 */
export type XapiEmitInput =
  | ({ event: 'registered' } & RegisteredStatementInput & EmitMetadata)
  | ({ event: 'initialized' } & XapiBaseContext & EmitMetadata)
  | ({ event: 'watched' } & WatchedStatementInput & EmitMetadata)
  | ({ event: 'completed' } & XapiBaseContext & EmitMetadata)
  | ({ event: 'attempted' } & AttemptedStatementInput & EmitMetadata)
  | ({ event: 'rated' } & RatedStatementInput & EmitMetadata)
  | ({ event: 'earned' } & EarnedStatementInput & EmitMetadata)
  | ({ event: 'progressed' } & ProgressedStatementInput & EmitMetadata)
  | ({ event: 'loggedIn' } & XapiBaseContext & EmitMetadata)
  | ({ event: 'attended' } & AttendedStatementInput & EmitMetadata);

/** Internal-pointer fields persisted on the xapi_statements row so the
 *  admin UI can link statements back to the source enrolment / course
 *  without reparsing the payload. Optional — payload is authoritative. */
export interface EmitMetadata {
  /** users.id of the learner this statement is about. */
  actorUserId?: string;
  /** courses.id this statement is associated with (when applicable). */
  courseId?: string;
  /** enrollments.id this statement is associated with (when applicable). */
  enrollmentId?: string;
}

@Injectable()
export class XapiService {
  private readonly logger = new Logger(XapiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly context: XapiContextHelper,
    @Optional()
    @InjectQueue(XAPI_QUEUE_NAMES.STATEMENTS)
    private readonly queue: Queue<TransmitStatementJobData> | null,
  ) {}

  /**
   * Build + persist + enqueue an xAPI statement.
   *
   * Returns the statement row id (callers can ignore — fire-and-forget
   * is the common case). NEVER throws — emission failures are logged
   * and the row is left in `pending` status for the cron to retry.
   *
   * When NELC_LRS_ENABLED=false (dev default), persists the row but
   * does not enqueue — useful for inspecting builder output without
   * hitting NELC's staging.
   */
  async emit(input: XapiEmitInput): Promise<string | null> {
    const platform = this.getPlatformBlock();
    try {
      const { payload, verb } = this.build(input, platform);
      const objectActivityId = String(
        (payload.object as { id?: string })?.id ?? '',
      );
      const objectType = String(
        (
          (payload.object as {
            definition?: { type?: string };
          })?.definition?.type ?? ''
        ),
      );

      const row: NewXapiStatement = {
        verb,
        actorUserId: input.actorUserId ?? null,
        objectActivityId,
        objectType,
        courseId: input.courseId ?? null,
        enrollmentId: input.enrollmentId ?? null,
        payload,
        status: XAPI_STATEMENT_STATUS.PENDING,
      };

      const [inserted] = await db
        .insert(xapiStatements)
        .values(row)
        .returning({ id: xapiStatements.id });
      const statementId = inserted.id;

      // The statement id we generated is ALSO what we want in the
      // payload's xAPI `id` field so retries are idempotent on the LRS.
      // Patch it in after insert (cheaper than two round-trips).
      const patchedPayload = { id: statementId, ...payload };
      await db
        .update(xapiStatements)
        .set({ payload: patchedPayload })
        .where(eq(xapiStatements.id, statementId));

      const enabled = this.configService.get<boolean>('nelc.enabled');
      if (!enabled) {
        this.logger.debug(
          `[xapi] disabled — statement ${statementId} (${verb}) persisted but not transmitted`,
        );
        return statementId;
      }
      if (!this.queue) {
        this.logger.warn(
          `[xapi] Redis not configured — statement ${statementId} (${verb}) will be picked up by next cron flush`,
        );
        return statementId;
      }

      await this.queue.add(
        XAPI_JOB_NAMES.TRANSMIT_STATEMENT,
        { statementId },
        {
          attempts: 1, // retries handled inside LrsClient; queue just dispatches
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
      return statementId;
    } catch (err) {
      // Emission must never crash a business action — if we can't even
      // persist, log loudly and move on. The source-of-truth event
      // (enrolment, completion, etc.) is already committed; missing an
      // xAPI statement is recoverable by re-emitting later.
      this.logger.error(
        `[xapi] Failed to emit ${input.event}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return null;
    }
  }

  /** Read the platform identity from config — same on every statement. */
  private getPlatformBlock(): PlatformBlock {
    return {
      identifier:
        this.configService.get<string>('nelc.platformIdentifier') || '',
      nameEn: this.configService.get<string>('nelc.platformNameEn') || '',
      nameAr: this.configService.get<string>('nelc.platformNameAr') || '',
    };
  }

  /** Dispatch to the right builder. Returns the assembled payload +
   *  the verb IRI so the row insert doesn't need to dig into the JSON. */
  private build(
    input: XapiEmitInput,
    platform: PlatformBlock,
  ): { payload: Record<string, unknown>; verb: NelcVerb } {
    switch (input.event) {
      case 'registered':
        return {
          payload: buildRegisteredStatement(input, platform),
          verb: NELC_VERB.REGISTERED,
        };
      case 'initialized':
        return {
          payload: buildInitializedStatement(input, platform),
          verb: NELC_VERB.INITIALIZED,
        };
      case 'watched':
        return {
          payload: buildWatchedStatement(input, platform),
          verb: NELC_VERB.WATCHED,
        };
      case 'completed':
        return {
          payload: buildCompletedStatement(input, platform),
          verb: NELC_VERB.COMPLETED,
        };
      case 'attempted':
        return {
          payload: buildAttemptedStatement(input, platform),
          verb: NELC_VERB.ATTEMPTED,
        };
      case 'rated':
        return {
          payload: buildRatedStatement(input, platform),
          verb: NELC_VERB.RATED,
        };
      case 'earned':
        return {
          payload: buildEarnedStatement(input, platform),
          verb: NELC_VERB.EARNED,
        };
      case 'progressed':
        return {
          payload: buildProgressedStatement(input, platform),
          verb: NELC_VERB.PROGRESSED,
        };
      case 'loggedIn':
        return {
          payload: buildLoggedInStatement(input, platform),
          verb: NELC_VERB.LOGGED_IN,
        };
      case 'attended':
        return {
          payload: buildAttendedStatement(input, platform),
          verb: NELC_VERB.ATTENDED,
        };
    }
  }

  // ===========================================================
  // High-level convenience emitters
  //
  // Each one looks up the actor / instructor / course context from the
  // DB, builds the input, and forwards to emit(). Hook sites call these
  // directly so business code stays a one-liner — every method swallows
  // errors so a missing FK or stale row never disrupts the originating
  // business action.
  // ===========================================================

  async emitLogin(userId: string, browser?: XapiBrowser): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      await this.emit({
        event: 'loggedIn',
        actor: learner.actor,
        instructor: { email: '', name: '' }, // unused by builder
        activity: {
          // Platform-level activity — the LMS itself.
          url:
            (this.configService.get<string>('nelc.lmsUrl') || '').replace(/\/$/, '') ||
            this.configService.get<string>('nelc.platformIdentifier') ||
            '',
          title: this.configService.get<string>('nelc.platformNameEn') || 'PhysioGuidance',
          activityType: NELC_ACTIVITY_TYPE.MODULE,
          language: learner.language,
        },
        language: learner.language,
        browser,
        actorUserId: userId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitLogin(${userId}) failed: ${(err as Error).message}`);
    }
  }

  async emitCourseEnrollment(
    userId: string,
    courseId: string,
    enrollmentId: string,
  ): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      // ONLY register-statement context includes course description
      // (NELC checklist 3.1). Pass withDescription explicitly.
      const course = await this.context.getCourse(courseId, learner.language, {
        withDescription: true,
      });
      if (!course) return;
      await this.emit({
        event: 'registered',
        actor: learner.actor,
        instructor: course.instructor,
        activity: course.activity,
        language: course.language,
        profile: {
          ...learner.profile,
          programUrl: course.activity.url,
        },
        actorUserId: userId,
        courseId,
        enrollmentId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitCourseEnrollment(${userId}, ${courseId}) failed: ${(err as Error).message}`);
    }
  }

  async emitCourseInitialized(userId: string, courseId: string): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const course = await this.context.getCourse(courseId, learner.language);
      if (!course) return;
      await this.emit({
        event: 'initialized',
        actor: learner.actor,
        instructor: course.instructor,
        activity: course.activity,
        language: course.language,
        actorUserId: userId,
        courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitCourseInitialized(${userId}, ${courseId}) failed: ${(err as Error).message}`);
    }
  }

  async emitLessonCompleted(
    userId: string,
    courseId: string,
    moduleId: string,
  ): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const course = await this.context.getCourse(courseId, learner.language);
      if (!course) return;
      const lesson = await this.context.getLessonActivity(moduleId, learner.language);
      if (!lesson) return;
      await this.emit({
        event: 'completed',
        actor: learner.actor,
        instructor: course.instructor,
        activity: lesson,
        language: learner.language,
        parent: course.activity,
        actorUserId: userId,
        courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitLessonCompleted(${userId}, ${courseId}, ${moduleId}) failed: ${(err as Error).message}`);
    }
  }

  async emitVideoWatched(
    userId: string,
    materialId: string,
    durationSeconds: number,
    completed: boolean,
    browser?: XapiBrowser,
  ): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const video = await this.context.getVideoActivity(
        materialId,
        learner.language,
        durationSeconds,
      );
      if (!video) return;
      const course = await this.context.getCourse(video.courseId, learner.language);
      if (!course) return;
      await this.emit({
        event: 'watched',
        actor: learner.actor,
        instructor: course.instructor,
        activity: video.activity,
        language: learner.language,
        // Parent = the COURSE — always. NELC sample #3 sets parent to
        // the course even when the video URL nests under a module
        // (/course/CR001/module/MDL002/video/VD003 → parent = /course/CR001).
        // The nesting lives in the URL; contextActivities.parent stays
        // at the course level so CRS001 sees one consistent course ID.
        parent: course.activity,
        completed,
        browser,
        actorUserId: userId,
        courseId: video.courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitVideoWatched(${userId}, ${materialId}) failed: ${(err as Error).message}`);
    }
  }

  async emitAssessmentSubmitted(
    userId: string,
    assessmentId: string,
    scoreRaw: number,
    passingMarks: number,
    totalMarks: number,
    passed: boolean,
  ): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const assessment = await this.context.getAssessmentActivity(
        assessmentId,
        learner.language,
      );
      if (!assessment) return;
      const course = await this.context.getCourse(assessment.courseId, learner.language);
      if (!course) return;

      // NELC checklist 1.6 — attempt IDs must increment sequentially
      // by 1. Count prior submissions for this (student, assessment)
      // pair; the just-inserted row is included, so its attempt # is
      // the current count.
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(submissions)
        .where(
          and(
            eq(submissions.studentId, userId),
            eq(submissions.assessmentId, assessmentId),
          ),
        );
      const attemptNo = Math.max(1, Number(count ?? 1));

      // NELC checklist 5.2 — `result.success = true when raw >= min`.
      // Setting min = passingMarks makes the validator's rule match our
      // pass logic; if assessment has no passingMarks configured, fall
      // back to 1 so any score above 0 satisfies the rule.
      const min = passingMarks > 0 ? passingMarks : 1;
      const max = Math.max(totalMarks, min);

      await this.emit({
        event: 'attempted',
        actor: learner.actor,
        instructor: course.instructor,
        activity: {
          ...assessment.activity,
          score: { raw: scoreRaw, min, max },
        },
        language: learner.language,
        parent: course.activity,
        completed: true,
        succeeded: passed,
        attemptId: attemptNo,
        actorUserId: userId,
        courseId: assessment.courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitAssessmentSubmitted(${userId}, ${assessmentId}) failed: ${(err as Error).message}`);
    }
  }

  async emitWebinarAttended(userId: string, sessionId: string): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const session = await this.context.getSessionActivity(sessionId, learner.language);
      if (!session) return;
      const course = await this.context.getCourse(session.courseId, learner.language);
      if (!course) return;

      // NELC checklist SEQ003 — no duplicate statements per learner.
      // Webinar attendance can be emitted from 3 different paths for
      // the same (student, session): Zoom webhook (real-time on Zoom
      // event), Zoom sync cron (periodic reconciliation), and manual
      // attendance marking. Without dedup, all three fire and NELC's
      // validator flags duplicates 3 seconds apart. Skip if a non-
      // failed `attended` statement already exists for this pair.
      const expectedActivityId = String(session.activity.url);
      const existing = await db
        .select({ id: xapiStatements.id })
        .from(xapiStatements)
        .where(
          and(
            eq(xapiStatements.actorUserId, userId),
            eq(xapiStatements.verb, NELC_VERB.ATTENDED),
            eq(xapiStatements.objectActivityId, expectedActivityId),
            sql`${xapiStatements.status} <> ${XAPI_STATEMENT_STATUS.FAILED}`,
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        this.logger.debug(
          `[xapi] emitWebinarAttended(${userId}, ${sessionId}) skipped — already exists as ${existing[0].id}`,
        );
        return;
      }

      // Use NELC's dedicated `attended` verb + VIRTUAL_CLASSROOM activity-type
      // (official sample #5) instead of generic `completed`+COURSE. The
      // duration on the activity is the session length — pass it through
      // as the result.duration so NELC sees how long the learner attended.
      await this.emit({
        event: 'attended',
        actor: learner.actor,
        instructor: course.instructor,
        activity: session.activity,
        language: learner.language,
        parent: course.activity,
        durationSeconds: session.activity.durationSeconds ?? 60,
        actorUserId: userId,
        courseId: session.courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitWebinarAttended(${userId}, ${sessionId}) failed: ${(err as Error).message}`);
    }
  }

  async emitCourseCompleted(userId: string, courseId: string): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const course = await this.context.getCourse(courseId, learner.language);
      if (!course) return;
      await this.emit({
        event: 'completed',
        actor: learner.actor,
        instructor: course.instructor,
        activity: course.activity,
        language: learner.language,
        actorUserId: userId,
        courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitCourseCompleted(${userId}, ${courseId}) failed: ${(err as Error).message}`);
    }
  }

  async emitCertificateIssued(
    userId: string,
    courseId: string,
    certRequestId: string,
    certificateUrl: string,
  ): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const course = await this.context.getCourse(courseId, learner.language);
      if (!course) return;
      const certActivity = this.context.buildCertificateActivity(
        certRequestId,
        learner.language,
        course.activity.title,
        courseId,
      );
      await this.emit({
        event: 'earned',
        actor: learner.actor,
        instructor: course.instructor,
        activity: certActivity,
        language: learner.language,
        parent: course.activity,
        certificateUrl,
        actorUserId: userId,
        courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitCertificateIssued(${userId}, ${courseId}) failed: ${(err as Error).message}`);
    }
  }

  async emitCourseRated(
    userId: string,
    courseId: string,
    rating: number,
    reviewText: string,
  ): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const course = await this.context.getCourse(courseId, learner.language);
      if (!course) return;
      // NELC official sample #10 — rating uses raw/min/max in the
      // native 1–5 scale (xAPI auto-computes `scaled` = raw/max into
      // the 0–1 range that checklist 5.3 refers to).
      const clampedRaw = Math.min(5, Math.max(0, rating));
      // Checklist 5.4 — rating statements MUST include a textual
      // review response. Synthesize a default when the learner left
      // the text empty so the field is never blank.
      const response =
        (reviewText || '').trim() || `Course rating: ${rating}/5`;
      await this.emit({
        event: 'rated',
        actor: learner.actor,
        instructor: course.instructor,
        activity: course.activity,
        language: learner.language,
        rating: { raw: clampedRaw, min: 0, max: 5 },
        reviewText: response,
        actorUserId: userId,
        courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitCourseRated(${userId}, ${courseId}) failed: ${(err as Error).message}`);
    }
  }

  /**
   * Emit a `progressed` statement against the course. NELC checklist
   * 1.4 requires progress values to increase monotonically over time —
   * the caller is responsible for not emitting unless `progressPct`
   * exceeds the prior value.
   *
   * @param progressPct 0–100, the new total progress percentage.
   */
  async emitCourseProgressed(
    userId: string,
    courseId: string,
    progressPct: number,
  ): Promise<void> {
    try {
      const learner = await this.context.getLearner(userId);
      if (!learner) return;
      const course = await this.context.getCourse(courseId, learner.language);
      if (!course) return;
      const clamped = Math.min(100, Math.max(0, progressPct));
      await this.emit({
        event: 'progressed',
        actor: learner.actor,
        instructor: course.instructor,
        activity: {
          ...course.activity,
          // ProgressedStatement builder reads score; raw out of 100 ->
          // scaled 0–1 inside buildScore.
          score: { raw: clamped, min: 0, max: 100 },
        },
        language: learner.language,
        completed: clamped >= 100,
        actorUserId: userId,
        courseId,
      });
    } catch (err) {
      this.logger.warn(`[xapi] emitCourseProgressed(${userId}, ${courseId}) failed: ${(err as Error).message}`);
    }
  }

  /**
   * Send the NELC "LMS Provider Joined" administrative trigger
   * statement. Per the NELC LMS Provider Entities guide, this is a
   * one-time onboarding statement sent BEFORE any learner activity —
   * confirms the platform is wired up and reachable. Uses verb=
   * registered with object.definition.name.en-US = "joined".
   *
   * Triggered manually from the admin panel; not part of any learner
   * flow.
   */
  async emitProviderJoined(
    triggeredBy?: { email?: string; name?: string },
  ): Promise<string | null> {
    return this.emitProviderTrigger('joined', triggeredBy);
  }

  /**
   * Send the NELC "LMS Provider Left" trigger — counterpart to
   * `emitProviderJoined`. Sent when the LMS subscription is terminated
   * or the platform stops using NELC. One-shot, admin-triggered.
   */
  async emitProviderLeft(
    triggeredBy?: { email?: string; name?: string },
  ): Promise<string | null> {
    return this.emitProviderTrigger('left', triggeredBy);
  }

  private async emitProviderTrigger(
    objectName: 'joined' | 'left',
    triggeredBy?: { email?: string; name?: string },
  ): Promise<string | null> {
    const platform = this.getPlatformBlock();
    const lmsUrl =
      this.configService.get<string>('nelc.lmsUrl') || platform.identifier;
    // actor.mbox MUST be a real mailto: URI per xAPI spec — NELC's
    // production validator (unlike staging) rejects non-email values.
    // Fall back to a fixed admin identity when the controller didn't
    // pass the triggering super-admin's details.
    const actorEmail = triggeredBy?.email || 'admin@physioguidance.org';
    const actorName = triggeredBy?.name || 'PhysioGuidance Admin';

    try {
      const payload = {
        verb: {
          id: NELC_VERB.REGISTERED,
          display: { 'en-US': 'registered' },
        },
        actor: {
          mbox: `mailto:${actorEmail}`,
          name: actorName,
          objectType: 'Agent',
        },
        object: {
          id: lmsUrl,
          definition: {
            name: { 'en-US': objectName },
            type: 'https://w3id.org/xapi/cmi5/activitytype/course',
          },
          objectType: 'Activity',
        },
        context: {
          platform: platform.identifier,
          language: 'en-US',
          extensions: {
            'https://nelc.gov.sa/extensions/lms_url': lmsUrl,
            'https://nelc.gov.sa/extensions/platform': {
              name: {
                'ar-SA': platform.nameAr,
                'en-US': platform.nameEn,
              },
            },
          },
        },
        timestamp: new Date().toISOString(),
      };

      const [inserted] = await db
        .insert(xapiStatements)
        .values({
          verb: NELC_VERB.REGISTERED,
          actorUserId: null,
          objectActivityId: lmsUrl,
          objectType: 'https://w3id.org/xapi/cmi5/activitytype/course',
          courseId: null,
          enrollmentId: null,
          payload,
          status: XAPI_STATEMENT_STATUS.PENDING,
        })
        .returning({ id: xapiStatements.id });
      const statementId = inserted.id;

      const patchedPayload = { id: statementId, ...payload };
      await db
        .update(xapiStatements)
        .set({ payload: patchedPayload })
        .where(eq(xapiStatements.id, statementId));

      const enabled = this.configService.get<boolean>('nelc.enabled');
      if (enabled && this.queue) {
        await this.queue.add(
          XAPI_JOB_NAMES.TRANSMIT_STATEMENT,
          { statementId },
          {
            attempts: 1,
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );
      }
      this.logger.log(
        `[xapi] Provider trigger '${objectName}' persisted as ${statementId}`,
      );
      return statementId;
    } catch (err) {
      this.logger.error(
        `[xapi] emitProviderTrigger(${objectName}) failed: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
