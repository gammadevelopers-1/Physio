import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getWelcome() {
    return {
      name: 'PhysioGuidance API',
      version: '1.0.0',
      environment: this.configService.get('NODE_ENV', 'development'),
      documentation: '/api/docs',
    };
  }
}
