"use client";

import { Fragment } from "react";

// Render plain text with auto-detected URLs as safe, new-tab links.
//
// Why this exists: ticket bodies / replies are user-supplied text. React
// already escapes the text content for XSS, but a bare URL still renders
// as un-clickable text. We want it clickable AND safe — no javascript:
// schemes, no tab-jacking via window.opener, no referrer leak, no SEO
// exploitation from malicious ticket content.
//
// Security guarantees:
//   - href is sanitized: only http(s) URLs pass; javascript:/data:/
//     vbscript: schemes (including encoded variants and bidi tricks) are
//     rejected and rendered as plain text.
//   - rel="noopener noreferrer nofollow" on every link.
//   - target="_blank" so chat context isn't lost.
//   - The non-link portions of the text are rendered through React
//     children, which escapes HTML by default — no innerHTML in sight.

// Detect http(s):// URLs and bare www.* URLs. Trailing punctuation is
// intentionally excluded so "see https://x.com." doesn't capture the dot.
const URL_REGEX =
  /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"',.!?;:)\]}])/gi;

// Schemes we will NEVER render as a link.
const DANGEROUS_SCHEME = /^(javascript|data|vbscript|file):/i;

function sanitizeHref(raw: string): string | null {
  // Normalize: strip whitespace + zero-width / bidi override characters
  // that an attacker could splice in to defeat a naïve prefix check.
  // U+200B-U+200F (zero-width / bidi marks), U+202A-U+202E (overrides),
  // U+2060 (word joiner), U+FEFF (BOM).
  const cleaned = raw
    .trim()
    .replace(/[​-‏‪-‮⁠﻿]/g, "");
  if (!cleaned) return null;
  if (DANGEROUS_SCHEME.test(cleaned)) return null;

  // Add https:// when the user typed a bare www.something link.
  const candidate = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  // Final check: the browser must parse it as an http(s) URL.
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

// Cap display so a 400-char URL doesn't blow the bubble layout.
function truncateDisplay(text: string, max = 60): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

interface Props {
  text: string;
  /** Tailwind class for the link colour. Defaults to the brand primary. */
  linkClassName?: string;
}

export default function LinkifiedText({ text, linkClassName }: Props) {
  if (!text) return null;

  const linkCls =
    linkClassName ||
    "text-[var(--color-primary)] underline decoration-1 underline-offset-2 hover:opacity-80 break-all";

  const parts: Array<{ kind: "text" | "link"; value: string; href?: string }> =
    [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, start) });
    }
    const raw = match[0];
    const safeHref = sanitizeHref(raw);
    if (safeHref) {
      parts.push({ kind: "link", value: raw, href: safeHref });
    } else {
      // Couldn't sanitize — render as plain text. The user still SEES
      // the URL; it just isn't clickable, which is the correct fallback.
      parts.push({ kind: "text", value: raw });
    }
    lastIndex = start + raw.length;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "link" && p.href) {
          return (
            <a
              key={i}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={linkCls}
              title={p.href}
            >
              {truncateDisplay(p.value)}
            </a>
          );
        }
        return <Fragment key={i}>{p.value}</Fragment>;
      })}
    </>
  );
}
