import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { RoleRequestsModule } from './modules/role-requests/role-requests.module';
import { TrainerApplicationsModule } from './modules/trainer-applications/trainer-applications.module';
import { PublicStatsModule } from './modules/public-stats/public-stats.module';
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
import { CourseAssistantsModule } from './modules/course-assistants/course-assistants.module';
import { NelcComplianceModule } from './modules/nelc-compliance/nelc-compliance.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { AuditLogModule } from './modules/audit-logs/audit-logs.module';
import { StudentModule } from './modules/student/student.module';
import { SupportModule } from './modules/support/support.module';
import { UserNotificationsModule } from './modules/user-notifications/user-notifications.module';
import { PointsModule } from './modules/points/points.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminStatsModule } from './modules/admin-stats/admin-stats.module';
import { AdminNotificationsModule } from './modules/admin-notifications/admin-notifications.module';
import { AdminSettingsModule } from './modules/admin-settings/admin-settings.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { BackupsModule } from './modules/backups/backups.module';
import { ErrorMonitoringModule } from './modules/error-monitoring/error-monitoring.module';
import { ServiceStatusModule } from './modules/service-status/service-status.module';
import { ScheduledMaintenanceModule } from './modules/scheduled-maintenance/scheduled-maintenance.module';
import { SidebarBadgesModule } from './modules/sidebar-badges/sidebar-badges.module';
import { XapiModule } from './modules/xapi/xapi.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { MaintenanceMiddleware } from './common/maintenance.middleware';
import { JwtAuthGuard } from './modules/auth/guards';
import { ThrottlerGuard } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import storageConfig from './config/storage.config';
import zoomConfig from './config/zoom.config';
import processingConfig from './config/processing.config';
import paymentsConfig from './config/payments.config';
import nelcConfig from './config/nelc.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, storageConfig, zoomConfig, processingConfig, paymentsConfig, nelcConfig],
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'local'}`,
        '.env.local',
        '.env',
      ],
    }),

    // Task scheduling (@Cron) — only enabled when SKIP_CRONS is unset
    // or false. Set SKIP_CRONS=true on the api-worker service so its
    // container doesn't fire the same @Cron methods the main api-web
    // container already runs (would cause double execution of every
    // scheduled job). Same shape as SKIP_BULLMQ_WORKERS, opposite
    // ownership: workers on api-worker, crons on api-web (until
    // Phase 2 moves each cron to its own Cloud Run Job).
    ...(process.env.SKIP_CRONS === 'true' ? [] : [ScheduleModule.forRoot()]),

    // Rate limiting — ONE bucket only. Every named throttler in this
    // array ticks on every request, so a tight named bucket here
    // (e.g. auth: 10/min) becomes the de-facto global limit and any
    // user 429s after ~10 requests platform-wide. Sensitive routes
    // tighten the limit per-route via @Throttle({ default: { ... } }).
    //
    // 600/min/IP is wide enough that a dashboard refresh (which fans
    // out into ~10 calls) leaves plenty of headroom, while still
    // protecting against scraping / brute force.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 600 },
    ]),

    // BullMQ job queue (Redis) — only when REDIS_HOST is configured
    ...(process.env.REDIS_HOST
      ? [
          BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {
              const tlsEnabled = configService.get('processing.redis.tls');
              const caCert = process.env.REDIS_CA_CERT;
              return {
                connection: {
                  host: configService.get('processing.redis.host', 'localhost'),
                  port: configService.get('processing.redis.port', 6379),
                  ...(tlsEnabled
                    ? {
                        tls: {
                          ...(caCert ? { ca: caCert } : { rejectUnauthorized: false }),
                        },
                      }
                    : {}),
                },
              };
            },
            inject: [ConfigService],
          }),
        ]
      : []),

    // NELC Compliance (global — available to all modules)
    NelcAuditModule,

    // Feature modules
    EmailModule,
    AuthModule,
    HealthModule,
    StorageModule,
    RoleRequestsModule,
    TrainerApplicationsModule,
    PublicStatsModule,
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
    CourseAssistantsModule,
    NelcComplianceModule,
    ProcessingModule,
    PreferencesModule,
    AuditLogModule,
    BackupsModule,
    ErrorMonitoringModule,
    StudentModule,
    SupportModule,
    UserNotificationsModule,
    PointsModule,
    PaymentsModule,
    AdminStatsModule,
    AdminNotificationsModule,
    AdminSettingsModule,
    TemplatesModule,
    ServiceStatusModule,
    ScheduledMaintenanceModule,
    SidebarBadgesModule,
    XapiModule,
    // @Global() — provides JobRegistry for the Cloud Run Jobs entry
    // point (dist/src/main-job) and lets any module register its
    // extracted-cron JobHandlers without importing this module locally.
    JobsModule,
    // @Global() — Cloud Tasks (event-driven scheduling replacement for
    // polling-cron). Provides TasksService (enqueue/cancel) and
    // TaskHandlerRegistry (used by /internal/tasks/dispatch controller).
    // Retirement path: as each @Cron migrates to Cloud Tasks, its
    // JobHandler (JobsModule) goes away and a TaskHandler (TasksModule)
    // replaces it.
    TasksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: ThrottlerGuard runs first so we reject abusive
    // requests before doing any auth work. JwtAuthGuard then handles
    // authentication for non-@Public() routes.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  // Maintenance mode middleware runs globally and short-circuits the
  // request with 503 when the admin has toggled maintenance on. Bypass
  // list (auth, admin, webhooks, health) is enforced inside the
  // middleware itself.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MaintenanceMiddleware).forRoutes('*');
  }
}
