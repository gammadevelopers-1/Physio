import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

// Static security headers applied to every response. The Content-Security-Policy
// is intentionally NOT here — it is nonce-based and set per-request in
// middleware.ts (a static config can't carry a per-request nonce). HSTS is
// production-only so http://localhost keeps working in dev.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker/Cloud Run deployment
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Hardening headers on every route (CSP added separately in middleware).
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Maintenance page must never be cached — the moment admin flips the
        // toggle off, the next request should hit the real site, not a stale
        // "we're down" HTML stuck in the browser / CDN.
        source: "/:locale/maintenance",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080",
        pathname: "/api/storage/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "1337",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8080",
        pathname: "/api/storage/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.physioguidance.org",
        pathname: "/api/storage/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cms.physioguidance.org",
        pathname: "/uploads/**",
      },
    ],
  },
};

const baseConfig = withNextIntl(nextConfig);

// Sentry build-time wrapper. Uploads source maps to the EU Sentry project
// after `next build` so production stack traces show original TypeScript
// line numbers. Skipped automatically if SENTRY_AUTH_TOKEN is unset, so
// local `next build` without prod creds still succeeds.
export default withSentryConfig(baseConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Silence the source-map upload chatter when there's no token (local dev).
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Strip the uploaded source maps from the public bundle so we don't ship
  // them to browsers (they're already in Sentry for our use).
  sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },

  // Avoid touching the Vercel-only ad-blocker bypass route.
  disableLogger: true,

  // Reduce bundle size — tree-shake debug-only Sentry code in prod.
  reactComponentAnnotation: { enabled: false },

  // Don't fail the build if Sentry's API is down at deploy time.
  errorHandler: (err) => {
    // eslint-disable-next-line no-console
    console.warn("[sentry] source-map upload failed (non-fatal):", err.message);
  },
});
