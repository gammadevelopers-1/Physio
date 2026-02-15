import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { RoleRequestsModule } from './modules/role-requests/role-requests.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JwtAuthGuard } from './modules/auth/guards';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import storageConfig from './config/storage.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, storageConfig],
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'local'}`,
        '.env.local',
        '.env',
      ],
    }),

    // Feature modules
    EmailModule,
    AuthModule,
    HealthModule,
    StorageModule,
    RoleRequestsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT Auth Guard - all routes protected by default
    // Use @Public() decorator to make routes public
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
