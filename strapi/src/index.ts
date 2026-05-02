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

    // Grant Public role read access to api::profession.profession (find/findOne)
    // so the Become-a-Trainer form can fetch the cascade without auth.
    const publicRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'public' } });
    if (publicRole) {
      const desired = [
        'api::profession.profession.find',
        'api::profession.profession.findOne',
      ];
      for (const action of desired) {
        const exists = await strapi.db
          .query('plugin::users-permissions.permission')
          .findOne({ where: { action, role: publicRole.id } });
        if (!exists) {
          await strapi.db
            .query('plugin::users-permissions.permission')
            .create({ data: { action, role: publicRole.id } });
          strapi.log.info(`Granted Public role: ${action}`);
        }
      }
    }
  },
};
