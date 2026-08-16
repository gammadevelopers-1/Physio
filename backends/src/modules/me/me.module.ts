import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditLogModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { DataExportService } from './data-export.service';
import { ErasureService } from './erasure.service';
import { MeController } from './me.controller';

@Module({
  imports: [
    // JwtModule uses the same secret + algorithm as AuthModule; JWT_SECRET
    // is loaded from Cloud Run env / Secret Manager. Register locally so
    // we don't fight AuthModule's registerAsync setup.
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { algorithm: 'HS256' },
    }),
    AuditLogModule,
    EmailModule,
  ],
  controllers: [MeController],
  providers: [ErasureService, DataExportService],
})
export class MeModule {}
