import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { RefundService } from '../services/refund.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RejectRefundDto } from '../dto/reject-refund.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  @Roles('STUDENT')
  async requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRefundDto,
  ) {
    return this.refundService.requestRefund(user.id, dto);
  }

  @Get()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAllRefunds(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.refundService.getAllRefunds(page, limit);
  }

  @Patch(':id/approve')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async approveRefund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.refundService.approveRefund(id, user.id);
  }

  @Patch(':id/reject')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async rejectRefund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectRefundDto,
  ) {
    return this.refundService.rejectRefund(id, user.id, dto);
  }
}
