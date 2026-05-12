/**
 * JSON-LD builders for schema.org structured data.
 *
 * Each builder returns a plain object (the JSON-LD payload). Use the
 * `<JsonLd>` React component to render it as a `<script>` tag inline
 * inside a server-rendered page. Output is server-only — no client JS.
 *
 * Schema choices:
 *   - Organization     → site-wide, root layout
 *   - BreadcrumbList   → detail pages (course, blog post, dynamic page)
 *   - Course           → /courses/:id
 *   - Article          → /blogs/:slug
 *   - Event            → live sessions (zoom/onsite/blended) on course detail
 *   - FAQPage          → /faq
 *   - Person           → instructors (used inside Course; standalone optional)
 */

import { SITE_URL } from './seo';

/* ───────────────────────── Types ───────────────────────── */

export interface OrganizationOpts {
  name?: string;
  logoUrl?: string | null;
  /** Optional social links — emitted as sameAs[] */
  sameAs?: string[];
}

export interface BreadcrumbItem {
  name: string;
  /** Absolute URL or path (path is resolved against SITE_URL). */
  url: string;
}

export interface CourseInstructorLD {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  avatar?: string | null;
  email?: string | null;
  bio?: string | null;
}

export interface CourseLDOpts {
  id: string;
  /** Public canonical URL of the course detail page (already locale-prefixed). */
  url: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  language?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  totalHours?: number | null;
  price?: number | null;
  currency?: string;
  deliveryType?: 'zoom' | 'onsite' | 'blended' | 'self-paced' | string | null;
  cmeHours?: number | null;
  avgRating?: number | null;
  totalRatings?: number | null;
  instructor?: CourseInstructorLD | null;
  /** Site-wide provider/organization name (rendered inside `provider`). */
  providerName?: string;
}

export interface ArticleLDOpts {
  url: string;
  title: string;
  description?: string | null;
  image?: string | null;
  datePublished?: string | Date | null;
  dateModified?: string | Date | null;
  authorName?: string | null;
  /** Locale-aware site name (defaults to "PhysioGuidance"). */
  siteName?: string;
  /** Optional logo URL for the publisher node. */
  publisherLogoUrl?: string | null;
}

export interface EventLDOpts {
  name: string;
  description?: string | null;
  startDate: string | Date;
  /** Required when known — falls back to startDate if missing. */
  endDate?: string | Date | null;
  durationMinutes?: number | null;
  /** zoom: emits VirtualLocation. onsite: emits Place with venueAddress. */
  deliveryType?: 'zoom' | 'onsite' | 'blended' | string | null;
  venueAddress?: string | null;
  city?: string | null;
  /** URL of the parent course page for context. */
  url: string;
  /** Performer = instructor (optional). */
  instructorName?: string | null;
  organizerName?: string;
}

export interface FAQLDItem {
  question: string;
  answer: string;
}

export interface PersonLDOpts {
  name: string;
  url?: string | null;
  image?: string | null;
  jobTitle?: string | null;
  description?: string | null;
  email?: string | null;
}

/* ───────────────────────── Helpers ───────────────────────── */

const DEFAULT_ORG_NAME = 'PhysioGuidance';

function absoluteUrl(maybePath: string | null | undefined): string | null {
  if (!maybePath) return null;
  if (/^https?:\/\//i.test(maybePath)) return maybePath;
  const path = maybePath.startsWith('/') ? maybePath : `/${maybePath}`;
  return `${SITE_URL}${path}`;
}

function toIso(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return (d instanceof Date ? d : new Date(d)).toISOString();
  } catch {
    return null;
  }
}

/** ISO 8601 duration: e.g. 90 minutes → "PT1H30M". */
function durationToISO(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : (h ? '' : '0M')}`;
}

/* ───────────────────────── Builders ───────────────────────── */

export function organizationLD(opts: OrganizationOpts = {}) {
  const name = opts.name || DEFAULT_ORG_NAME;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url: SITE_URL,
  };
  const logo = absoluteUrl(opts.logoUrl);
  if (logo) ld.logo = logo;
  if (opts.sameAs && opts.sameAs.length) ld.sameAs = opts.sameAs;
  return ld;
}

export function breadcrumbLD(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function personLD(opts: PersonLDOpts) {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: opts.name,
  };
  if (opts.url) ld.url = absoluteUrl(opts.url);
  if (opts.image) ld.image = absoluteUrl(opts.image);
  if (opts.jobTitle) ld.jobTitle = opts.jobTitle;
  if (opts.description) ld.description = opts.description;
  if (opts.email) ld.email = opts.email;
  return ld;
}

export function courseLD(opts: CourseLDOpts) {
  const provider = {
    '@type': 'Organization',
    name: opts.providerName || DEFAULT_ORG_NAME,
    sameAs: SITE_URL,
  };

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: opts.title,
    url: opts.url,
    description: opts.description || undefined,
    image: absoluteUrl(opts.thumbnail) || undefined,
    inLanguage: opts.language || undefined,
    provider,
  };

  // Instructor as Person — embedded inside the Course node.
  if (opts.instructor) {
    const i = opts.instructor;
    const name =
      [i.firstName, i.lastName].filter(Boolean).join(' ').trim() ||
      [i.firstNameAr, i.lastNameAr].filter(Boolean).join(' ').trim() ||
      undefined;
    if (name) {
      ld.instructor = personLD({
        name,
        image: i.avatar || undefined,
        description: i.bio || undefined,
        email: i.email || undefined,
      });
    }
  }

  // Aggregate rating — only if there's at least one published review.
  if (opts.totalRatings && opts.totalRatings > 0 && opts.avgRating != null) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(opts.avgRating).toFixed(1),
      reviewCount: opts.totalRatings,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Offer — always present so search engines can show price + availability.
  const price = opts.price ?? 0;
  ld.offers = {
    '@type': 'Offer',
    price: String(price),
    priceCurrency: opts.currency || 'SAR',
    url: opts.url,
    availability: 'https://schema.org/InStock',
  };

  // hasCourseInstance — minimal envelope. Required by Google for proper
  // Course rich results. We use the delivery type to set courseMode.
  const courseMode =
    opts.deliveryType === 'self-paced'
      ? 'Online'
      : opts.deliveryType === 'onsite'
        ? 'Onsite'
        : opts.deliveryType === 'blended'
          ? 'Blended'
          : 'Online';

  const startIso = toIso(opts.startDate);
  const endIso = toIso(opts.endDate);
  const totalHoursIso = durationToISO((opts.totalHours || 0) * 60);

  ld.hasCourseInstance = {
    '@type': 'CourseInstance',
    courseMode,
    ...(startIso ? { startDate: startIso } : {}),
    ...(endIso ? { endDate: endIso } : {}),
    ...(totalHoursIso ? { courseWorkload: totalHoursIso } : {}),
  };

  // Strip undefined keys for a tidier payload.
  for (const key of Object.keys(ld)) {
    if (ld[key] === undefined) delete ld[key];
  }
  return ld;
}

export function articleLD(opts: ArticleLDOpts) {
  const datePublished = toIso(opts.datePublished);
  const dateModified = toIso(opts.dateModified) || datePublished;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    mainEntityOfPage: opts.url,
    url: opts.url,
    description: opts.description || undefined,
    image: absoluteUrl(opts.image) || undefined,
    datePublished: datePublished || undefined,
    dateModified: dateModified || undefined,
  };

  if (opts.authorName) {
    ld.author = { '@type': 'Person', name: opts.authorName };
  }

  ld.publisher = {
    '@type': 'Organization',
    name: opts.siteName || DEFAULT_ORG_NAME,
    ...(opts.publisherLogoUrl
      ? { logo: { '@type': 'ImageObject', url: absoluteUrl(opts.publisherLogoUrl) } }
      : {}),
  };

  for (const key of Object.keys(ld)) {
    if (ld[key] === undefined) delete ld[key];
  }
  return ld;
}

export function eventLD(opts: EventLDOpts) {
  const startIso = toIso(opts.startDate)!;
  const endIso =
    toIso(opts.endDate) ||
    (opts.durationMinutes && startIso
      ? new Date(new Date(startIso).getTime() + opts.durationMinutes * 60_000).toISOString()
      : null);

  const isVirtual =
    opts.deliveryType === 'zoom' || opts.deliveryType === 'self-paced' || opts.deliveryType === 'blended';

  const location = isVirtual
    ? {
        '@type': 'VirtualLocation',
        url: opts.url,
      }
    : opts.venueAddress
      ? {
          '@type': 'Place',
          name: opts.venueAddress,
          address: {
            '@type': 'PostalAddress',
            streetAddress: opts.venueAddress,
            ...(opts.city ? { addressLocality: opts.city } : {}),
          },
        }
      : { '@type': 'Place', name: 'TBD' };

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: opts.name,
    startDate: startIso,
    eventAttendanceMode: isVirtual
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location,
    url: opts.url,
  };
  if (endIso) ld.endDate = endIso;
  if (opts.description) ld.description = opts.description;
  if (opts.instructorName) ld.performer = { '@type': 'Person', name: opts.instructorName };
  ld.organizer = { '@type': 'Organization', name: opts.organizerName || DEFAULT_ORG_NAME, url: SITE_URL };

  return ld;
}

export function faqPageLD(items: FAQLDItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items
      .filter((i) => i.question && i.answer)
      .map((i) => ({
        '@type': 'Question',
        name: i.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: i.answer,
        },
      })),
  };
}
