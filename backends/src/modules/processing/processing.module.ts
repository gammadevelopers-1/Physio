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
import { ProcessingCleanupService } from './processing-cleanup.service';
import { StorageModule } from '../storage/storage.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';

const redisEnabled = !!process.env.REDIS_HOST;

@Module({
  imports: [
    StorageModule,
    UserNotificationsModule,

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
    // Only register processors when Redis is available
    ...(redisEnabled
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
  ],
  exports: [ProcessingService],
})
export class ProcessingModule {}
