import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { FinanceService } from '../services/finance.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getSummary(startDate, endDate);
  }

  @Get('revenue-by-source')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRevenueBySource(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getRevenueBySource(startDate, endDate);
  }

  @Get('payment-status')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getPaymentStatus(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getPaymentStatus(startDate, endDate);
  }

  @Get('refund-rate')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRefundRate(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getRefundRate(startDate, endDate);
  }

  @Get('invoice-aging')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getInvoiceAging(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getInvoiceAging(startDate, endDate);
  }

  @Get('revenue-trend')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRevenueTrend(
    @Query('period') period: string = 'day',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const safePeriod = (['day', 'week', 'month'].includes(period) ? period : 'day') as 'day' | 'week' | 'month';
    return this.financeService.getRevenueTrend(safePeriod, startDate, endDate);
  }

  @Get('top-courses')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getTopCourses(
    @Query('limit') limit: string = '5',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
    return this.financeService.getTopCourses(safeLimit, startDate, endDate);
  }

  @Get('revenue-by-course')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRevenueByCourse(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getRevenueByCourse(startDate, endDate);
  }

  @Get('revenue-by-instructor')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRevenueByInstructor(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getRevenueByInstructor(startDate, endDate);
  }

  @Get('revenue-by-delivery-type')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRevenueByDeliveryType(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getRevenueByDeliveryType(startDate, endDate);
  }

  @Get('chargeback-rate')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getChargebackRate(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getChargebackRate(startDate, endDate);
  }

  @Get('export')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async exportPayments(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('format') format?: string,
    @Query('reportType') reportType?: string,
    @Query('locale') locale?: string,
  ) {
    const dateStr = new Date().toISOString().split('T')[0];
    const safeReport = reportType || 'payments';
    const safeFormat = ['csv', 'xlsx', 'pdf'].includes(format || '') ? format! : 'csv';

    // Legacy payments-only export (backward compatible)
    if (safeReport === 'payments') {
      if (safeFormat === 'pdf') {
        const buf = await this.financeService.exportPaymentsPdf(startDate, endDate, status, user.id, locale);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="payments-export-${dateStr}.pdf"`);
        return res.send(buf);
      }
      const csv = await this.financeService.exportPaymentsCsv(startDate, endDate, status, user.id, locale);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="payments-export-${dateStr}.csv"`);
      return res.send(csv);
    }

    // Report-specific export
    const result = await this.financeService.exportReport(
      safeReport, safeFormat, startDate, endDate, user.id,
    );

    if (safeFormat === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${safeReport}-${dateStr}.xlsx"`);
    } else if (safeFormat === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeReport}-${dateStr}.pdf"`);
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeReport}-${dateStr}.csv"`);
    }
    res.send(result);
  }
}
