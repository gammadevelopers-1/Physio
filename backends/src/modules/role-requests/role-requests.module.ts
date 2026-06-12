import { Module } from '@nestjs/common';
import { RoleRequestsController } from './role-requests.controller';
import { SupportRoleRequestsController } from './support-role-requests.controller';
import { RoleRequestsService } from './role-requests.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [RoleRequestsController, SupportRoleRequestsController],
  providers: [RoleRequestsService],
  exports: [RoleRequestsService],
})
export class RoleRequestsModule {}
