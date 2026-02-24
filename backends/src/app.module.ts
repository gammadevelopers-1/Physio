import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { RoleRequestsModule } from './modules/role-requests/role-requests.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CoursesModule } from './modules/courses/courses.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { InstructorModule } from './modules/instructor/instructor.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ZoomModule } from './modules/zoom/zoom.module';
import { NelcAuditModule } from './modules/nelc-audit/nelc-audit.module';
import { SessionAssistantsModule } from './modules/session-assistants/session-assistants.module';
import { NelcComplianceModule } from './modules/nelc-compliance/nelc-compliance.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { AuditLogModule } from './modules/audit-logs/audit-logs.module';
import { StudentModule } from './modules/student/student.module';
import { JwtAuthGuard } from './modules/auth/guards';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import storageConfig from './config/storage.config';
import zoomConfig from './config/zoom.config';
import processingConfig from './config/processing.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, storageConfig, zoomConfig, processingConfig],
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'local'}`,
        '.env.local',
        '.env',
      ],
    }),

    // Task scheduling (cron jobs)
    ScheduleModule.forRoot(),

    // BullMQ job queue (Redis)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('processing.redis.host', 'localhost'),
          port: configService.get('processing.redis.port', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    // NELC Compliance (global — available to all modules)
    NelcAuditModule,

    // Feature modules
    EmailModule,
    AuthModule,
    HealthModule,
    StorageModule,
    RoleRequestsModule,
    NotificationsModule,
    CoursesModule,
    SessionsModule,
    EnrollmentsModule,
    InstructorModule,
    AssessmentsModule,
    MaterialsModule,
    CertificatesModule,
    ReportsModule,
    ZoomModule,
    SessionAssistantsModule,
    NelcComplianceModule,
    ProcessingModule,
    PreferencesModule,
    AuditLogModule,
    StudentModule,
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
