import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { BankTransferService } from './bank-transfer.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SubmitDraftDto } from './dto/submit-draft.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

/**
 * Bank transfer endpoints — student-facing (upload receipt, view pending
 * payment) + shared download (owner or finance).
 *
 * Finance review queue endpoints (approve/reject) ship in Phase 1C under
 * a separate FINANCE-guarded controller.
 */
@Controller('payments/bank-transfer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankTransferController {
  constructor(private readonly bankTransferService: BankTransferService) {}

  /**
   * Returns the bank account info shown to the buyer on the public bank-
   * transfer page. Any authenticated user can read this — the data lives
   * in system_settings and is intended for display.
   */
  @Get('details')
  async getBankDetails() {
    return this.bankTransferService.getBankDetails();
  }

  /**
   * One-shot bank-transfer submission. The buyer never had a payment row
   * before this call — we validate the cart, upload the file, then create
   * payment + items + receipt in one transaction with status
   * AWAITING_APPROVAL. Same multipart shape as the receipt-upload endpoint
   * plus courseIds[] + optional discountCode.
   *
   * Replaces the old "initiate then upload" flow so abandoned bank-transfer
   * attempts leave zero rows in the finance dashboard.
   */
  @Post('submit-draft')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 16 * 1024 * 1024 },
    }),
  )
  async submitDraft(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SubmitDraftDto,
    @Req() req: Request,
  ) {
    const ipAddress =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.bankTransferService.submitDraft(user, file, dto, ipAddress);
  }

  /**
   * Hydrate the public bank-transfer page: payment summary + course title +
   * the currently active receipt (so the page can render "pending review",
   * "rejected — please re-upload", or the empty upload form).
   *
   * Ownership enforced in the service.
   */
  @Get(':paymentId')
  async getPayment(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bankTransferService.getPaymentForBuyer(paymentId, user);
  }

  /**
   * Upload a receipt file + the student's KSA refund-info snapshot. The
   * file is multipart (field name "file"), the refund info is the rest of
   * the form fields. Rate-limited to 5/min/IP to prevent abuse.
   */
  @Post(':paymentId/receipts')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseInterceptors(
    FileInterceptor('file', {
      // Cap matches Amna's reference screenshot (15.63 MB). Service-level
      // validation gives a friendlier error than the interceptor's silent reject.
      limits: { fileSize: 16 * 1024 * 1024 },
    }),
  )
  async uploadReceipt(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateReceiptDto,
    @Req() req: Request,
  ) {
    const ipAddress =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.bankTransferService.uploadReceipt(
      paymentId,
      user,
      file,
      dto,
      ipAddress,
    );
  }

  /**
   * Stream a branded proforma-invoice PDF for the buyer to download. Same
   * template as the paid invoice but tagged "PROFORMA / AWAITING PAYMENT"
   * and explicitly NOT a tax invoice — useful for sending to a finance
   * department for reimbursement BEFORE the bank transfer is made. Owner only.
   */
  @Get(':paymentId/proforma')
  async downloadProforma(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdf = await this.bankTransferService.getProformaPdf(paymentId, user);
    const filename = `proforma-${paymentId.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Content-Length', pdf.length.toString());
    res.end(pdf);
  }

  /**
   * Draft-mode proforma: no payment row exists yet. Buyer passes the same
   * courseIds + discountCode they'd submit to submit-draft, and gets back
   * a PDF computed from a fresh quote. Useful before they decide to commit.
   */
  @Post('proforma/quote')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async downloadProformaFromQuote(
    @Body() body: { courseIds: string[]; discountCode?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { buffer, proformaNumber } =
      await this.bankTransferService.getProformaPdfForQuote(user, body);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="proforma-${proformaNumber}.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  }

  /**
   * Owner or finance role gets a short-lived signed URL to view the receipt.
   * Finance-side enforcement is the controller's job; here we check the
   * receipt's payment owner matches the caller, OR the caller has a
   * finance/admin role.
   */
  @Get('receipts/:receiptId/download')
  async downloadReceipt(
    @Param('receiptId') receiptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const receipt = await this.bankTransferService.getReceiptById(receiptId);
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    const isFinanceUser = ['FINANCE', 'ADMIN', 'SUPER_ADMIN'].some((r) =>
      user.roles?.includes(r),
    );

    if (!isFinanceUser && receipt.uploadedBy !== user.id) {
      throw new ForbiddenException('You can only download your own receipts');
    }

    return this.bankTransferService.getReceiptDownloadUrl(receiptId);
  }

  // ─── Finance review queue ────────────────────────────────────────────

  /**
   * Paginated list of receipts for the finance review queue. Defaults to
   * pending; finance can filter to approved/rejected/all for audit. Search
   * looks up student name/email/payment id.
   */
  @Get('queue/list')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async listQueue(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ) {
    const allowed = ['pending', 'approved', 'rejected', 'all'] as const;
    const normalizedStatus = (allowed as readonly string[]).includes(status || '')
      ? (status as 'pending' | 'approved' | 'rejected' | 'all')
      : 'pending';
    return this.bankTransferService.listFinanceQueue({
      status: normalizedStatus,
      search,
      page,
      limit,
    });
  }

  /**
   * Aggregate KPI counts + amounts for the queue page header. "live"
   * metrics ignore date range (always now-snapshot); "window" metrics
   * honour the date range (defaults caller-side to 30d).
   */
  @Get('queue/summary')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getQueueSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.bankTransferService.getQueueSummary({ startDate, endDate });
  }

  /**
   * Full receipt context for the review drawer — refund info snapshot,
   * fresh signed download URL, student + course context.
   */
  @Get('queue/receipts/:receiptId')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getReceiptDetail(@Param('receiptId') receiptId: string) {
    return this.bankTransferService.getReceiptForReview(receiptId);
  }

  /**
   * Full upload history for the receipt's payment — every receipt ever
   * uploaded (including superseded ones), in chronological order. Used
   * by the drawer's "Replacement History" tab to show why earlier
   * uploads were rejected and what changed in re-uploads.
   */
  @Get('queue/receipts/:receiptId/replacement-chain')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getReplacementChain(@Param('receiptId') receiptId: string) {
    return this.bankTransferService.getReplacementChain(receiptId);
  }

  /**
   * Audit timeline: UNION across receipt-level events + parent payment
   * events + child invoice events + any refunds.
   */
  @Get('queue/receipts/:receiptId/audit')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getReceiptAudit(@Param('receiptId') receiptId: string) {
    return this.bankTransferService.getReceiptAudit(receiptId);
  }

  /**
   * Approve a pending receipt: payment → paid, enrollment activated,
   * invoice generated, confirmation email sent. Optional internal note
   * stays private to finance (never shown to the buyer).
   */
  @Patch('queue/receipts/:receiptId/approve')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async approveReceipt(
    @Param('receiptId') receiptId: string,
    @Body() body: { internalNote?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.bankTransferService.approveReceipt(receiptId, user, body, ipAddress);
  }

  /**
   * Reject a pending receipt: payment rolls back to pending so the student
   * can re-upload. `reviewerNote` is required (>=5 chars) and shown to the
   * student verbatim in the rejection email + the bank-transfer page.
   */
  @Patch('queue/receipts/:receiptId/reject')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async rejectReceipt(
    @Param('receiptId') receiptId: string,
    @Body() body: { reviewerNote: string; internalNote?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.bankTransferService.rejectReceipt(receiptId, user, body, ipAddress);
  }
}
