import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { payments, PAYMENT_STATUS } from '../../../database/schema';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { CurrentUser, Roles } from '../../auth/decorators';
import { UserRole } from '../../../database/schema';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { EmailService } from '../../email/email.service';
import { PaymentsService } from '../payments.service';
import { InvoiceService } from '../services/invoice.service';
import { RefundService } from '../services/refund.service';
import { GatewayFactory } from '../gateways/gateway.factory';
import { GatewayCredentialsService } from '../gateways/gateway-credentials.service';

/**
 * Admin-only finance super-actions. Reserved for ADMIN / SUPER_ADMIN.
 * Every mutation requires a reason (admin must justify the override) and
 * writes an audit-log entry with action ending in `_admin_override`.
 */
@SkipThrottle()
@Controller('admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class AdminFinanceController {
  private static readonly TESTABLE_GATEWAYS = new Set([
    'moyasar',
    'tamara',
    'tabby',
  ]);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly invoiceService: InvoiceService,
    private readonly refundService: RefundService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly credentials: GatewayCredentialsService,
    private readonly auditLog: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

  // ── Gateway connection management ─────────────────────────────────

  /**
   * Per-gateway runtime status — drives the read-only mode/source/lastFour
   * pills in the admin Payments form so admin sees what's actually loaded
   * (not a fake test-mode toggle). Never returns secret values, only
   * presence + last 4 chars.
   */
  @Get('gateways/runtime-status')
  async getGatewayRuntimeStatus(): Promise<{
    moyasar: { mode: 'test' | 'live' | null; source: string; lastFour: string | null; hasCredentials: boolean };
    tamara:  { mode: 'test' | 'live' | null; source: string; lastFour: string | null; hasCredentials: boolean; apiUrl: string };
    tabby:   { mode: 'test' | 'live' | null; source: string; lastFour: string | null; hasCredentials: boolean };
  }> {
    // Force a refresh so the answer reflects whatever was just saved
    // (admin saves a key → instantly visible). Cheap; DB hit ~2ms.
    await this.credentials.refresh();
    const m = this.credentials.getMoyasar();
    const t = this.credentials.getTamara();
    const b = this.credentials.getTabby();
    return {
      moyasar: {
        mode: m.mode,
        source: m.source,
        lastFour: m.lastFour,
        hasCredentials: !!m.secretKey,
      },
      tamara: {
        mode: t.mode,
        source: t.source,
        lastFour: t.lastFour,
        hasCredentials: !!t.apiToken,
        apiUrl: t.apiUrl,
      },
      tabby: {
        mode: b.mode,
        source: b.source,
        lastFour: b.lastFour,
        hasCredentials: !!b.secretKey,
      },
    };
  }

  @Post('gateways/:gateway/test')
  @HttpCode(HttpStatus.OK)
  async testGatewayConnection(
    @Param('gateway') gatewayName: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{
    gateway: string;
    status: 'healthy' | 'degraded' | 'down';
    source: 'db' | 'env' | 'mixed' | 'empty';
    checkedAt: string;
    error?: string;
  }> {
    if (!AdminFinanceController.TESTABLE_GATEWAYS.has(gatewayName)) {
      throw new BadRequestException(
        `Unsupported gateway '${gatewayName}'. Supported: moyasar, tamara, tabby.`,
      );
    }
    await this.credentials.refresh();
    const source =
      gatewayName === 'moyasar' ? this.credentials.getMoyasar().source
      : gatewayName === 'tamara' ? this.credentials.getTamara().source
      : this.credentials.getTabby().source;

    let result: { status: 'healthy' | 'degraded' | 'down'; error?: string };
    try {
      const gateway = this.gatewayFactory.getGateway(gatewayName);
      const health = await gateway.healthCheck();
      result = { status: health.status, error: health.error };
    } catch (err) {
      result = { status: 'down', error: (err as Error).message };
    }

    await this.auditLog.log({
      entityType: 'payment_gateway',
      entityId: gatewayName,
      action: 'gateway_admin_test',
      performedBy: user.id,
      metadata: { source, status: result.status, error: result.error ?? null },
    });

    return {
      gateway: gatewayName,
      status: result.status,
      source,
      checkedAt: new Date().toISOString(),
      error: result.error,
    };
  }

  @Post('gateways/refresh-cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refreshCredentials(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.credentials.refresh();
    await this.auditLog.log({
      entityType: 'payment_gateway',
      entityId: 'all',
      action: 'gateway_admin_cache_refresh',
      performedBy: user.id,
    });
  }

  // ── Payment super-actions ─────────────────────────────────────────

  /**
   * Manually flip a payment to PAID or FAILED. Use when a gateway webhook
   * never arrived and the payment is stuck. Triggers downstream side-effects
   * (enrollment activation, invoice generation, refund unblock) per the
   * normal success/failure code paths.
   */
  @Post('payments/:id/force-status')
  @HttpCode(HttpStatus.OK)
  async forcePaymentStatus(
    @Param('id') paymentId: string,
    @Body() body: { status: 'paid' | 'failed'; reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.requireReason(body?.reason);
    if (body.status !== 'paid' && body.status !== 'failed') {
      throw new BadRequestException("status must be 'paid' or 'failed'");
    }

    const payment = await this.findPayment(paymentId);
    const previousStatus = payment.status;

    if (body.status === 'paid') {
      await this.paymentsService.processPaymentSuccess(paymentId);
      // Run the same post-success cascade the webhook/verify paths run —
      // without this, admin-force-paid payments were left invoice-less.
      // generateInvoice is now idempotent so a later webhook arriving for
      // the same payment won't duplicate.
      try {
        await this.invoiceService.generateInvoice(paymentId);
      } catch {}
    } else {
      await this.paymentsService.processPaymentFailure(
        paymentId,
        body.reason,
        'admin_override',
      );
    }

    await this.auditLog.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'payment_status_admin_override',
      performedBy: user.id,
      metadata: {
        previousStatus,
        newStatus: body.status,
        reason: body.reason,
      },
    });

    return { ok: true, paymentId, previousStatus, newStatus: body.status };
  }

  /**
   * Re-process the success path for a payment — same as if the gateway
   * webhook fired again. Useful when invoice generation failed first time
   * or the post-payment email got lost. Idempotent on a paid payment.
   */
  @Post('payments/:id/replay-webhook')
  @HttpCode(HttpStatus.OK)
  async replayPaymentWebhook(
    @Param('id') paymentId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.requireReason(body?.reason);
    const payment = await this.findPayment(paymentId);
    if (
      payment.status !== PAYMENT_STATUS.PAID &&
      payment.status !== PAYMENT_STATUS.PENDING
    ) {
      throw new BadRequestException(
        `Cannot replay webhook for payment with status '${payment.status}'`,
      );
    }
    await this.paymentsService.processPaymentSuccess(paymentId);
    try {
      await this.invoiceService.generateInvoice(paymentId);
    } catch {
      // Invoice may already exist — generateInvoice is idempotent. Swallow.
    }

    await this.auditLog.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'payment_webhook_admin_replay',
      performedBy: user.id,
      metadata: { previousStatus: payment.status, reason: body.reason },
    });

    return { ok: true, paymentId };
  }

  /**
   * Poll the gateway for the live status of a payment and apply whatever it
   * says (paid → success path, failed → failure path). Same as the buyer's
   * verifyPayment flow but admin-driven and not user-scoped.
   */
  @Post('payments/:id/sync-from-gateway')
  @HttpCode(HttpStatus.OK)
  async syncPaymentFromGateway(
    @Param('id') paymentId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.requireReason(body?.reason);
    const payment = await this.findPayment(paymentId);
    if (!payment.gatewayChargeId) {
      throw new BadRequestException(
        'Payment has no gatewayChargeId — nothing to sync',
      );
    }

    const gateway = this.gatewayFactory.getGateway(payment.gateway);
    const normalized = await gateway.getPaymentStatus(payment.gatewayChargeId);

    let applied: 'paid' | 'failed' | 'no_change' = 'no_change';
    if (normalized === 'paid' && payment.status !== PAYMENT_STATUS.PAID) {
      await this.paymentsService.processPaymentSuccess(paymentId);
      try {
        await this.invoiceService.generateInvoice(paymentId);
      } catch {}
      applied = 'paid';
    } else if (normalized === 'failed' && payment.status !== PAYMENT_STATUS.FAILED) {
      await this.paymentsService.processPaymentFailure(
        paymentId,
        'Synced from gateway by admin',
        'admin_sync',
      );
      applied = 'failed';
    }

    await this.auditLog.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'payment_gateway_admin_sync',
      performedBy: user.id,
      metadata: {
        gatewayChargeId: payment.gatewayChargeId,
        gatewayStatus: normalized,
        applied,
        reason: body.reason,
      },
    });

    return {
      ok: true,
      paymentId,
      gatewayStatus: normalized,
      applied,
    };
  }

  // ── Invoice super-actions ─────────────────────────────────────────

  /**
   * Admin cancel an invoice — works even on paid invoices (finance's
   * `cancelInvoice` already supports this). Required when an invoice was
   * issued in error and needs to be voided without a refund.
   */
  @Post('invoices/:id/force-cancel')
  @HttpCode(HttpStatus.OK)
  async forceCancelInvoice(
    @Param('id') invoiceId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.requireReason(body?.reason);
    const result = await this.invoiceService.cancelInvoice(
      invoiceId,
      `[ADMIN OVERRIDE] ${body.reason}`,
      user.id,
    );
    await this.auditLog.log({
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'invoice_cancel_admin_override',
      performedBy: user.id,
      metadata: { reason: body.reason },
    });
    return result;
  }

  /**
   * Resend the invoice + payment confirmation email to the buyer. Most
   * common admin ticket — student lost the email and asks for a copy.
   * Hits the same code path as the original send (PDF attached when
   * available), so the buyer's inbox copy is the canonical one.
   */
  @Post('invoices/:id/resend-email')
  @HttpCode(HttpStatus.OK)
  async resendInvoiceEmail(
    @Param('id') invoiceId: string,
    @Body() body: { reason: string; locale?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.requireReason(body?.reason);
    const invoice = await this.invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const locale: 'en' | 'ar' = body?.locale === 'ar' ? 'ar' : 'en';

    let pdfAttachment: { buffer: Buffer; filename: string } | undefined;
    try {
      const pdf = await this.invoiceService.getInvoicePdfBuffer(
        invoice.paymentId,
        locale,
      );
      if (pdf) pdfAttachment = pdf;
    } catch {
      // PDF generation can fail (rare) — still send the plain email so the
      // buyer has the invoice number + line items in their inbox.
    }
    await this.emailService.sendPaymentConfirmation(
      invoice.userId,
      invoice.paymentId,
      pdfAttachment,
    );

    await this.auditLog.log({
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'invoice_email_admin_resend',
      performedBy: user.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        recipientUserId: invoice.userId,
        attachedPdf: !!pdfAttachment,
        locale,
        reason: body.reason,
      },
    });

    return { sent: true, invoiceNumber: invoice.invoiceNumber };
  }

  /**
   * Re-render an invoice PDF using the current tax + branding settings.
   * Useful after VAT rate changes or branding updates — past invoices keep
   * their original totals (via metadata snapshot), but the visual layout +
   * branding refreshes.
   */
  @Post('invoices/:id/regenerate-pdf')
  @HttpCode(HttpStatus.OK)
  async regenerateInvoicePdf(
    @Param('id') invoiceId: string,
    @Body() body: { reason: string; locale?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.requireReason(body?.reason);
    const locale: 'en' | 'ar' = body?.locale === 'ar' ? 'ar' : 'en';
    const result = await this.invoiceService.regeneratePdf(
      invoiceId,
      user.id,
      locale,
    );
    await this.auditLog.log({
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'invoice_pdf_admin_regenerate',
      performedBy: user.id,
      metadata: { reason: body.reason, locale },
    });
    return result;
  }

  // ── Refund super-actions ─────────────────────────────────────────

  /**
   * Approve a refund even when the lifecycle policy would block it (e.g.
   * after CME granted, after attendance recorded). Admin reason becomes
   * part of the approvalNote so it surfaces on the refund detail drawer.
   */
  @Post('refunds/:id/force-approve')
  @HttpCode(HttpStatus.OK)
  async forceApproveRefund(
    @Param('id') refundId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.requireReason(body?.reason);
    const result = await this.refundService.approveRefund(
      refundId,
      user.id,
      undefined,
      `[ADMIN POLICY BYPASS] ${body.reason}`,
    );
    await this.auditLog.log({
      entityType: 'refund',
      entityId: refundId,
      action: 'refund_approve_admin_override',
      performedBy: user.id,
      metadata: { reason: body.reason, gatewayRefundId: result.gatewayRefundId },
    });
    return result;
  }

  // ── helpers ──────────────────────────────────────────────────────

  private requireReason(reason: string | undefined) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException(
        'reason is required and must be at least 5 characters',
      );
    }
  }

  private async findPayment(paymentId: string) {
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!row) throw new NotFoundException(`Payment ${paymentId} not found`);
    return row;
  }
}
