# Per-Page SEO — Plan

Status: not started (2026-05-10)

## Goal

Maximum technical SEO foundation — everything Next.js + Strapi + NestJS can do
to rank. Every public page (static, dynamic Strapi page, blog post, course)
gets manager-editable SEO + structured data + hreflang + image optimization.
Locale-aware (en + ar). Sitemap + robots + IndexNow + breadcrumbs + JSON-LD.

**Honest scope**: this delivers the technical 30% of ranking. Content quality
(40%) and backlinks/authority (30%) are out of scope and on the marketing team.
Perfect tech alone won't put you at #1 — but bad tech caps everything.

## Locked decisions

| Question | Answer |
|---|---|
| Refactor strategy | Create `shared/seo` Strapi component, migrate the 13+ existing pages to use it, copy current values via one-time script |
| Course SEO defaults | Auto-fallback — empty SEO fields use `course.title` / `course.description` / `course.thumbnail` |
| Sitemap scope | Everything publicly indexable: static routes + every Strapi page + active courses + published blog posts + locale variants |
| Technical scope | **Maximum** — JSON-LD, hreflang, image SEO, breadcrumbs, IndexNow, per-page noindex toggle, canonical handling |
| Performance / Core Web Vitals | Separate audit pass after this feature ships |
| Search Console | Client handles Google + Bing verification; we build IndexNow webhook |
| Client control | All content-level SEO via Strapi (Strapi-managed pages) or Manager dashboard (NestJS courses). System-level (JSON-LD, hreflang, sitemap, robots) auto-generated. |

## Current state (audit summary)

- 13 single-type pages already have flat `metaTitle`, `metaDescription`, `ogImage` fields (i18n-localized) — but Next.js never reads them.
- No `keywords` field exists anywhere.
- No `generateMetadata()` on any dynamic route — only hardcoded `export const metadata` on a few static pages, plus a global fallback in root `layout.tsx`.
- No sitemap. No `robots.ts`. Default Strapi `robots.txt` is empty.
- No JSON-LD structured data anywhere.
- No hreflang — `/en/about` and `/ar/about` get identical metadata.
- No breadcrumbs.
- Courses live in NestJS DB, not Strapi — zero SEO schema there.
- Blog posts (`blog-post`, `blog-category`) have title + slug only — no SEO fields.

## Implementation phases

### Phase 1 — Strapi `shared/seo` component + per-page noindex

1. Create `strapi/src/components/shared/seo.json` with i18n-localized fields:
   - `metaTitle` (string, ≤150)
   - `metaDescription` (text, ≤300)
   - `keywords` (string, ≤500) — comma-separated
   - `ogImage` (media)
   - `ogTitle` (string, optional override; falls back to metaTitle)
   - `ogDescription` (text, optional override; falls back to metaDescription)
   - `canonicalUrl` (string, optional override)
   - `noindex` (boolean, default false) — per-page robots meta
   - `twitterCard` (enum: `summary` | `summary_large_image`, default `summary_large_image`)
2. Add the component as `seo` (single, not required) on:
   - Existing pages: `home-page`, `about-page`, `contact-page`, `faq-page`, `blogs-page`, `certifications-page`, `become-trainer-page`, `feedback-page`, `instructors-page`, `partners-page`, `privacy-policy-page`, `terms-page`, `learning-policies-page`, `nelc-page`, `page` (collection)
   - **New**: `blog-post`, `blog-category`, `courses-page`, `course-detail-page`
3. Keep existing flat fields during transition; cleanup PR removes them after data migration verified.

### Phase 2 — Strapi data migration (one-time)

1. Idempotent Node script: for each row in each affected collection (per locale), if `seo` is empty AND flat fields have values, populate `seo.metaTitle/metaDescription/ogImage` from the flat fields.
2. Run via `apply-single-migration.cjs`-style helper.
3. Verify in Strapi admin → cleanup PR removes flat fields.

### Phase 3 — Courses (NestJS)

1. Drizzle schema on `courses`:
   - `seo_title VARCHAR(150)`
   - `seo_description VARCHAR(300)`
   - `seo_keywords VARCHAR(500)`
   - `seo_og_image VARCHAR(500)`
   - `seo_noindex BOOLEAN DEFAULT FALSE`
2. Idempotent `apply-course-seo-fields.sql` migration.
3. DTO updates on `create-course.dto.ts` + `update-course.dto.ts`.
4. Manager course edit form (`EditCourseContent.tsx`): new collapsible "SEO" section.
5. `findOnePublic` returns SEO fields nested under `seo`.
6. Auto-fallback wired in metadata helper (Phase 4): empty `seo_title` → `course.title`, etc.

### Phase 4 — Next.js metadata wiring

1. `frontend/src/lib/seo.ts` — `buildMetadata(seo, fallbacks, locale, path)`:
   - Priority: page `seo` → entity defaults (course.title etc.) → site-setting defaults → global DEFAULT_TITLE
   - Returns Next `Metadata` (title, description, keywords, openGraph, twitter, robots, alternates)
   - Locale-aware: `alternates.languages` populated with the same path under both `/en` and `/ar`
   - Honors `seo.noindex` → `robots: { index: false, follow: false }`
   - Canonical = `seo.canonicalUrl` || computed absolute URL for the locale
2. Add `generateMetadata()` to every page route:
   - Static pages: `[locale]/about/page.tsx`, `contact`, `faq`, `feedback`, `partners`, `nelc`, `terms`, `privacy-policy`, `learning-policies`, `certifications`, `become-trainer`, `instructors`, `blogs`, `courses`, `archived`, `home`
   - Dynamic: `[locale]/courses/[slug]`, `[locale]/blogs/[slug]`, `[locale]/blogs/category/[slug]`, `[locale]/[...slug]` (catch-all)
3. Replace existing `export const metadata = {...}` with `generateMetadata`.

### Phase 5 — Sitemap + robots

1. `frontend/src/app/sitemap.ts`:
   - Static routes (one entry per locale per route)
   - Every published Strapi page (page collection) per locale
   - Every active course per locale
   - Every published blog post + blog category per locale
   - `<xhtml:link rel="alternate">` between en/ar variants of each URL
   - `lastModified` from `updatedAt`
   - Cache 1 hour (`revalidate = 3600`)
2. `frontend/src/app/robots.ts`:
   - `Allow: /`
   - `Disallow: /dashboard`, `/api`, `/_next`, `/signin`, `/signup`, `/forgot-password`, `/verify`
   - `Sitemap: https://physioguidance.org/sitemap.xml`

### Phase 6 — Strapi populate query updates

`frontend/src/lib/strapi/api.ts`: add `populate[seo][populate]=*` to every page fetcher so the new component's media (`ogImage`) is hydrated.

### Phase 7 — JSON-LD structured data

1. Helper `frontend/src/lib/structured-data.ts` exporting builders:
   - `organizationLD()` — sitewide, in root layout
   - `breadcrumbLD(items)` — every detail page
   - `courseLD(course, instructor, ratings)` — `Course` schema with rating, instructor `Person`, price `Offer`, duration
   - `articleLD(post, author)` — `Article` schema for blog posts
   - `eventLD(session, course)` — `Event` for live course sessions
   - `faqPageLD(items)` — for FAQ page
   - `personLD(instructor)` — for instructor profiles (if/when public profile pages exist)
2. Each builder returns a `<script type="application/ld+json">` JSX node.
3. Server-rendered (no client JS) — pages emit them inline.
4. Validate every builder against schema.org with a runtime sanity check (no broken refs).

### Phase 8 — hreflang + canonical

1. Built into `buildMetadata` via `alternates.languages` (Phase 4).
2. Sitemap also lists alternates as `xhtml:link` per URL (Phase 5).
3. `x-default` → English version of every page.

### Phase 9 — Breadcrumbs

1. New shared component `components/shared/Breadcrumb.tsx`:
   - Visual breadcrumb above the page heading on detail pages
   - Server-renders the matching `BreadcrumbList` JSON-LD inline
2. Mount on:
   - Course detail (`Home > Courses > {course.title}`)
   - Blog post (`Home > Blog > {post.title}`)
   - Catch-all `[...slug]` pages with breadcrumb derived from path segments
   - Optionally archived courses page

### Phase 10 — Image SEO

1. Audit: every `<Image>` instance must have a non-empty `alt`. Run `Grep` for `alt=""` and review.
2. OG image enforcement: `seo.ogImage` rendered at 1200×630. If a manager uploads a smaller image, log a warning in the Strapi UI (use Strapi `before-create` hook or just doc).
3. Image sitemap: separate `app/sitemap-images.xml/route.ts` listing course thumbnails + blog cover images per locale.
4. Verify Next/Image is generating WebP/AVIF (it is by default — confirm config doesn't disable it).

### Phase 11 — IndexNow webhook

1. Strapi lifecycle hooks (`api/{collection}/content-types/{collection}/lifecycles.js`):
   - `afterCreate`, `afterUpdate`, `afterPublish` → POST to IndexNow API
2. Generate IndexNow key, host at `frontend/public/{key}.txt` (Bing requirement).
3. Webhook payload: list of changed URLs (per locale).
4. Targets: Bing + Yandex (free, no auth needed beyond key).
5. Add to: `blog-post`, `course` (NestJS — separate hook), `page`, all single-type pages.

### Phase 12 — Per-page noindex enforcement

Already covered in Phase 4 (metadata.robots) and Phase 1 (Strapi schema field). Verification step: Lighthouse audit confirms `<meta name="robots" content="noindex">` on test page.

## Implementation order (recommended)

Each row = one deploy. Approximately 7–9 deploys, 1–2 weeks of work.

| # | Deploy | Phases | Risk |
|---|---|---|---|
| 1 | Strapi schema + populate | 1, 6 | Low — additive component, no data loss |
| 2 | Data migration script (one-shot) | 2 | Medium — touches every page row |
| 3 | NestJS courses SEO | 3 | Low — column adds, idempotent migration |
| 4 | Frontend `lib/seo.ts` + `generateMetadata` everywhere | 4 | Low — read-only metadata |
| 5 | Sitemap + robots | 5 | Low — new routes |
| 6 | JSON-LD + hreflang + canonical | 7, 8 | Low — additive |
| 7 | Breadcrumbs | 9 | Low — new visual |
| 8 | Image alts audit + image sitemap | 10 | Medium — audit may surface real-content issues |
| 9 | IndexNow webhook | 11 | Low — best-effort, fails silently |

## Out of scope

- Performance / Core Web Vitals fixes (separate audit pass)
- Schema.org expansion beyond the listed types (Recipe, Product, Job, etc. — not relevant)
- Multi-region hreflang beyond en/ar
- Server-side A/B testing of meta titles
- Marketing content / keyword research / link building (not technical work)

## Risks + mitigations

- **Strapi schema bugs** crash the admin → validate JSON locally before each schema deploy; deploy schema-only changes separately from data migrations.
- **Sitemap timeout** if catalog grows → 1h cache from start; switch to ISR if a sitemap fetch ever exceeds 5s.
- **JSON-LD shape errors** (missing required fields) → unit-test each builder against a fixture; Google Search Console will report errors after launch — fix in a follow-up.
- **IndexNow noisy** if many edits → batch by 30s window; never let webhook failures block the publish.

## Success criteria

- Lighthouse SEO score ≥ 95 on every public page (sample: home, courses, course detail, blog, blog post, about)
- Google Rich Results Test passes on: home (Organization), course detail (Course + BreadcrumbList), blog post (Article + BreadcrumbList), FAQ page (FAQPage)
- Search Console: 0 indexing errors, sitemap accepted, hreflang reported clean
- Manager can edit any page's SEO from Strapi (or NestJS for courses) and see it reflected in the next page render
