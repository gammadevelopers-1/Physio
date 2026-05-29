import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
  // Force Secure on the NEXT_LOCALE cookie in production. The LB terminates
  // TLS and forwards to Cloud Run over plain HTTP, so next-intl can't infer
  // HTTPS on its own and would otherwise omit the flag (Observatory -5).
  localeCookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
});

export type Locale = (typeof routing.locales)[number];
