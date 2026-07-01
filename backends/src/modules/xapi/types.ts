import type { NelcLang } from './nelc-spec';

/**
 * Domain context types passed to statement builders.
 *
 * These are NOT xAPI shapes — they're the convenient inputs our service
 * layer assembles from DB rows. Builders translate them into the literal
 * xAPI JSON NELC expects.
 */

export interface XapiActor {
  /** Learner email — becomes `mailto:` URI in actor.mbox. */
  email: string;
  /** Saudi National ID — becomes actor.name (NELC keys on this). */
  nationalId: string;
}

export interface XapiInstructor {
  email: string;
  /** Single string — instructors don't have nationalId in our model. */
  name: string;
}

export interface XapiActivityRef {
  /** Canonical URL we generate (e.g. {lmsUrl}/courses/<id>).
   *  Becomes object.id — must be globally stable. */
  url: string;
  /** Display name in the statement's language. */
  title: string;
  /** Optional description shown alongside the activity in LRS UIs. */
  description?: string;
  /** Activity type IRI from NELC_ACTIVITY_TYPE. */
  activityType: string;
  language: NelcLang;
  /** Required only when activity is a video (in seconds). */
  durationSeconds?: number;
  /** Required only when activity is an assessment.
   *  raw = the score the learner achieved; min/max bound the scale. */
  score?: XapiScore;
}

export interface XapiScore {
  raw: number;
  min: number;
  max: number;
}

export interface XapiBrowser {
  family: string;
  name: string;
  version: string;
}

/** Optional learner-profile fields sent only on the RegisteredStatement.
 *  Anything missing is just omitted from the extension map (NELC accepts). */
export interface XapiLearnerProfile {
  /** ISO-8601 duration (e.g. 'PT02H30M00S') — usually course CME hours. */
  courseDuration?: string;
  mobileNo?: string;
  fullName?: string;
  /** Full English country name per NELC sample (e.g. 'Saudi Arabia'). */
  nationality?: string;
  /** Format dd/mm/YYYY per NELC SDK convention. */
  dateOfBirth?: string;
  /** Programme-specific landing URL (e.g. the course public URL). */
  programUrl?: string;
}

/** Everything every builder needs — learner, instructor, activity, language.
 *  Optional fields are statement-type-specific. */
export interface XapiBaseContext {
  actor: XapiActor;
  instructor: XapiInstructor;
  activity: XapiActivityRef;
  language: NelcLang;
  /** ISO-8601 timestamp. When omitted the builder stamps `new Date()`. */
  timestamp?: string;
  /** Parent activity for nested events (e.g. video parent = course).
   *  Goes into context.contextActivities.parent. */
  parent?: XapiActivityRef;
  browser?: XapiBrowser;
}
