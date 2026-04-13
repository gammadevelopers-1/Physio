import type { Core } from '@strapi/strapi';

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Auto-create Arabic locale if it doesn't exist
    const localeService = strapi.plugin('i18n').service('locales');
    const existingLocales = await localeService.find();
    const hasArabic = existingLocales.some(
      (l: { code: string }) => l.code === 'ar'
    );
    if (!hasArabic) {
      await localeService.create({ code: 'ar', name: 'Arabic (ar)' });
      strapi.log.info('Created Arabic (ar) locale');
    }
  },
};
