import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Auth flows, dashboards, internal API routes, and the Next runtime
        // are not indexable. Verification pages are also kept out of the
        // index to avoid surfacing personal certificates.
        disallow: [
          '/api/',
          '/_next/',
          '/dashboard/',
          '/signin',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/set-password',
          '/verify',
          '/checkout',
        ],
      },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/sitemap-images.xml`],
    host: SITE_URL,
  };
}
