import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { JwtOrScopedGuard } from '../auth/guards/jwt-or-scoped.guard';

@Module({
  imports: [AuthModule],
  controllers: [StorageController],
  providers: [StorageService, JwtOrScopedGuard],
  exports: [StorageService],
})
export class StorageModule {}
