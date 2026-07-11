import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZoomService } from './zoom.service';
import { ZoomMockService } from './zoom-mock.service';
import { ZoomWebhookService } from './zoom-webhook.service';
import { ZoomSyncService } from './zoom-sync.service';
import { ZoomSyncJob } from './zoom.jobs';
import { ZoomController } from './zoom.controller';
import { ZOOM_SERVICE } from './zoom.interface';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import zoomConfig from '../../config/zoom.config';

@Module({
  imports: [ConfigModule.forFeature(zoomConfig), AuthModule, EmailModule],
  controllers: [ZoomController],
  providers: [
    {
      provide: ZOOM_SERVICE,
      useFactory: (configService: ConfigService) => {
        const isMock = process.env.ZOOM_MOCK === 'true';
        if (isMock) {
          return new ZoomMockService();
        }
        return new ZoomService(configService);
      },
      inject: [ConfigService],
    },
    ZoomWebhookService,
    ZoomSyncService,
    ZoomSyncJob,
  ],
  exports: [ZOOM_SERVICE, ZoomWebhookService, ZoomSyncService],
})
export class ZoomModule {}
