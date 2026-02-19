import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ZoomService } from './zoom.service';
import { ZoomController } from './zoom.controller';
import zoomConfig from '../../config/zoom.config';

@Module({
  imports: [ConfigModule.forFeature(zoomConfig)],
  controllers: [ZoomController],
  providers: [ZoomService],
  exports: [ZoomService],
})
export class ZoomModule {}
