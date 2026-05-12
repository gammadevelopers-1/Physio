/**
 * Image sitemap (sitemap-images.xml).
 *
 * Per Google's image-sitemap protocol, each <url> can list one or more
 * <image:image> entries. We emit:
 *   - course thumbnails on /courses/:id (per locale)
 *   - blog post main images on /blogs/:slug (per locale)
 *
 * Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 */

import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/seo';
import { getBlogPosts, getStrapiMediaUrl } from '@/lib/strapi';

export const revalidate = 3600;

const BACKEND_API_URL =
  process.env.BACKEND_API_URL || 'http://physio-backend:8080/api';

const LOCALES = ['en', 'ar'] as const;

interface PublicCourseListItem {
  id: string;
  title?: string | null;
  titleAr?: string | null;
  thumbnail?: string | null;
}

async function fetchAllPublicCourses(): Promise<PublicCourseListItem[]> {
  const all = new Map<string, PublicCourseListItem>();
  for (const scope of ['open', 'archived'] as const) {
    let page = 1;
    while (true) {
      try {
        const url = `${BACKEND_API_URL}/courses/public?scope=${scope}&page=${page}&limit=100`;
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          next: { revalidate: 3600 },
        });
        if (!res.ok) break;
        const body = (await res.json()) as { data?: PublicCourseListItem[]; totalPages?: number };
        for (const c of body.data || []) {
          if (c.id) all.set(c.id, c);
        }
        const totalPages = body.totalPages || 1;
        if (page >= totalPages) break;
        page += 1;
      } catch {
        break;
      }
    }
  }
  return [...all.values()];
}

/** XML-escape a string. Keep tight — image URLs and titles only. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteImageUrl(maybe: string | null | undefined): string | null {
  if (!maybe) return null;
  if (/^https?:\/\//i.test(maybe)) return maybe;
  // Treat as a Strapi media path.
  return getStrapiMediaUrl(maybe);
}

export async function GET() {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  );

  // 1. Courses — thumbnail per locale.
  const courses = await fetchAllPublicCourses().catch(() => [] as PublicCourseListItem[]);
  for (const c of courses) {
    const thumb = absoluteImageUrl(c.thumbnail);
    if (!thumb) continue;
    for (const locale of LOCALES) {
      const title = (locale === 'ar' && c.titleAr) || c.title || '';
      const pageUrl = `${SITE_URL}/${locale}/courses/${c.id}`;
      lines.push('  <url>');
      lines.push(`    <loc>${xmlEscape(pageUrl)}</loc>`);
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${xmlEscape(thumb)}</image:loc>`);
      if (title) lines.push(`      <image:title>${xmlEscape(title)}</image:title>`);
      lines.push('    </image:image>');
      lines.push('  </url>');
    }
  }

  // 2. Blog posts — main image per locale.
  for (const locale of LOCALES) {
    const posts = await getBlogPosts(locale).catch(() => []);
    for (const post of posts) {
      if (!post.slug || !post.mainImage?.url) continue;
      const img = absoluteImageUrl(post.mainImage.url);
      if (!img) continue;
      const pageUrl = `${SITE_URL}/${locale}/blogs/${post.slug}`;
      lines.push('  <url>');
      lines.push(`    <loc>${xmlEscape(pageUrl)}</loc>`);
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${xmlEscape(img)}</image:loc>`);
      if (post.title) lines.push(`      <image:title>${xmlEscape(post.title)}</image:title>`);
      if (post.mainImage.alternativeText) {
        lines.push(`      <image:caption>${xmlEscape(post.mainImage.alternativeText)}</image:caption>`);
      }
      lines.push('    </image:image>');
      lines.push('  </url>');
    }
  }

  lines.push('</urlset>');

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
