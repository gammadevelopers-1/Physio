import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Belt-and-suspenders for raw-key bugs. The build-time
    // `npm run check:i18n` should catch missing keys before we get here.
    // If one still slips through, dev gets a visible ⚠️ marker so the
    // bug is obvious in the browser; prod falls back to next-intl's
    // default (the key) so layouts don't crash.
    onError(error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[i18n]', error.message);
      }
    },
    getMessageFallback({ key, namespace }) {
      const path = [namespace, key].filter(Boolean).join('.');
      if (process.env.NODE_ENV !== 'production') {
        return `⚠️${path}`;
      }
      return path;
    },
  };
});
