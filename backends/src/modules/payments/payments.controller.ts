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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { GatewayFactory } from './gateways/gateway.factory';
import { MockGateway, MockConfig } from './gateways/mock.gateway';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly gatewayFactory: GatewayFactory,
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
  ) {
    return this.paymentsService.getAllPayments(page, limit);
  }
}
