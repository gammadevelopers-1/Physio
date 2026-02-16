import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  // Driver: 'gcp' for Google Cloud Storage, 'local' for filesystem (dev)
  driver: process.env.STORAGE_DRIVER || 'local',

  // Local uploads directory (used when driver=local)
  localDir: process.env.STORAGE_LOCAL_DIR || './uploads',

  // GCP Project
  projectId: process.env.GCP_PROJECT_ID || 'physioguidance',

  // Storage buckets
  buckets: {
    // Public assets (course images, blog images)
    public: process.env.STORAGE_BUCKET_PUBLIC || 'physioguidance-public',
    // Private files (user uploads, certificates)
    private: process.env.STORAGE_BUCKET_PRIVATE || 'physioguidance-private',
    // Trainer documents (resumes, certifications)
    trainers: process.env.STORAGE_BUCKET_TRAINERS || 'physioguidance-trainers',
  },

  // Signed URL expiration (in minutes)
  signedUrlExpiration: parseInt(process.env.STORAGE_SIGNED_URL_EXPIRATION || '60', 10),
}));
