import { Global, Module } from '@nestjs/common';
import { NelcAuditService } from './nelc-audit.service';
import { NelcAuditController } from './nelc-audit.controller';

@Global()
@Module({
  controllers: [NelcAuditController],
  providers: [NelcAuditService],
  exports: [NelcAuditService],
})
export class NelcAuditModule {}
