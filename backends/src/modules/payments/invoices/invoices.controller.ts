import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceService } from '../services/invoice.service';
import { EmailService } from '../../email/email.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@Controller('invoices')
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
      currency: 'SAR',
      issuedDate: invoice.issuedAt,
      paidDate: invoice.paidAt,
      verified: true,
    };
  }

  @Get('my-invoices')
  @Roles('STUDENT')
  async getMyInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.invoiceService.getInvoicesByUser(user.id, page, limit);
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
  ) {
    return this.invoiceService.getAllInvoices(page, limit);
  }

  @Post(':id/resend')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async resendInvoice(@Param('id') id: string) {
    const invoice = await this.invoiceService.getInvoiceById(id);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    await this.emailService.sendPaymentConfirmation(
      invoice.userId,
      invoice.paymentId,
    );

    return { sent: true, invoiceNumber: invoice.invoiceNumber };
  }
}
