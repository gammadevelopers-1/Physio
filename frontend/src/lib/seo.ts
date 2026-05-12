import type { Metadata } from 'next';
import type { SeoComponent, StrapiMedia } from './strapi/types';
import { getStrapiMediaUrl } from './strapi/client';

/** Public site origin used to build absolute URLs (canonical, hreflang,
 *  OG images). Fallback covers local dev / build-time. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://physioguidance.org'
).replace(/\/+$/, '');

export const DEFAULT_TITLE = 'PhysioGuidance - Health Training & eLearning Courses';
export const DEFAULT_DESCRIPTION =
  'Delivering NELC-compliant training, accredited programs, and live learning experiences for the health sector.';

const SUPPORTED_LOCALES = ['en', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export interface SeoFallbacks {
  title?: string | null;
  description?: string | null;
  /** Absolute URL OR a Strapi media path (resolved via getStrapiMediaUrl). */
  image?: string | null;
  imageAlt?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface BuildMetadataOptions {
  /** Per-page SEO override (Strapi shared.seo OR course.seo). */
  seo?: SeoComponent | null;
  /** Entity defaults (course.title, blog.title, page heading…). */
  fallbacks?: SeoFallbacks;
  /** Current locale ('en' or 'ar'). */
  locale: string;
  /** Path WITHOUT locale prefix, e.g. '/about', '/courses/{id}'. */
  path: string;
  /** Optional site-wide settings — used for ogImage fallback if entity has none. */
  siteOgImageUrl?: string | null;
  /** Optional override for the absolute site origin. */
  siteUrl?: string;
}

/** Strip leading slashes so `joinUrl` is well-defined. */
const trimSlashes = (s: string) => s.replace(/^\/+|\/+$/g, '');

const joinUrl = (base: string, ...parts: string[]) =>
  [base.replace(/\/+$/, ''), ...parts.map(trimSlashes).filter(Boolean)].join('/');

/** Resolve a media URL — accepts absolute URLs, Strapi media paths, or
 *  relative URLs. Returns null when input is empty. */
function resolveImageUrl(input: string | StrapiMedia | null | undefined): string | null {
  if (!input) return null;
  if (typeof input === 'string') {
    if (/^https?:\/\//i.test(input)) return input;
    return getStrapiMediaUrl(input);
  }
  // StrapiMedia object
  return getStrapiMediaUrl(input.url);
}

/**
 * Build a Next.js `Metadata` object from a Strapi/NestJS SEO component +
 * entity-level fallbacks. Resolution priority (per field):
 *   seo.* → fallbacks.* → site default
 *
 * Always emits `alternates.languages` (en, ar, x-default) for hreflang.
 * Honors `seo.noindex` → robots noindex+nofollow.
 */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const { seo, fallbacks, locale, path, siteOgImageUrl, siteUrl } = opts;
  const origin = (siteUrl || SITE_URL).replace(/\/+$/, '');

  const title = seo?.metaTitle || fallbacks?.title || DEFAULT_TITLE;
  const description = seo?.metaDescription || fallbacks?.description || DEFAULT_DESCRIPTION;
  const ogTitle = seo?.ogTitle || title;
  const ogDescription = seo?.ogDescription || description;

  const keywords = seo?.keywords
    ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : undefined;

  const ogImageUrl =
    resolveImageUrl(seo?.ogImage as StrapiMedia | string | null | undefined) ||
    resolveImageUrl(fallbacks?.image) ||
    (siteOgImageUrl || null);

  // Hreflang — every page exists at /en/{path} AND /ar/{path}.
  const cleanPath = trimSlashes(path);
  const languages: Record<string, string> = {};
  for (const lang of SUPPORTED_LOCALES) {
    languages[lang] = cleanPath ? joinUrl(origin, lang, cleanPath) : joinUrl(origin, lang);
  }
  // x-default → English variant.
  languages['x-default'] = languages.en;

  const canonical =
    seo?.canonicalUrl ||
    (cleanPath ? joinUrl(origin, locale, cleanPath) : joinUrl(origin, locale));

  const noindex = !!seo?.noindex;

  const meta: Metadata = {
    title,
    description,
    keywords,
    metadataBase: new URL(origin),
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      type: 'website',
      title: ogTitle,
      description: ogDescription,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      siteName: 'PhysioGuidance',
      url: canonical,
      ...(ogImageUrl
        ? {
            images: [
              {
                url: ogImageUrl,
                width: fallbacks?.imageWidth || 1200,
                height: fallbacks?.imageHeight || 630,
                alt: fallbacks?.imageAlt || ogTitle,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: seo?.twitterCard || 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
    ...(noindex
      ? { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }
      : {}),
  };

  return meta;
}

/** Normalize an arbitrary locale string to a supported one ('en' | 'ar'). */
export function normalizeLocale(locale: string): Locale {
  return locale === 'ar' ? 'ar' : 'en';
}

/** Convenience wrapper for Strapi single-type pages. Pulls site-wide
 *  ogImage in parallel and threads it as the final image fallback. */
export async function buildPageMetadata(args: {
  locale: string;
  path: string;
  page:
    | (
        | {
            seo?: SeoComponent | null;
            heroTitle?: string | null;
            heroDescription?: string | null;
            heroImage?: StrapiMedia | null;
            title?: string | null;
            description?: string | null;
          }
        | null
        | undefined
      );
  siteOgImageUrl?: string | null;
  /** Optional explicit fallbacks (override page.* derivation). */
  override?: SeoFallbacks;
}): Promise<Metadata> {
  const { locale, path, page, siteOgImageUrl, override } = args;
  // Fallback chain: page.heroTitle → page.title → DEFAULT. The legacy flat
  // metaTitle/metaDescription/ogImage columns were removed from Strapi after
  // their values were migrated into the shared.seo component.
  const fallbacks: SeoFallbacks = override ?? {
    title: page?.heroTitle || page?.title || null,
    description: page?.heroDescription || page?.description || null,
    image: (page?.heroImage as StrapiMedia | null)?.url || null,
    imageAlt: (page?.heroImage as StrapiMedia | null)?.alternativeText || null,
    imageWidth: (page?.heroImage as StrapiMedia | null)?.width || null,
    imageHeight: (page?.heroImage as StrapiMedia | null)?.height || null,
  };
  return buildMetadata({
    seo: page?.seo,
    fallbacks,
    locale,
    path,
    siteOgImageUrl: siteOgImageUrl || null,
  });
}
