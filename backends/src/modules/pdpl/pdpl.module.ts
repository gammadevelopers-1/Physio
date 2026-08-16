import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { RetentionService } from './retention.service';

@Module({
  imports: [TasksModule], // for DistributedLockService
  providers: [RetentionService],
  exports: [RetentionService],
})
export class PdplModule {}
