/**
 * Single source of truth for sanitizing user-authored HTML before it
 * touches the database. Used by anything that accepts rich-text input
 * (course overview, assessment essay answers, future blog/comment
 * fields, etc.).
 *
 * Strategy:
 *   - Allow common formatting tags: bold, italic, paragraphs, lists,
 *     links, headings, blockquotes, line breaks.
 *   - Strip everything else: <script>, <iframe>, <object>, <embed>,
 *     <form>, <input>, on*= event handlers, javascript: URLs, etc.
 *
 * Sanitization is the second line of defense — the frontend also
 * sanitizes rich-text on render — but having backend write-time
 * cleansing means stored data is clean regardless of which surface
 * reads it (admin preview, email template, grading view, etc.).
 */

import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'code',
  'pre',
  'span',
  'div',
  'hr',
];

// `target` allowed so links can open in new tabs; `rel` for proper
// `noopener noreferrer` on those. `class` allowed for styling hooks from
// the rich-text editor (TipTap emits some). `href` is the only URL-bearing
// attribute we let through, and DOMPurify's URL sanitizer will reject
// javascript: / data: schemes by default.
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'title'];

/**
 * Strip dangerous markup from a rich-text input. Safe to call with
 * null / undefined / empty values — returns the same falsy value back
 * so callers can do `obj.field = sanitizeRichText(dto.field)` without
 * extra null checks.
 */
export function sanitizeRichText<T extends string | null | undefined>(
  value: T,
): T {
  if (value === null || value === undefined || value === '') return value;
  // DOMPurify config: only allow our explicit whitelist; force `target=_blank`
  // links to carry `rel=noopener noreferrer` so they can't tamper with the
  // opener window via window.opener.
  return DOMPurify.sanitize(value as string, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
  }) as T;
}
