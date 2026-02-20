import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZoomService } from './zoom.service';
import { ZoomMockService } from './zoom-mock.service';
import { ZoomWebhookService } from './zoom-webhook.service';
import { ZoomController } from './zoom.controller';
import { ZOOM_SERVICE } from './zoom.interface';
import zoomConfig from '../../config/zoom.config';

@Module({
  imports: [ConfigModule.forFeature(zoomConfig)],
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
  ],
  exports: [ZOOM_SERVICE, ZoomWebhookService],
})
export class ZoomModule {}
