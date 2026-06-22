import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  DefaultValuePipe,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { EmailService } from '../../email/email.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
  ) {}

  @Get('verify/:invoiceNumber')
  @Public()
  async verifyInvoice(@Param('invoiceNumber') invoiceNumber: string) {
    const invoice = await this.invoiceService.getByInvoiceNumber(invoiceNumber);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.totalAmount,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      currency: 'SAR',
      issuedDate: invoice.issuedAt,
      paidDate: invoice.paidAt,
      buyerName: invoice.buyerName,
      courseTitle: invoice.courseTitle,
      courseTitleAr: invoice.courseTitleAr,
      gateway: invoice.gateway,
      paymentMethod: invoice.paymentMethod,
      itemCount: invoice.itemCount,
      verified: true,
    };
  }

  @Get('my-invoices')
  @Roles('STUDENT')
  async getMyInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.invoiceService.getInvoicesByUser(user.id, page, limit, status);
  }

  @Get(':id/pdf')
  @Roles('STUDENT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getInvoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Students can only access their own invoices
    // Finance/Admin roles can access any
    const isAdmin =
      user.roles.includes('FINANCE') ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');

    return this.invoiceService.getInvoicePdfUrl(
      id,
      isAdmin ? undefined : user.id,
    );
  }

  @Get(':id')
  @Roles('STUDENT', 'FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getInvoiceDetail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const invoice = await this.invoiceService.getInvoiceById(id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Students can only view their own invoices
    const isAdmin =
      user.roles.includes('FINANCE') ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');

    if (!isAdmin && invoice.userId !== user.id) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  @Get()
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAllInvoices(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('gateway') gateway?: string,
  ) {
    return this.invoiceService.getAllInvoices(
      page,
      limit,
      status,
      startDate,
      endDate,
      search,
      gateway,
    );
  }

  @Get('summary')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getInvoiceSummary(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('gateway') gateway?: string,
  ) {
    return this.invoiceService.getInvoiceSummary({
      status,
      startDate,
      endDate,
      search,
      gateway,
    });
  }

  @Get(':id/detail')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getAdminInvoiceDetail(@Param('id') id: string) {
    return this.invoiceService.getInvoiceDetail(id);
  }

  @Get(':id/audit')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getInvoiceAudit(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.invoiceService.getInvoiceAudit(id, limit);
  }

  @Post(':id/regenerate-pdf')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async regeneratePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoiceService.regeneratePdf(id, user.id);
  }

  @Post(':id/cancel')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async cancelInvoice(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const reason = (body?.reason || '').trim();
    if (reason.length < 4) {
      throw new BadRequestException('Cancellation reason is required (min 4 chars)');
    }
    return this.invoiceService.cancelInvoice(id, reason, user.id);
  }

  @Post('overdue-sweep/run')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async runOverdueSweep() {
    return this.invoiceService.sweepOverdueInvoices();
  }

  @Get('export.csv')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async exportCsv(
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('gateway') gateway?: string,
  ) {
    const csv = await this.invoiceService.exportInvoicesCsv({
      status,
      startDate,
      endDate,
      search,
      gateway,
    });
    const filename = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }

  @Post(':id/resend')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async resendInvoice(@Param('id') id: string) {
    const invoice = await this.invoiceService.getInvoiceById(id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    let pdfAttachment: { buffer: Buffer; filename: string } | undefined;
    try {
      const pdf = await this.invoiceService.getInvoicePdfBuffer(invoice.paymentId);
      if (pdf) pdfAttachment = pdf;
    } catch (_) {}

    await this.emailService.sendPaymentConfirmation(
      invoice.userId,
      invoice.paymentId,
      pdfAttachment,
    );

    return { sent: true, invoiceNumber: invoice.invoiceNumber };
  }
}
