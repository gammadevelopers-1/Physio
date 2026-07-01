import {
  NELC_EXTENSION,
  NELC_VERB_DISPLAY,
  OBJECT_TYPE,
  type NelcVerb,
} from '../nelc-spec';
import type {
  XapiActivityRef,
  XapiActor,
  XapiBrowser,
  XapiInstructor,
  XapiScore,
} from '../types';

/**
 * Reusable XAPI fragment builders.
 *
 * Statement builders use these to assemble the literal JSON NELC accepts
 * without duplicating shape across nine files. Each helper mirrors the
 * `->toArray()` method of the corresponding msaaq SDK class.
 */

export interface PlatformBlock {
  identifier: string;
  nameEn: string;
  nameAr: string;
}

export function buildVerb(verb: NelcVerb): { id: string; display: { 'en-US': string } } {
  return {
    id: verb,
    display: { 'en-US': NELC_VERB_DISPLAY[verb] },
  };
}

export function buildActor(actor: XapiActor): {
  mbox: string;
  name: string;
  objectType: string;
} {
  return {
    mbox: `mailto:${actor.email}`,
    name: actor.nationalId,
    objectType: OBJECT_TYPE.AGENT,
  };
}

export function buildInstructor(instructor: XapiInstructor): {
  name: string;
  mbox: string;
} {
  return {
    name: instructor.name,
    mbox: `mailto:${instructor.email}`,
  };
}

export function buildActivity(activity: XapiActivityRef): {
  id: string;
  definition: {
    name: Record<string, string>;
    type: string;
    description?: Record<string, string>;
  };
  objectType: string;
} {
  const definition: {
    name: Record<string, string>;
    type: string;
    description?: Record<string, string>;
  } = {
    name: { [activity.language]: activity.title },
    type: activity.activityType,
  };
  // Description appears ONLY when the caller explicitly set it (i.e. the
  // `registered` builder). Per NELC checklist 3.1: "Course description
  // appears only in the registration statement." Non-register callers
  // pass description: undefined.
  if (activity.description) {
    definition.description = { [activity.language]: activity.description };
  }
  return {
    id: activity.url,
    definition,
    objectType: OBJECT_TYPE.ACTIVITY,
  };
}

/** Strip HTML tags from a string. Used on course title + description
 *  before sending — per NELC checklist 2.8: "Course name and description
 *  do not contain HTML tags." The course-detail form accepts rich text;
 *  this gives the LRS a plain-text version. */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Platform extension value — bilingual name object hung off the
 *  NELC_EXTENSION.PLATFORM key. Sent on EVERY statement. */
export function buildPlatformExtension(platform: PlatformBlock): {
  name: { 'ar-SA': string; 'en-US': string };
} {
  return {
    name: {
      'ar-SA': platform.nameAr,
      'en-US': platform.nameEn,
    },
  };
}

export function buildBrowserExtension(
  browser: XapiBrowser,
): Record<string, { code_name: string; name: string; version: string }> {
  return {
    [NELC_EXTENSION.BROWSER_INFORMATION]: {
      code_name: browser.family,
      name: browser.name,
      version: browser.version,
    },
  };
}

export function buildScore(score: XapiScore): {
  scaled: number;
  raw: number;
  min: number;
  max: number;
} {
  const range = score.max - score.min;
  const scaled = range === 0 ? 0 : (score.raw - score.min) / range;
  return {
    scaled,
    raw: score.raw,
    min: score.min,
    max: score.max,
  };
}

/** ISO-8601 duration from seconds — matches the msaaq SDK format
 *  exactly (PT{H}H{M}M{S}S — no zero-suppression). */
export function secondsToIso8601Duration(seconds: number): string {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `PT${hours}H${mins}M${secs}S`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
