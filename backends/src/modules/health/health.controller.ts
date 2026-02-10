import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators';

@Public() // All health endpoints are public
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.check();
  }

  @Get('live')
  liveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  readiness() {
    return this.healthService.readiness();
  }
}
