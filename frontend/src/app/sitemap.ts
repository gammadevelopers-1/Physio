import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import {
  getAllPagesIndex,
  getBlogPosts,
  getBlogCategories,
} from '@/lib/strapi';

/** Cache for an hour. The sitemap re-renders on demand after that. */
export const revalidate = 3600;

const LOCALES = ['en', 'ar'] as const;
type Locale = (typeof LOCALES)[number];

/** Static public-facing routes (no locale prefix). Auth/checkout/verify
 *  pages are intentionally excluded — they are not indexable. */
const STATIC_PATHS: string[] = [
  '',
  '/about',
  '/become-trainer',
  '/blogs',
  '/certifications',
  '/contact',
  '/courses',
  '/archived',
  '/faq',
  '/feedback',
  '/instructors',
  '/nelc',
  '/partners',
  '/policies',
  '/privacy',
  '/terms',
];

/** Build the language-alternate map used by every sitemap entry. */
function buildLanguages(path: string): Record<string, string> {
  const cleanPath = path.replace(/^\/+/, '');
  const map: Record<string, string> = {};
  for (const lang of LOCALES) {
    map[lang] = cleanPath
      ? `${SITE_URL}/${lang}/${cleanPath}`
      : `${SITE_URL}/${lang}`;
  }
  // x-default → English
  map['x-default'] = map.en;
  return map;
}

function buildEntry(
  path: string,
  locale: Locale,
  lastModified?: Date,
  priority?: number,
  changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency'],
): MetadataRoute.Sitemap[number] {
  const cleanPath = path.replace(/^\/+/, '');
  const url = cleanPath
    ? `${SITE_URL}/${locale}/${cleanPath}`
    : `${SITE_URL}/${locale}`;
  return {
    url,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages: buildLanguages(path) },
  };
}

const BACKEND_API_URL =
  process.env.BACKEND_API_URL || 'http://physio-backend:8080/api';

interface PublicCourseListItem {
  id: string;
}

async function fetchAllPublicCourseIds(): Promise<string[]> {
  const ids = new Set<string>();
  for (const scope of ['open', 'archived'] as const) {
    let page = 1;
    while (true) {
      try {
        const url = `${BACKEND_API_URL}/courses/public?scope=${scope}&page=${page}&limit=100`;
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          // Cache same-window so multiple sitemap fetches don't hammer DB.
          next: { revalidate: 3600 },
        });
        if (!res.ok) break;
        const body = (await res.json()) as { data?: PublicCourseListItem[]; totalPages?: number };
        for (const c of body.data || []) {
          if (c.id) ids.add(c.id);
        }
        const totalPages = body.totalPages || 1;
        if (page >= totalPages) break;
        page += 1;
      } catch {
        break;
      }
    }
  }
  return [...ids];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  // 1. Static routes — one entry per locale per route.
  for (const path of STATIC_PATHS) {
    for (const locale of LOCALES) {
      // Home gets the highest priority; everything else 0.7.
      const priority = path === '' ? 1.0 : 0.7;
      const changeFrequency = path === '' ? 'daily' : 'weekly';
      entries.push(buildEntry(path, locale, now, priority, changeFrequency));
    }
  }

  // 2. Strapi `pages` collection — every published page per locale.
  const pagesByLocale = await Promise.all(
    LOCALES.map((l) => getAllPagesIndex(l).catch(() => [])),
  );
  pagesByLocale.forEach((pages, idx) => {
    const locale = LOCALES[idx];
    for (const p of pages) {
      const lastModified = p.updatedAt ? new Date(p.updatedAt) : undefined;
      entries.push(buildEntry(`/${p.slug}`, locale, lastModified, 0.6, 'weekly'));
    }
  });

  // 3. Public courses — one entry per course per locale. The route is
  //    /courses/{id} on both locales, so hreflang covers the full set.
  try {
    const courseIds = await fetchAllPublicCourseIds();
    for (const id of courseIds) {
      for (const locale of LOCALES) {
        entries.push(buildEntry(`/courses/${id}`, locale, now, 0.8, 'weekly'));
      }
    }
  } catch {
    // Don't fail the whole sitemap if backend is unreachable.
  }

  // 4. Blog posts + categories per locale.
  const [postsEn, postsAr, catsEn, catsAr] = await Promise.all([
    getBlogPosts('en').catch(() => []),
    getBlogPosts('ar').catch(() => []),
    getBlogCategories('en').catch(() => []),
    getBlogCategories('ar').catch(() => []),
  ]);
  const postsByLocale: Record<Locale, typeof postsEn> = { en: postsEn, ar: postsAr };
  const catsByLocale: Record<Locale, typeof catsEn> = { en: catsEn, ar: catsAr };
  for (const locale of LOCALES) {
    for (const post of postsByLocale[locale]) {
      if (!post.slug) continue;
      const lastModified = post.updatedAt ? new Date(post.updatedAt) : undefined;
      entries.push(buildEntry(`/blogs/${post.slug}`, locale, lastModified, 0.6, 'weekly'));
    }
    for (const cat of catsByLocale[locale]) {
      if (!cat.slug) continue;
      const lastModified = cat.updatedAt ? new Date(cat.updatedAt) : undefined;
      entries.push(buildEntry(`/blogs/category/${cat.slug}`, locale, lastModified, 0.5, 'monthly'));
    }
  }

  return entries;
}
