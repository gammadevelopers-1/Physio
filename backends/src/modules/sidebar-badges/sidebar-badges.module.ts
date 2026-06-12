import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SidebarBadgesController } from './sidebar-badges.controller';
import { SidebarBadgesService } from './sidebar-badges.service';

@Module({
  imports: [AuthModule],
  controllers: [SidebarBadgesController],
  providers: [SidebarBadgesService],
  exports: [SidebarBadgesService],
})
export class SidebarBadgesModule {}
