import { Module } from '@nestjs/common';
import { SessionAssistantsController } from './session-assistants.controller';
import { SessionAssistantsService } from './session-assistants.service';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

@Module({
  imports: [AdminSettingsModule],
  controllers: [SessionAssistantsController],
  providers: [SessionAssistantsService],
  exports: [SessionAssistantsService],
})
export class SessionAssistantsModule {}
