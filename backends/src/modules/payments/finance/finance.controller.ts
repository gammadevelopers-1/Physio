import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { FinanceService } from '../services/finance.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('finance')
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
  async getInvoiceAging() {
    return this.financeService.getInvoiceAging();
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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('format') format?: string,
  ) {
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'pdf') {
      const pdfBuffer = await this.financeService.exportPaymentsPdf(startDate, endDate, status);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="payments-export-${dateStr}.pdf"`,
      );
      res.send(pdfBuffer);
    } else {
      const csv = await this.financeService.exportPaymentsCsv(startDate, endDate, status);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="payments-export-${dateStr}.csv"`,
      );
      res.send(csv);
    }
  }
}
