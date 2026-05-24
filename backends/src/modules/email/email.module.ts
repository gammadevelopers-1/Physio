import { Module, Global, forwardRef } from '@nestjs/common';
import { EmailService } from './email.service';
import { TemplatesModule } from '../templates/templates.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

@Global()
@Module({
  // forwardRef because AdminSettingsModule imports TemplatesModule, and
  // TemplatesModule's resolver may eventually pull email i18n — guarding
  // against a future circular reference.
  imports: [TemplatesModule, forwardRef(() => AdminSettingsModule)],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
