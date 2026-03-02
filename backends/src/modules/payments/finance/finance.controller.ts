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

  @Get('export')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async exportPayments(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    const csv = await this.financeService.exportPaymentsCsv(startDate, endDate, status);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payments-export-${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.send(csv);
  }
}
