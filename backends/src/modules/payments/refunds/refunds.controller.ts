import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RefundService } from '../services/refund.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { ApproveRefundDto } from '../dto/approve-refund.dto';
import { RejectRefundDto } from '../dto/reject-refund.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundsController {
  constructor(private readonly refundService: RefundService) {}

  // ---------------------------------------------------------------------
  // Literal-path routes — MUST be declared BEFORE wildcard `:id` routes,
  // otherwise Express matches `/refunds/summary` as id="summary".
  // ---------------------------------------------------------------------

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

  @Post('admin-initiate')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async adminInitiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: CreateRefundDto & {
      justification?: string;
      refundAmount?: number;
      bypassPolicy?: boolean;
    },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.refundService.adminInitiateRefund(user.id, dto, ipAddress);
  }

  @Get('summary')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getSummary(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gateway') gateway?: string,
    @Query('reason') reason?: string,
  ) {
    return this.refundService.getRefundSummary({
      status,
      startDate,
      endDate,
      gateway,
      reason,
    });
  }

  @Get('refundable-payments')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRefundablePayments(
    @Query('search') search?: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ) {
    return this.refundService.listRefundablePayments(search, limit);
  }

  @Get('preview/:paymentId')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRefundPreview(
    @Param('paymentId') paymentId: string,
    @Query('amount') amount?: string,
  ) {
    const requestedAmount =
      amount !== undefined && amount !== '' ? Number(amount) : undefined;
    if (
      requestedAmount !== undefined &&
      (Number.isNaN(requestedAmount) || requestedAmount <= 0)
    ) {
      return this.refundService.getRefundPreview(paymentId);
    }
    return this.refundService.getRefundPreview(paymentId, requestedAmount);
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

  @Get('export')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async exportRefunds(
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.refundService.exportRefundsCsv(
      status,
      startDate,
      endDate,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="refunds-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  @Get()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAllRefunds(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gateway') gateway?: string,
    @Query('reason') reason?: string,
  ) {
    return this.refundService.getAllRefunds(
      page,
      limit,
      status,
      search,
      startDate,
      endDate,
      gateway,
      reason,
    );
  }

  // ---------------------------------------------------------------------
  // Wildcard `:id` routes — declared LAST.
  // ---------------------------------------------------------------------

  @Get(':id/detail')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getDetail(@Param('id') id: string) {
    return this.refundService.getRefundDetail(id);
  }

  @Get(':id/audit')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAudit(@Param('id') id: string) {
    return this.refundService.getRefundAudit(id);
  }

  @Get(':id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRefundById(@Param('id') id: string) {
    return this.refundService.getRefundById(id);
  }

  @Patch(':id/approve')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async approveRefund(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApproveRefundDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.refundService.approveRefund(
      id,
      user.id,
      ipAddress,
      dto.approvalNote,
    );
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

  @Patch(':id/mark-failed')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async markFailed(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { note: string },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.refundService.markFailed(
      id,
      user.id,
      body?.note || 'Marked as failed by admin',
      ipAddress,
    );
  }
}
