import { Module } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';

@Module({
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
