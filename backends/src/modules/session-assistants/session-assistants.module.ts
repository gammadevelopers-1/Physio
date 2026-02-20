import { Module } from '@nestjs/common';
import { SessionAssistantsController } from './session-assistants.controller';
import { SessionAssistantsService } from './session-assistants.service';

@Module({
  controllers: [SessionAssistantsController],
  providers: [SessionAssistantsService],
  exports: [SessionAssistantsService],
})
export class SessionAssistantsModule {}
