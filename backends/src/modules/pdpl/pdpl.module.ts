import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { PdplAdminController } from './pdpl-admin.controller';
import { PdplAdminService } from './pdpl-admin.service';
import { RetentionService } from './retention.service';

@Module({
  imports: [TasksModule], // for DistributedLockService
  controllers: [PdplAdminController],
  providers: [RetentionService, PdplAdminService],
  exports: [RetentionService],
})
export class PdplModule {}
