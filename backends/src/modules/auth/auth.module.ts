import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { RecaptchaService } from './recaptcha.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordSetupService } from './password-setup.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-super-secret-key-change-in-production',
        // Per-token expiresIn is set at sign-time by AuthService.signTokens
        // so admin-configured Access Token Lifetime takes effect without
        // a server restart. This default is the safety fallback only.
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m') as any,
        },
      }),
    }),
    AdminSettingsModule,
  ],
  // Re-export JwtModule so other feature modules (storage, trainer-applications)
  // can inject JwtService via custom guards.
  controllers: [AuthController],
  providers: [
    AuthService,
    TwoFactorService,
    RecaptchaService,
    EmailVerificationService,
    PasswordSetupService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    TwoFactorService,
    RecaptchaService,
    EmailVerificationService,
    PasswordSetupService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
  ],
})
export class AuthModule {}
