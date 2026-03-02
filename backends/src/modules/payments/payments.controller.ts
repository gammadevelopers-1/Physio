import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @Roles('STUDENT')
  async initiatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiatePayment(user, dto);
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
  async verifyPayment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.verifyPayment(id, user);
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
