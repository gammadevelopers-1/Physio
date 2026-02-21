import { registerAs } from '@nestjs/config';

export default registerAs('processing', () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
  },
  ffmpeg: {
    enabled: process.env.FFMPEG_ENABLED !== 'false',
    resolutions: [
      { label: '360p', width: 640, height: 360, videoBitrate: '800k', audioBitrate: '96k' },
      { label: '720p', width: 1280, height: 720, videoBitrate: '2500k', audioBitrate: '128k' },
      { label: '1080p', width: 1920, height: 1080, videoBitrate: '5000k', audioBitrate: '192k' },
    ],
  },
  tempDir: process.env.PROCESSING_TEMP_DIR || '/tmp/physio-processing',
  retries: {
    transcoding: parseInt(process.env.TRANSCODING_RETRIES || '2', 10),
    captions: parseInt(process.env.CAPTIONS_RETRIES || '3', 10),
    wcag: parseInt(process.env.WCAG_RETRIES || '2', 10),
  },
}));
