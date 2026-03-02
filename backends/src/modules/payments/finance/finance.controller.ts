import { Controller, Get } from '@nestjs/common';
import { FinanceService } from '../services/finance.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getSummary() {
    return this.financeService.getSummary();
  }

  @Get('revenue-by-source')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRevenueBySource() {
    return this.financeService.getRevenueBySource();
  }

  @Get('payment-status')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getPaymentStatus() {
    return this.financeService.getPaymentStatus();
  }

  @Get('refund-rate')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRefundRate() {
    return this.financeService.getRefundRate();
  }

  @Get('invoice-aging')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getInvoiceAging() {
    return this.financeService.getInvoiceAging();
  }
}
