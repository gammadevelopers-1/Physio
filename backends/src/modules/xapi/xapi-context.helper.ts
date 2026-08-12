import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import {
  users,
  courses,
  courseModules,
  courseMaterials,
  assessments,
  sessions,
} from '../../database/schema';
import { decryptUserPII } from '../../common/crypto';
import {
  NELC_ACTIVITY_TYPE,
  toBcp47,
  type NelcLang,
} from './nelc-spec';
import { stripHtml } from './statement-builders/helpers';
import type {
  XapiActor,
  XapiActivityRef,
  XapiInstructor,
  XapiLearnerProfile,
} from './types';

/** Options for activity lookups. NELC checklist 3.1 + 3.10 require
 *  description to appear ONLY in the registered statement and only on
 *  the object (not parent). Default everywhere else is false. */
export interface ActivityLookupOptions {
  withDescription?: boolean;
}

/** ISO-3166 alpha-2 → English country name map for nationalities likely
 *  to appear in our learner pool. The form already stores full names,
 *  so this only catches legacy/admin-entered values. */
const ISO2_TO_NATIONALITY: Record<string, string> = {
  SA: 'Saudi Arabia',
  AE: 'United Arab Emirates',
  EG: 'Egypt',
  JO: 'Jordan',
  LB: 'Lebanon',
  SY: 'Syria',
  IQ: 'Iraq',
  YE: 'Yemen',
  KW: 'Kuwait',
  QA: 'Qatar',
  BH: 'Bahrain',
  OM: 'Oman',
  PK: 'Pakistan',
  IN: 'India',
  PH: 'Philippines',
  BD: 'Bangladesh',
  SD: 'Sudan',
  MA: 'Morocco',
  TN: 'Tunisia',
  DZ: 'Algeria',
  US: 'United States',
  GB: 'United Kingdom',
};

function normaliseNationality(raw: string | null): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return 'Saudi Arabia';
  // 2-letter ISO code lookup (case-insensitive)
  if (trimmed.length === 2) {
    const upper = trimmed.toUpperCase();
    if (ISO2_TO_NATIONALITY[upper]) return ISO2_TO_NATIONALITY[upper];
  }
  return trimmed;
}

/**
 * Shared lookups for XapiService convenience emitters.
 *
 * Centralises the DB reads (learner, course, instructor, lesson, video,
 * assessment, session) so each high-level emit method on XapiService
 * stays small. Every method returns null on missing rows — the caller
 * skips emission rather than throwing, so a stale courseId or deleted
 * user never breaks the originating business action.
 */
@Injectable()
export class XapiContextHelper {
  private readonly logger = new Logger(XapiContextHelper.name);

  constructor(private readonly configService: ConfigService) {}

  // ── Learner ─────────────────────────────────────────────────────
  /**
   * Returns actor + optional profile fields needed only on the
   * RegisteredStatement. Null when the user has no national_id (NELC
   * matches on national_id; a statement without it would fail their
   * validator — better to skip than to send a broken one).
   */
  async getLearner(
    userId: string,
  ): Promise<{ actor: XapiActor; profile: XapiLearnerProfile; language: NelcLang } | null> {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        firstNameAr: users.firstNameAr,
        lastNameAr: users.lastNameAr,
        phone: users.phone,
        nationalId: users.nationalId,
        nationality: users.nationality,
        dateOfBirth: users.dateOfBirth,
        language: users.language,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) return null;

    const decrypted = decryptUserPII({
      phone: row.phone,
      nationalId: row.nationalId,
    });
    if (!decrypted.nationalId) {
      // Without an NID, NELC has no way to attribute the statement to a
      // learner. Skip emission. Logged at debug — not an error since
      // legacy users may genuinely lack one.
      this.logger.debug(`[xapi] user ${userId} has no national_id — skipping statement`);
      return null;
    }

    const language = toBcp47(row.language);
    const fullNameEn = [row.firstName, row.lastName].filter(Boolean).join(' ');
    const fullNameAr = [row.firstNameAr, row.lastNameAr].filter(Boolean).join(' ');
    const fullName = language === 'ar-SA' && fullNameAr ? fullNameAr : fullNameEn;

    // dd/mm/YYYY per NELC SDK convention. Stored as ISO date string —
    // reformat if present. Skip on parse failure.
    let dobFormatted: string | undefined;
    if (row.dateOfBirth) {
      const parts = row.dateOfBirth.split('-');
      if (parts.length === 3) {
        dobFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    return {
      actor: {
        email: row.email,
        nationalId: decrypted.nationalId,
      },
      profile: {
        mobileNo: decrypted.phone ?? undefined,
        fullName: fullName || undefined,
        // NELC sample uses full English country name (e.g. "Saudi Arabia"),
        // which is what the trainer form stores. Map any legacy 2-letter
        // codes to full names and default to "Saudi Arabia" when missing
        // (this is a Saudi-focused LMS — confirmed acceptable by Amna).
        nationality: normaliseNationality(row.nationality),
        dateOfBirth: dobFormatted,
      },
      language,
    };
  }

  // ── Course + Instructor ────────────────────────────────────────
  async getCourse(
    courseId: string,
    preferredLanguage: NelcLang,
    options: ActivityLookupOptions = {},
  ): Promise<{
    activity: XapiActivityRef;
    instructor: XapiInstructor;
    language: NelcLang;
  } | null> {
    const [row] = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        overview: courses.overview,
        overviewAr: courses.overviewAr,
        language: courses.language,
        cmeHours: courses.cmeHours,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!row) return null;

    // Statement language follows the learner's preference; the course
    // localisation is just a fallback when the learner-language title
    // is missing.
    const language = preferredLanguage;
    const rawTitle =
      language === 'ar-SA'
        ? row.titleAr || row.title
        : row.title || row.titleAr || '(untitled)';
    const title = stripHtml(rawTitle) || '(untitled)';

    // Description only included when caller asks for it (i.e. registered
    // statement). For non-register, leave undefined → buildActivity will
    // omit object.definition.description.
    let description: string | undefined;
    if (options.withDescription) {
      const rawDesc =
        (language === 'ar-SA'
          ? row.descriptionAr || row.overviewAr || row.description || row.overview
          : row.description || row.overview || row.descriptionAr || row.overviewAr) || '';
      let cleanDesc = stripHtml(rawDesc);
      // NELC checklist 2.5 + 2.7: every course needs a NON-EMPTY
      // description that differs from the name. Synthesize a sensible
      // fallback so we always satisfy both.
      if (!cleanDesc || cleanDesc === title) {
        const cmeHrs = Number(row.cmeHours ?? 0);
        cleanDesc =
          language === 'ar-SA'
            ? `${title} — دورة معتمدة${cmeHrs > 0 ? ` (${cmeHrs} ساعة CME)` : ''}`
            : `${title} — accredited course${cmeHrs > 0 ? ` (${cmeHrs} CME hours)` : ''}`;
      }
      description = cleanDesc;
    }

    const [instructorRow] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        firstNameAr: users.firstNameAr,
        lastNameAr: users.lastNameAr,
      })
      .from(users)
      .where(eq(users.id, row.instructorId))
      .limit(1);
    if (!instructorRow) return null;

    const instructorNameEn = [instructorRow.firstName, instructorRow.lastName]
      .filter(Boolean)
      .join(' ');
    const instructorNameAr = [instructorRow.firstNameAr, instructorRow.lastNameAr]
      .filter(Boolean)
      .join(' ');
    const instructorName =
      language === 'ar-SA' && instructorNameAr ? instructorNameAr : instructorNameEn;

    // NELC checklist 2.4: course / lesson / video / virtual class objects
    // include a valid duration. CME hours is the natural course duration
    // when set; fall back to a small non-zero value so the LRS doesn't
    // reject PT0H0M0S as an invalid course length.
    const cmeHours = Number(row.cmeHours ?? 0);
    const durationSeconds = cmeHours > 0 ? cmeHours * 3600 : 3600;

    return {
      activity: {
        // NELC official pattern: /course/<courseId> (singular). Every
        // child object URL must extend this prefix so the validator
        // extracts the same course ID across the journey (CRS001).
        url: this.activityUrl(`/course/${courseId}`),
        title,
        description,
        activityType: NELC_ACTIVITY_TYPE.COURSE,
        language,
        durationSeconds,
      },
      instructor: {
        email: instructorRow.email,
        name: instructorName || instructorRow.email,
      },
      language,
    };
  }

  // ── Module / Lesson ────────────────────────────────────────────
  async getLessonActivity(
    moduleId: string,
    language: NelcLang,
  ): Promise<XapiActivityRef | null> {
    const [row] = await db
      .select({
        id: courseModules.id,
        courseId: courseModules.courseId,
        title: courseModules.title,
        titleAr: courseModules.titleAr,
        durationMinutes: courseModules.durationMinutes,
      })
      .from(courseModules)
      .where(eq(courseModules.id, moduleId))
      .limit(1);
    if (!row) return null;
    const rawTitle =
      language === 'ar-SA'
        ? row.titleAr || row.title
        : row.title || row.titleAr || '(untitled lesson)';
    // NELC checklist 2.4: lesson objects must include a valid duration.
    // Default 600s (10 min) when the module hasn't been configured.
    const durationMinutes = Number(row.durationMinutes ?? 0);
    // NELC official pattern: /course/<c>/module/<m> — child URL extends
    // the course URL so the validator's CRS001 check extracts the same
    // course ID from object IDs across the whole journey.
    //
    // activityType MUST be MODULE (not LESSON). Our `courseModules`
    // table is the module layer of NELC's Course → Module → Lesson →
    // content hierarchy. A type=lesson on a /module/ URL trips CRS001:
    // the validator's type-vs-URL inference falls through and the
    // module URL ends up counted as a course-ID candidate. Sample #7
    // in the NELC integration guide is the authoritative reference.
    return {
      url: this.activityUrl(`/course/${row.courseId}/module/${row.id}`),
      title: stripHtml(rawTitle) || '(untitled module)',
      activityType: NELC_ACTIVITY_TYPE.MODULE,
      language,
      durationSeconds: durationMinutes > 0 ? durationMinutes * 60 : 600,
    };
  }

  // ── Video (course material) ────────────────────────────────────
  async getVideoActivity(
    materialId: string,
    language: NelcLang,
    /** Total video length in seconds. Reported by the client player and
     *  recorded on material_progress.totalSeconds — passed in by the
     *  caller since the material row itself doesn't store it. */
    durationSeconds: number,
  ): Promise<{ activity: XapiActivityRef; parent: XapiActivityRef | null; courseId: string } | null> {
    const [row] = await db
      .select({
        id: courseMaterials.id,
        courseId: courseMaterials.courseId,
        moduleId: courseMaterials.moduleId,
        title: courseMaterials.title,
        titleAr: courseMaterials.titleAr,
      })
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);
    if (!row) return null;

    // NELC official pattern: /course/<c>/module/<m>/video/<v>. When the
    // material isn't bound to a module we still nest it under the course
    // so the validator extracts the same courseId for CRS001.
    const videoPath = row.moduleId
      ? `/course/${row.courseId}/module/${row.moduleId}/video/${row.id}`
      : `/course/${row.courseId}/video/${row.id}`;
    const activity: XapiActivityRef = {
      url: this.activityUrl(videoPath),
      title: stripHtml(row.title) || '(untitled video)',
      activityType: NELC_ACTIVITY_TYPE.VIDEO,
      language,
      // NELC checklist 2.4: video objects need a valid duration.
      // Floor at 1s so PT0H0M0S never reaches the LRS.
      durationSeconds: Math.max(1, Math.floor(durationSeconds)),
    };

    let parent: XapiActivityRef | null = null;
    if (row.moduleId) {
      parent = await this.getLessonActivity(row.moduleId, language);
    }
    return { activity, parent, courseId: row.courseId };
  }

  // ── Assessment ─────────────────────────────────────────────────
  async getAssessmentActivity(
    assessmentId: string,
    language: NelcLang,
  ): Promise<{ activity: XapiActivityRef; courseId: string } | null> {
    const [row] = await db
      .select({
        id: assessments.id,
        courseId: assessments.courseId,
        title: assessments.title,
        titleAr: assessments.titleAr,
        totalMarks: assessments.totalMarks,
      })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);
    if (!row) return null;
    // NELC official pattern: /course/<c>/quiz/<q>. Assessments don't
    // track their parent module in our schema, so we nest directly
    // under the course — validator's CRS001 only needs `/course/<c>/`
    // to extract the same courseId across the journey.
    return {
      activity: {
        url: this.activityUrl(`/course/${row.courseId}/quiz/${row.id}`),
        title: stripHtml(row.title) || '(untitled assessment)',
        activityType: NELC_ACTIVITY_TYPE.UNIT_TEST,
        language,
      },
      courseId: row.courseId,
    };
  }

  // ── Session (webinar) ──────────────────────────────────────────
  async getSessionActivity(
    sessionId: string,
    language: NelcLang,
  ): Promise<{ activity: XapiActivityRef; courseId: string } | null> {
    const [row] = await db
      .select({
        id: sessions.id,
        courseId: sessions.courseId,
        title: sessions.title,
        durationMinutes: sessions.durationMinutes,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (!row) return null;
    const durMin = Number(row.durationMinutes ?? 0);
    // NELC official pattern: /course/<c>/virtual-classroom/<vc>. Sessions
    // don't track their parent module in our schema, so we nest directly
    // under the course.
    return {
      activity: {
        // Live sessions use the VIRTUAL_CLASSROOM activity-type per
        // NELC official sample #5, paired with the `attended` verb.
        url: this.activityUrl(`/course/${row.courseId}/virtual-classroom/${row.id}`),
        title: stripHtml(row.title) || '(untitled session)',
        activityType: NELC_ACTIVITY_TYPE.VIRTUAL_CLASSROOM,
        language,
        // NELC checklist 2.4 mandates duration; floor at 1 min for
        // sessions that weren't given an explicit length.
        durationSeconds: durMin > 0 ? durMin * 60 : 60,
      },
      courseId: row.courseId,
    };
  }

  // ── Certificate ────────────────────────────────────────────────
  buildCertificateActivity(
    certRequestId: string,
    language: NelcLang,
    courseTitle: string,
    courseId: string,
  ): XapiActivityRef {
    // NELC official pattern: /course/<c>/certificate/<cert>. Certificate
    // URL nests under the course so the validator's CRS001 check
    // extracts the same courseId from this object too.
    return {
      url: this.activityUrl(`/course/${courseId}/certificate/${certRequestId}`),
      title: stripHtml(courseTitle) || '(untitled certificate)',
      activityType: NELC_ACTIVITY_TYPE.CERTIFICATE,
      language,
    };
  }

  /** Prefix activity paths with the configured LMS URL. The result is
   *  the canonical xAPI activity-id NELC may dereference. */
  private activityUrl(path: string): string {
    const base = (this.configService.get<string>('nelc.lmsUrl') || '').replace(/\/$/, '');
    return `${base}${path}`;
  }
}
