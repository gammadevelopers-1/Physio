import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  constructor(private configService: ConfigService) {}

  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV'),
      uptime: process.uptime(),
    };
  }

  liveness() {
    // Simple liveness check - is the app running?
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  readiness() {
    // Readiness check - is the app ready to receive traffic?
    // Add database connectivity check here when database is added
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'not_configured', // Will be 'ok' when DB is added
      },
    };
  }
}
