import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
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
  @Roles('STUDENT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async requestRefund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRefundDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    // Finance/Admin can initiate refunds on behalf of learners
    const isAdmin =
      user.roles.includes('FINANCE') ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    const requesterId = isAdmin ? (dto as any).userId || user.id : user.id;
    return this.refundService.requestRefund(requesterId, dto, ipAddress);
  }

  @Get('my-refunds')
  @Roles('STUDENT')
  async getMyRefunds(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.refundService.getMyRefunds(user.id, page, limit);
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
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.refundService.approveRefund(id, user.id, ipAddress);
  }

  @Patch(':id/reject')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async rejectRefund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectRefundDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.refundService.rejectRefund(id, user.id, dto, ipAddress);
  }
}
