import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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

export default withNextIntl(nextConfig);
