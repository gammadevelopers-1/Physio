import { Injectable, Logger } from '@nestjs/common';

/**
 * Minimal subset of Strapi's site-setting single type that we need server-side
 * (currently only for PDF rendering — invoices, proformas, certificates).
 * Keep this narrow; the frontend already pulls the full payload elsewhere.
 */
export interface SiteBranding {
  siteNameEn: string;
  siteNameAr: string;
  vatNumber: string | null;
  commercialRegistrationNumber: string | null;
  nelcLicenseNumber: string | null;
  nelcLicenseText: string | null;
}

const FALLBACK: SiteBranding = {
  siteNameEn: 'PhysioGuidance',
  siteNameAr: 'فيزيو جايدنس',
  vatNumber: null,
  commercialRegistrationNumber: null,
  nelcLicenseNumber: null,
  nelcLicenseText: null,
};

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetches branding info from Strapi for backend-rendered artifacts (PDFs,
 * emails). Strapi is single-source-of-truth for siteName etc; we cache for
 * 5 minutes to avoid hammering it on every PDF render, and we fall back to
 * hardcoded defaults if Strapi is unreachable so PDF rendering never blocks.
 *
 * The frontend already fetches site-settings directly for navbar/footer; this
 * service exists because Cloud Run backend can't share that fetch.
 */
@Injectable()
export class SiteSettingsService {
  private readonly logger = new Logger(SiteSettingsService.name);
  private cache: { value: SiteBranding; expiresAt: number } | null = null;

  async getBranding(): Promise<SiteBranding> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    const strapiUrl = process.env.STRAPI_URL;
    if (!strapiUrl) {
      this.logger.warn('STRAPI_URL not set — using fallback branding');
      return FALLBACK;
    }

    try {
      const [en, ar] = await Promise.all([
        this.fetchSiteSetting(strapiUrl, 'en'),
        this.fetchSiteSetting(strapiUrl, 'ar'),
      ]);

      const branding: SiteBranding = {
        siteNameEn: en?.siteName || FALLBACK.siteNameEn,
        siteNameAr: ar?.siteName || FALLBACK.siteNameAr,
        vatNumber: en?.vatNumber ?? null,
        commercialRegistrationNumber: en?.commercialRegistrationNumber ?? null,
        nelcLicenseNumber: en?.nelcLicenseNumber ?? null,
        nelcLicenseText: en?.nelcLicenseText ?? null,
      };

      this.cache = { value: branding, expiresAt: now + CACHE_TTL_MS };
      return branding;
    } catch (err) {
      this.logger.warn(
        `Strapi branding fetch failed (${err instanceof Error ? err.message : 'unknown'}) — using fallback`,
      );
      return FALLBACK;
    }
  }

  private async fetchSiteSetting(
    baseUrl: string,
    locale: 'en' | 'ar',
  ): Promise<{
    siteName?: string;
    vatNumber?: string | null;
    commercialRegistrationNumber?: string | null;
    nelcLicenseNumber?: string | null;
    nelcLicenseText?: string | null;
  } | null> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/site-setting?locale=${locale}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.STRAPI_API_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.STRAPI_API_TOKEN}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Strapi ${locale} returned ${res.status}`);
    }
    const body = (await res.json()) as { data?: Record<string, unknown> | null };
    return (body.data as any) ?? null;
  }
}
