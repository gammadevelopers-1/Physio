export default ({ env }: { env: (key: string, defaultValue?: unknown) => string | undefined }) => ({
  i18n: {
    enabled: true,
    config: {
      defaultLocale: 'en',
      locales: ['en', 'ar'],
    },
  },

  // Upload provider: Google Cloud Storage.
  // On Cloud Run we must NOT use local disk — the container filesystem is
  // ephemeral, so files would vanish on every cold start, deploy or scale event.
  // The provider uses Application Default Credentials from the Cloud Run service
  // account, so no key file is needed in production.
  upload: {
    config: {
      provider: '@strapi-community/strapi-provider-upload-google-cloud-storage',
      providerOptions: {
        bucketName: env('GCS_BUCKET_NAME') ?? 'physioguidance-cms',
        basePath: env('GCS_BASE_PATH') ?? '',
        baseUrl: env('GCS_BASE_URL'), // optional CDN override; undefined → direct GCS URL
        publicFiles: (env('GCS_PUBLIC_FILES') ?? 'true') === 'true',
        uniform: (env('GCS_UNIFORM_ACCESS') ?? 'true') === 'true',
      },
    },
  },
});
