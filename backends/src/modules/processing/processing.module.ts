import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './constants';
import { ProcessingService } from './processing.service';
import { TranscodingProcessor } from './processors/transcoding.processor';
import { CaptionsProcessor } from './processors/captions.processor';
import { TranscriptProcessor } from './processors/transcript.processor';
import { WcagProcessor } from './processors/wcag.processor';
import { FfmpegService } from './services/ffmpeg.service';
import { WhisperService } from './services/whisper.service';
import { WcagService } from './services/wcag.service';
import { CloudRunJobsService } from './services/cloud-run-jobs.service';
import { VideoTranscodeRunner } from './services/video-transcode.runner';
import { CaptionsRunner } from './services/captions.runner';
import { WcagRunner } from './services/wcag.runner';
import { VideoTranscodeJob } from './jobs/video-transcode.job';
import { CaptionsJob } from './jobs/captions.job';
import { WcagJob } from './jobs/wcag.job';
import { ProcessingCleanupService } from './processing-cleanup.service';
import { ProcessingCleanupJob } from './processing.jobs';
import { StorageModule } from '../storage/storage.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { AuditLogModule } from '../audit-logs/audit-logs.module';

const redisEnabled = !!process.env.REDIS_HOST;

@Module({
  imports: [
    StorageModule,
    UserNotificationsModule,
    AuditLogModule,

    // Register BullMQ queues — only when Redis is available
    ...(redisEnabled
      ? [
          BullModule.registerQueue(
            { name: QUEUE_NAMES.TRANSCODING },
            { name: QUEUE_NAMES.CAPTIONS },
            { name: QUEUE_NAMES.TRANSCRIPT },
            { name: QUEUE_NAMES.WCAG },
          ),
        ]
      : []),
  ],
  providers: [
    ProcessingService,
    CloudRunJobsService,
    VideoTranscodeRunner,
    CaptionsRunner,
    WcagRunner,
    // VideoTranscodeJob + CaptionsJob + WcagJob are ALWAYS registered
    // so main-job.ts can resolve `video.transcode` / `captions.generate`
    // / `wcag.check` via the JobRegistry inside a Cloud Run Job
    // process. Registering them on api-web + api-worker too is
    // harmless — the classes just self-register with the registry;
    // nothing calls their run() unless the process was launched as a
    // Cloud Run Job with the matching JOB_NAME env var.
    VideoTranscodeJob,
    CaptionsJob,
    WcagJob,
    // Only register BullMQ processors when Redis is available AND this
    // container is running as a BullMQ worker. When
    // SKIP_BULLMQ_WORKERS=true (set on the HTTP-serving api-web service
    // after the worker split), these classes are NOT registered — no
    // BullMQ Workers are created for these queues, so this container
    // won't consume jobs. Queue producers still work because
    // BullModule.registerQueue is unaffected by this gate.
    //
    // TranscodingProcessor + CaptionsProcessor + TranscriptProcessor
    // are included ONLY as drain catch-nets during the Cloud Run Jobs
    // migration — see comments in each *.processor.ts file. The
    // producers no longer push to these queues, so the processors
    // should stay idle in prod; safe to remove once we've verified no
    // stray jobs sit for > 24h post-migration.
    ...(redisEnabled && process.env.SKIP_BULLMQ_WORKERS !== 'true'
      ? [
          TranscodingProcessor,
          CaptionsProcessor,
          TranscriptProcessor,
          WcagProcessor,
        ]
      : []),
    FfmpegService,
    WhisperService,
    WcagService,
    ProcessingCleanupService,
    ProcessingCleanupJob,
  ],
  exports: [ProcessingService],
})
export class ProcessingModule {}
