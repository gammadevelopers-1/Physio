import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoleRequestsModule } from '../role-requests/role-requests.module';
import { TrainerApplicationsController } from './trainer-applications.controller';
import { TrainerApplicationsService } from './trainer-applications.service';

@Module({
  imports: [AuthModule, RoleRequestsModule],
  controllers: [TrainerApplicationsController],
  providers: [TrainerApplicationsService],
})
export class TrainerApplicationsModule {}
