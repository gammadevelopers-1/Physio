export const QUEUE_NAMES = {
  TRANSCODING: 'material-transcoding',
  CAPTIONS: 'material-captions',
  TRANSCRIPT: 'material-transcript',
  WCAG: 'material-wcag',
} as const;

export const JOB_NAMES = {
  TRANSCODE_VIDEO: 'transcode-video',
  GENERATE_CAPTIONS: 'generate-captions',
  GENERATE_TRANSCRIPT: 'generate-transcript',
  CHECK_WCAG: 'check-wcag',
} as const;

export const PROCESSING_STEPS = {
  TRANSCODING: 'transcoding',
  EXTRACTING_AUDIO: 'extracting_audio',
  GENERATING_CAPTIONS: 'generating_captions',
  GENERATING_TRANSCRIPT: 'generating_transcript',
  WCAG_CHECK: 'wcag_check',
  COMPLETE: 'complete',
} as const;
