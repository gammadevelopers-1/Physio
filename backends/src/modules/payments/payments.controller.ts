import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Req,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { ReconciliationCronService } from './reconciliation/reconciliation-cron.service';
import { GatewayFactory } from './gateways/gateway.factory';
import { MockGateway, MockConfig } from './gateways/mock.gateway';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { QuotePaymentDto } from './dto/quote-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly reconciliationCron: ReconciliationCronService,
  ) {}

  @Post('initiate')
  @Roles('STUDENT')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async initiatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.paymentsService.initiatePayment(user, dto, ipAddress);
  }

  /**
   * Read-only quote — runs the same validation pipeline as /initiate (course
   * exists, capacity, NELC limit, discount validation, VAT) and returns the
   * computed totals + line items without creating ANY DB rows. The bank-
   * transfer "draft" page uses this to show the buyer their amount before
   * they commit by uploading a receipt.
   */
  @Post('quote')
  @Roles('STUDENT')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async quotePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QuotePaymentDto,
  ) {
    return this.paymentsService.quotePayment(user, dto);
  }

  @Get('callback')
  @Public()
  async handleCallback(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const result = await this.paymentsService.handleCallback(query);
    const frontendUrl =
      process.env.FRONTEND_URL || 'http://localhost:3000';

    const redirectPath =
      result.redirect === 'success'
        ? `/payment/success?paymentId=${result.paymentId}`
        : result.redirect === 'failed'
          ? `/payment/failed?paymentId=${result.paymentId}`
          : `/payment/callback?paymentId=${result.paymentId}`;

    return res.redirect(`${frontendUrl}${redirectPath}`);
  }

  @Post('verify/:id')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async verifyPayment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.verifyPayment(id, user);
  }

  // Verify by the gateway's charge/invoice id (Moyasar redirects back with the
  // invoice id, not our payment_id).
  @Post('verify-charge/:chargeId')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async verifyPaymentByCharge(
    @Param('chargeId') chargeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.verifyPaymentByCharge(chargeId, user);
  }

  @Get('gateways/health')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getGatewayHealth() {
    return this.gatewayFactory.healthCheckAll();
  }

  @Post('dev/mock-state')
  @Public()
  async setMockState(
    @Body()
    body: {
      outcome: 'success' | 'failure' | 'pending' | 'refunded';
      errorCode?: string;
      refundOutcome?: 'success' | 'failure';
    },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not available in production');
    }
    const mock = this.gatewayFactory.getGateway('mock') as MockGateway;
    mock.configure({
      outcome: body.outcome,
      errorCode: body.errorCode,
      refundOutcome: body.refundOutcome || 'success',
    });
    return mock.getConfig();
  }

  @Get('dev/mock-state')
  @Public()
  async getMockState() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Not available in production');
    }
    const mock = this.gatewayFactory.getGateway('mock') as MockGateway;
    return mock.getConfig();
  }

  @Get('my-payments')
  @Roles('STUDENT')
  async getMyPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.paymentsService.getMyPayments(user.id, page, limit);
  }

  @Get()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAllPayments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gateway') gateway?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('includeAbandoned') includeAbandoned?: string,
  ) {
    return this.paymentsService.getAllPayments(
      page,
      limit,
      status,
      search,
      startDate,
      endDate,
      gateway,
      paymentMethod,
      includeAbandoned === 'true' || includeAbandoned === '1',
    );
  }

  @Get(':paymentId/detail')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getPaymentDetail(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getPaymentDetail(paymentId);
  }

  @Get(':paymentId/audit')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getPaymentAudit(
    @Param('paymentId') paymentId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.paymentsService.getPaymentAudit(paymentId, limit);
  }

  /**
   * Manual trigger for the abandoned-payment sweep, called from the
   * finance Payments page when admins want to flip stale pending rows
   * immediately instead of waiting for the next Cloud Scheduler tick.
   * Same logic as the cron — RBAC-gated rather than token-gated.
   */
  @Post('abandoned-sweep/run')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  async runAbandonedSweep() {
    return this.reconciliationCron.runAbandonedPaymentSweep();
  }
}
