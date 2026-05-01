import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { PublicStatsService } from './public-stats.service';

@Public()
@Controller('public-stats')
export class PublicStatsController {
  constructor(private readonly service: PublicStatsService) {}

  @Get()
  async getStats() {
    return this.service.getStats();
  }

  @Get('reviews')
  async getReviews(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.service.getRecentReviews(Number.isFinite(n) ? n : 10);
  }
}
