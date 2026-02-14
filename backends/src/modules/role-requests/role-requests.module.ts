import { Module } from '@nestjs/common';
import { RoleRequestsController } from './role-requests.controller';
import { RoleRequestsService } from './role-requests.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RoleRequestsController],
  providers: [RoleRequestsService],
  exports: [RoleRequestsService],
})
export class RoleRequestsModule {}
