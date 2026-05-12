import { NextRequest, NextResponse } from "next/server";

/**
 * Combined chrome fetcher for client components that need to render the
 * marketing Navbar (auth pages, dashboard fallbacks, etc.) but can't reach
 * Strapi server-side. Returns siteSettings + navbar links + footer link
 * groups in a single hop so the consumer doesn't fan out three requests.
 */

export const dynamic = "force-dynamic";

const BACKEND_STRAPI_URL =
  process.env.STRAPI_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_STRAPI_URL ||
  "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const baseHeaders = (): HeadersInit => {
  const h: HeadersInit = { Accept: "application/json" };
  if (STRAPI_API_TOKEN) h["Authorization"] = `Bearer ${STRAPI_API_TOKEN}`;
  return h;
};

async function safeFetch(url: string) {
  try {
    const res = await fetch(url, { headers: baseHeaders(), cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") || "en";

  const siteSettingsUrl = new URL(`${BACKEND_STRAPI_URL}/api/site-setting`);
  siteSettingsUrl.searchParams.set("locale", locale);
  siteSettingsUrl.searchParams.set("populate[logo]", "true");
  siteSettingsUrl.searchParams.set("populate[favicon]", "true");
  siteSettingsUrl.searchParams.set("populate[defaultOgImage]", "true");
  siteSettingsUrl.searchParams.set("populate[paymentMethods][populate][icon]", "true");

  const navUrl = (loc: string) => {
    const u = new URL(`${BACKEND_STRAPI_URL}/api/navigation-links`);
    u.searchParams.set("locale", locale);
    u.searchParams.set("filters[isActive][$eq]", "true");
    u.searchParams.set("filters[location][$eq]", loc);
    u.searchParams.set("sort[0]", "order:asc");
    u.searchParams.set("pagination[pageSize]", "100");
    return u.toString();
  };

  const [settings, navbar, fpPlatform, fpOrg, fpSupport] = await Promise.all([
    safeFetch(siteSettingsUrl.toString()),
    safeFetch(navUrl("navbar")),
    safeFetch(navUrl("footer-platform")),
    safeFetch(navUrl("footer-organization")),
    safeFetch(navUrl("footer-support")),
  ]);

  return NextResponse.json({
    siteSettings: settings?.data || null,
    navLinks: navbar?.data || [],
    footerLinks: {
      platform: fpPlatform?.data || [],
      organization: fpOrg?.data || [],
      support: fpSupport?.data || [],
    },
  });
}
