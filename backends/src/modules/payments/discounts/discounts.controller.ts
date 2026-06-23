import {
  Controller,
  Get,
  Post,
  Put,
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
import { SetCourseSaleDto } from '../dto/set-course-sale.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { Req } from '@nestjs/common';
import { Request } from 'express';

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

    const { getEffectivePrice } = await import('../../courses/pricing.util');

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, dto.courseId))
      .limit(1);

    if (!course) {
      return { valid: false, error: 'Course not found' };
    }

    // Mirror checkout exactly: coupon applies to the SALE price, and is rejected
    // on a sale unless the finance manager enabled stacking for this course.
    const sale = getEffectivePrice(course);
    if (sale.onSale && !sale.saleAllowsCoupon) {
      return {
        valid: false,
        discountAmount: 0,
        discountId: null,
        error:
          'This course is on sale; coupon codes cannot be combined with the sale.',
      };
    }

    return this.discountService.validateDiscount(
      dto.code,
      dto.courseId,
      user.id,
      sale.effectivePrice,
    );
  }

  // ── Course-level sales (finance-managed; no coupon required) ──────────────
  // Declared before the generic @Get(':id') so 'course-sales' isn't captured.
  @Get('course-sales')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async listCourseSales(@Query('search') search?: string) {
    return this.discountService.listCourseSales(search);
  }

  @Put('course-sales/:courseId')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async setCourseSale(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId') courseId: string,
    @Body() dto: SetCourseSaleDto,
  ) {
    return this.discountService.setCourseSale(courseId, dto, user.id);
  }

  @Get('analytics')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.discountService.getAnalytics(startDate, endDate);
  }

  @Get('summary')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.discountService.getDiscountSummary({ startDate, endDate });
  }

  @Get('chart-series')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getChartSeries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.discountService.getDiscountChartSeries(startDate, endDate);
  }

  @Get('activity/recent')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRecentActivity(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    return this.discountService.getRecentActivity(limit);
  }

  @Get('early-bird')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async listEarlyBird() {
    return this.discountService.listEarlyBirdCodes();
  }

  @Get('batches')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async listBatches(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.discountService.listBatches({ page, limit });
  }

  // ─── Public-facing endpoints (no auth) ──────────────────────────────

  /**
   * Public: returns the best auto-apply (early-bird) discount for a
   * given cart, or null. Used by the checkout to surface savings
   * without a code typed.
   * Accepts optional `userId` from auth context; falls back to anonymous
   * (per-user caps skipped).
   */
  @Post('auto-apply')
  @Public()
  async autoApply(@Body() body: { courseIds: string[]; userId?: string }) {
    if (!Array.isArray(body?.courseIds) || body.courseIds.length === 0) {
      return null;
    }
    return this.discountService.getBestAutoApplyDiscount(
      body.courseIds,
      body.userId || null,
    );
  }

  /**
   * Public: returns the active site-wide campaign for the public banner,
   * or null. Used by the homepage and course list pages.
   */
  @Get('active-banner-campaign')
  @Public()
  async getActiveBannerCampaign() {
    return this.discountService.getActiveBannerCampaign();
  }

  // ─── Campaigns CRUD (finance) ───────────────────────────────────────

  // NOTE: `campaigns/report` MUST be declared before `campaigns/:id`
  // otherwise Express matches "report" as the :id param.
  @Get('campaigns/report')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getCampaignReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.discountService.getCampaignReport(startDate, endDate);
  }

  @Get('campaigns')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async listCampaigns(
    @Query('status') status?: 'active' | 'expired' | 'all',
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.discountService.listCampaigns({ status, search, page, limit });
  }

  @Post('campaigns')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async createCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      name: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      budget?: number;
      showOnSite?: boolean;
      bannerCta?: string;
    },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip;
    return this.discountService.createCampaign(dto, user.id, ipAddress);
  }

  @Get('campaigns/:id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getCampaign(@Param('id') id: string) {
    return this.discountService.getCampaignById(id);
  }

  @Patch('campaigns/:id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async updateCampaign(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: any,
    @Req() req: Request,
  ) {
    return this.discountService.updateCampaign(id, dto, user.id, req.ip);
  }

  @Delete('campaigns/:id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async deleteCampaign(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.discountService.deleteCampaign(id, user.id, req.ip);
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
    @Query('type') type?: 'percentage' | 'fixed',
    @Query('autoApply') autoApply?: string,
    @Query('earlyBird') earlyBird?: string,
    @Query('campaignId') campaignId?: string,
    @Query('scope') scope?: 'all' | 'global' | 'course',
  ) {
    return this.discountService.findAll(
      page,
      limit,
      status,
      search,
      startDate,
      endDate,
      {
        type,
        autoApply:
          autoApply === undefined ? undefined : autoApply === 'true',
        earlyBird:
          earlyBird === undefined ? undefined : earlyBird === 'true',
        campaignId,
        scope,
      },
    );
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

  @Get(':id/audit')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAudit(@Param('id') id: string) {
    return this.discountService.getDiscountAudit(id);
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
