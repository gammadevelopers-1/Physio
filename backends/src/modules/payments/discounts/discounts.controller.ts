import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { DiscountService } from '../services/discount.service';
import { CreateDiscountDto } from '../dto/create-discount.dto';
import { UpdateDiscountDto } from '../dto/update-discount.dto';
import { ValidateDiscountDto } from '../dto/validate-discount.dto';
import { BulkDiscountDto } from '../dto/bulk-discount.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

@Controller('discounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiscountsController {
  constructor(private readonly discountService: DiscountService) {}

  @Post('validate')
  @Roles('STUDENT')
  async validateDiscount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ValidateDiscountDto,
  ) {
    // We need the course price to validate
    const { db } = await import('../../../database');
    const { courses } = await import('../../../database/schema');
    const { eq } = await import('drizzle-orm');

    const [course] = await db
      .select({ price: courses.price })
      .from(courses)
      .where(eq(courses.id, dto.courseId))
      .limit(1);

    if (!course) {
      return { valid: false, error: 'Course not found' };
    }

    return this.discountService.validateDiscount(
      dto.code,
      dto.courseId,
      user.id,
      Number(course.price || 0),
    );
  }

  @Get('analytics')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.discountService.getAnalytics(startDate, endDate);
  }

  @Get('campaigns/report')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getCampaignReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.discountService.getCampaignReport(startDate, endDate);
  }

  @Get('export')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async exportCsv(
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.discountService.exportCsv(status, search, startDate, endDate);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="discounts-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  @Get()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.discountService.findAll(page, limit, status, search, startDate, endDate);
  }

  @Post()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiscountDto,
  ) {
    return this.discountService.create(dto, user.id);
  }

  @Post('bulk')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async bulkGenerate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkDiscountDto,
  ) {
    return this.discountService.bulkGenerate(dto, user.id);
  }

  @Get(':id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getById(@Param('id') id: string) {
    return this.discountService.getById(id);
  }

  @Patch(':id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discountService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discountService.delete(id, user.id);
  }
}
