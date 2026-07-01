import { Body, Controller, Get, Post, Param, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Response, Request } from 'express';
import { Req } from '@nestjs/common';
import { FinanceService } from '../services/finance.service';
import { TamaraRetryService } from '../services/tamara-retry.service';
import { PaymentsService } from '../payments.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly tamaraRetryService: TamaraRetryService,
    private readonly paymentsService: PaymentsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Manually retry the Authorise + Capture flow for a stuck Tamara payment.
   * Shown on the finance dashboard as a "Retry Capture" button when a Tamara
   * payment has been pending for too long. Wrapped in audit logging so the
   * action is attributable.
   */
  @Post('tamara/retry/:paymentId')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async retryTamaraCapture(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'tamara_retry_manual',
      performedBy: user.id,
      ipAddress,
      metadata: { triggeredBy: user.email },
    });
    return this.tamaraRetryService.retryOne(paymentId, user.id);
  }

  /**
   * Merchant-initiated cancellation of a pre-capture Tamara order. Kills the
   * order on Tamara's side (releases the buyer from the instalment plan and
   * voids any authorisation hold), flips our payment row to FAILED with
   * errorCode='merchant_cancelled', and drops any pending enrollments.
   *
   * Only valid before capture. Once money has settled (status=paid), use the
   * refund flow instead — the service layer enforces this and returns 409.
   *
   * Reason is required (min 5 chars, matches AdminOverridePanel client-side
   * validation) so every cancellation is attributable and shows in the
   * merchant portal comment for Tamara.
   */
  @Post('tamara/cancel/:paymentId')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async cancelTamaraOrder(
    @Param('paymentId') paymentId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const reason = (body?.reason || '').trim();
    if (reason.length < 5) {
      throw new BadRequestException('Reason must be at least 5 characters');
    }
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    return this.paymentsService.cancelTamaraPayment(
      paymentId,
      { id: user.id, email: user.email },
      reason,
      ipAddress,
    );
  }

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

  @Get('bank-transfer-review-aging')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getBankTransferReviewAging() {
    return this.financeService.getBankTransferReviewAging();
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
    // Extra filters forwarded into the new 8 Reports-page exports. All optional.
    @Query('gateway') gateway?: string,
    @Query('method') method?: string,
    @Query('reason') reason?: string,
    @Query('courseId') courseId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('deliveryType') deliveryType?: string,
    @Query('search') search?: string,
    @Query('top') top?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    const dateStr = new Date().toISOString().split('T')[0];
    const safeReport = reportType || 'payments';
    const safeFormat = ['csv', 'xlsx', 'pdf'].includes(format || '') ? format! : 'csv';

    // Legacy payments-only export (backward compatible)
    if (safeReport === 'payments-legacy') {
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

    // Report-specific export (8 spec reports + legacy analytics)
    const result = await this.financeService.exportReport(
      safeReport,
      safeFormat,
      startDate,
      endDate,
      user.id,
      {
        gateway, method, status, reason, courseId, sessionId,
        deliveryType, search, top, actorId, entityType, action,
      },
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

    // Self-audit the export. Compliance needs a trail of who pulled which
    // report with which filters. Non-fatal if the audit write itself fails
    // (logger.error covers that branch in AuditLogService.log).
    await this.auditLogService.log({
      entityType: 'report_export',
      entityId: `${safeReport}-${dateStr}-${safeFormat}`,
      action: 'report_exported',
      performedBy: user.id,
      metadata: {
        report: safeReport,
        format: safeFormat,
        filters: {
          startDate, endDate, status, gateway, method, reason,
          courseId, sessionId, deliveryType, search, top, actorId,
          entityType, action,
        },
      },
    });

    res.send(result);
  }

  // ── 8 preview JSON endpoints for the Reports page ─────────────
  // Each returns the typed dataset the frontend renders inline before
  // offering CSV / XLSX / PDF downloads via /finance/export.

  @Get('reports/revenue')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gateway') gateway?: string,
  ) {
    return this.financeService.getReportRevenue({ startDate, endDate, gateway });
  }

  @Get('reports/refunds')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewRefunds(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('gateway') gateway?: string,
    @Query('reason') reason?: string,
  ) {
    return this.financeService.getReportRefunds({ startDate, endDate, status, gateway, reason });
  }

  @Get('reports/payments')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewPayments(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('gateway') gateway?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
  ) {
    return this.financeService.getReportPayments({ startDate, endDate, gateway, status, method });
  }

  @Get('reports/course-sales')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewCourseSales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('courseId') courseId?: string,
    @Query('deliveryType') deliveryType?: string,
  ) {
    return this.financeService.getReportCourseSales({ startDate, endDate, courseId, deliveryType });
  }

  @Get('reports/webinar-sales')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewWebinarSales(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('courseId') courseId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.financeService.getReportWebinarSales({ startDate, endDate, courseId, sessionId });
  }

  @Get('reports/student-purchases')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewStudentPurchases(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('top') top?: string,
  ) {
    return this.financeService.getReportStudentPurchases({
      startDate, endDate, search,
      top: top ? Number(top) : undefined,
    });
  }

  @Get('reports/finance-activity')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewFinanceActivity(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    return this.financeService.getReportFinanceActivity({
      startDate, endDate, actorId, entityType, action,
    });
  }

  @Get('reports/vat')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async previewVat(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financeService.getReportVat({ startDate, endDate });
  }
}
