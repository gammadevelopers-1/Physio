import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [AuthModule, StorageModule, AdminSettingsModule, SupportModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
