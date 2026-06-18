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
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { BankTransferService } from './bank-transfer.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
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
   * Full receipt context for the review modal — refund info snapshot,
   * fresh signed download URL, student + course context.
   */
  @Get('queue/receipts/:receiptId')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getReceiptDetail(@Param('receiptId') receiptId: string) {
    return this.bankTransferService.getReceiptForReview(receiptId);
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
