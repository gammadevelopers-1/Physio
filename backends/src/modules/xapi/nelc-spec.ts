/**
 * NELC xAPI specification — literal IRIs and enums.
 *
 * Sourced from msaaqcom/nelc-xapi-php-sdk (the reference PHP SDK shipped
 * by a Saudi LMS provider that passes NELC validation). Strings here are
 * VERBATIM from that SDK — do not modify without testing against NELC's
 * staging validator, since their checker pattern-matches on exact IRIs.
 *
 * SDK source: https://github.com/msaaqcom/nelc-xapi-php-sdk
 */

// ── Verbs ────────────────────────────────────────────────────────────
// Every statement carries one verb. NELC's validator categorises events
// by these IRIs — registering a learner with the wrong verb (e.g.
// 'started' instead of 'registered') will not count toward enrolment.
export const NELC_VERB = {
  // Course enrolment. Used when an enrollment row is created.
  REGISTERED: 'http://adlnet.gov/expapi/verbs/registered',

  // Course / session "started". Fires the first time a learner opens
  // course content after enrolling.
  INITIALIZED: 'http://adlnet.gov/expapi/verbs/initialized',

  // Video watched. Note: non-ADL namespace (acrossx). Required by NELC
  // for video content — using ADL's 'experienced' instead does not
  // count toward the validator's "watched content" check.
  WATCHED: 'https://w3id.org/xapi/acrossx/verbs/watched',

  // Lesson / module / course completed (object.definition.type
  // determines which level). Same verb across all three.
  COMPLETED: 'http://adlnet.gov/expapi/verbs/completed',

  // Progress update — emitted for partial progress on a lesson/module.
  // Not required for the journey but included for completeness.
  PROGRESSED: 'http://adlnet.gov/expapi/verbs/progressed',

  // Assessment attempted. Result block carries score + success.
  ATTEMPTED: 'http://adlnet.gov/expapi/verbs/attempted',

  // Rating submitted (course feedback / instructor rating). tincanapi
  // namespace, not ADL.
  RATED: 'http://id.tincanapi.com/verb/rated',

  // Certificate / badge earned. tincanapi namespace.
  EARNED: 'http://id.tincanapi.com/verb/earned',

  // User login. ADL standard verb. NOT in msaaq's SDK (their journey
  // doesn't emit login statements), but Amna's checklist explicitly
  // lists "User Login (National ID)" as step 1, so we send it. If
  // NELC's validator rejects it, we can drop without affecting any
  // other event.
  LOGGED_IN: 'http://adlnet.gov/expapi/verbs/logged-in',

  // Webinar / virtual classroom attendance. NELC's official sample
  // statement (#5) pairs this verb with the virtual-classroom activity
  // type for live sessions.
  ATTENDED: 'http://adlnet.gov/expapi/verbs/attended',
} as const;

export type NelcVerb = (typeof NELC_VERB)[keyof typeof NELC_VERB];

// Human-readable display string for the verb. xAPI requires this to be
// a language map; NELC accepts en-US only.
export const NELC_VERB_DISPLAY: Record<NelcVerb, string> = {
  [NELC_VERB.REGISTERED]: 'registered',
  [NELC_VERB.INITIALIZED]: 'initialized',
  [NELC_VERB.WATCHED]: 'watched',
  [NELC_VERB.COMPLETED]: 'completed',
  [NELC_VERB.PROGRESSED]: 'progressed',
  [NELC_VERB.ATTEMPTED]: 'attempted',
  [NELC_VERB.RATED]: 'rated',
  [NELC_VERB.EARNED]: 'earned',
  [NELC_VERB.LOGGED_IN]: 'logged in',
  [NELC_VERB.ATTENDED]: 'attended',
};

// ── Activity Types ───────────────────────────────────────────────────
// Goes into object.definition.type. Tells NELC what KIND of thing the
// learner interacted with (course vs lesson vs assessment vs certificate).
export const NELC_ACTIVITY_TYPE = {
  COURSE: 'https://w3id.org/xapi/cmi5/activitytype/course',
  MODULE: 'http://adlnet.gov/expapi/activities/module',
  LESSON: 'http://adlnet.gov/expapi/activities/lesson',
  VIDEO: 'https://w3id.org/xapi/video/activity-type/video',
  // Assessment / quiz. Note: 'unit-test' is the tincanapi term —
  // NELC accepts it for any graded assessment.
  UNIT_TEST: 'http://id.tincanapi.com/activitytype/unit-test',
  // Certificate. Opigno namespace — the only widely-used certificate
  // activity-type IRI; ADL has no canonical one.
  CERTIFICATE:
    'https://www.opigno.org/en/tincan_registry/activity_type/certificate',
  // Live webinar / virtual session. NELC official sample #5.
  VIRTUAL_CLASSROOM:
    'https://w3id.org/xapi/virtual-classroom/activity-types/virtual-classroom',
} as const;

export type NelcActivityType =
  (typeof NELC_ACTIVITY_TYPE)[keyof typeof NELC_ACTIVITY_TYPE];

// ── Extension URIs ───────────────────────────────────────────────────
// xAPI extensions are namespaced key/value pairs hung off context (or
// result, or activity definition). NELC's custom extensions live under
// https://nelc.gov.sa/extensions/* — the rest are tincanapi standard.
export const NELC_EXTENSION = {
  // NELC custom — sent on every statement (context.extensions)
  PLATFORM: 'https://nelc.gov.sa/extensions/platform',
  DURATION: 'https://nelc.gov.sa/extensions/duration',
  LEARNER_MOBILE_NO: 'https://nelc.gov.sa/extensions/learner_mobile_no',
  LEARNER_FULL_NAME: 'https://nelc.gov.sa/extensions/learner_full_name',
  LEARNER_NATIONALITY: 'https://nelc.gov.sa/extensions/learner_nationality',
  DATE_OF_BIRTH: 'https://nelc.gov.sa/extensions/date_of_birth',
  LMS_URL: 'https://nelc.gov.sa/extensions/lms_url',
  PROGRAM_URL: 'https://nelc.gov.sa/extensions/program_url',

  // tincanapi standard
  ATTEMPT_ID: 'http://id.tincanapi.com/extension/attempt-id',
  BROWSER_INFORMATION: 'http://id.tincanapi.com/extension/browser-info',
  // Used on EarnedStatement to carry the certificate download URL.
  // (NELC's SDK reuses jws-certificate-location for this — it's
  // semantically about credential verification URLs, close enough.)
  JWS_CERTIFICATE_LOCATION:
    'http://id.tincanapi.com/extension/jws-certificate-location',
} as const;

// ── Languages ────────────────────────────────────────────────────────
// BCP 47 codes NELC accepts. Internal user.language stores 'en' | 'ar';
// translate via toBcp47() below.
export const NELC_LANG = {
  ARABIC: 'ar-SA',
  ENGLISH: 'en-US',
} as const;

export type NelcLang = (typeof NELC_LANG)[keyof typeof NELC_LANG];

export function toBcp47(language: string | null | undefined): NelcLang {
  return language === 'ar' ? NELC_LANG.ARABIC : NELC_LANG.ENGLISH;
}

// xAPI 1.0.3 — the version NELC's LRS validates against. Sent as
// X-Experience-API-Version on every request.
export const XAPI_VERSION = '1.0.3';

// objectType values per xAPI spec — only two we send.
export const OBJECT_TYPE = {
  AGENT: 'Agent',
  ACTIVITY: 'Activity',
} as const;
