import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../../database';
import {
  systemSettings,
  users,
  courses,
  payments,
  PAYMENT_STATUS,
} from '../../../database/schema';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { RefundPolicyService } from '../services/refund-policy.service';
import { TaxComputationService } from '../services/tax-computation.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { lastFourOfSecret } from '../gateways/payments-secrets.util';
import { UpdateRefundPolicyDto } from '../dto/update-refund-policy.dto';
import { UpdateTaxSettingsDto } from '../dto/update-tax-settings.dto';
import {
  BulkUpdateVatTreatmentDto,
  UpdateVatTreatmentDto,
} from '../dto/update-vat-treatment.dto';

/**
 * Finance-facing read of payment-gateway configuration.
 *
 * The authoritative copy lives in `system_settings.payments` and is written
 * only by admins via the AdminSettingsController. Finance staff get a
 * sanitized projection here so they can verify what's wired up without
 * needing admin access and without secrets crossing the wire.
 */

interface BankTransferBlock {
  bankName?: string;
  accountHolder?: string;
  bankNameEn?: string;
  bankNameAr?: string;
  beneficiaryEn?: string;
  beneficiaryAr?: string;
  accountNumber?: string;
  iban?: string;
  swiftCode?: string;
  instructionsEn?: string;
  instructionsAr?: string;
}

interface PaymentsSettings {
  gateway?: 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer';
  testMode?: boolean;
  currency?: string;
  moyasar?: { publishableKey?: string; secretKeyRef?: string | null };
  tamara?: { merchantToken?: string; secretKeyRef?: string | null };
  tabby?: { publicKey?: string; secretKeyRef?: string | null };
  bankTransfer?: BankTransferBlock;
  webhookSecretRef?: string | null;
  invoiceFooterEn?: string;
  invoiceFooterAr?: string;
  autoSendReceipt?: boolean;
}

const truthy = (v: unknown): boolean =>
  typeof v === 'string' ? v.trim().length > 0 : Boolean(v);

// Mask a stored secret for display. Handles both encrypted (v1:...) and
// legacy plaintext rows by routing through lastFourOfSecret which
// decrypts transparently. Returns null when the field is empty.
const maskStoredSecret = (
  raw: string | undefined | null,
): string | null => {
  if (!raw) return null;
  const four = lastFourOfSecret(raw);
  return four ? `••••${four}` : '••••';
};

@Controller('finance/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceSettingsController {
  constructor(
    private readonly refundPolicyService: RefundPolicyService,
    private readonly taxComputationService: TaxComputationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('gateways')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getGatewayView() {
    const [row] = await db
      .select({
        value: systemSettings.value,
        updatedAt: systemSettings.updatedAt,
        updatedByFirstName: users.firstName,
        updatedByLastName: users.lastName,
        updatedByEmail: users.email,
        updatedById: users.id,
      })
      .from(systemSettings)
      .leftJoin(users, eq(users.id, systemSettings.updatedBy))
      .where(eq(systemSettings.category, 'payments'))
      .limit(1);

    const s = (row?.value ?? {}) as PaymentsSettings;
    const bt = s.bankTransfer ?? {};

    return {
      activeGateway: s.gateway ?? null,
      testMode: s.testMode ?? false,
      currency: s.currency ?? 'SAR',
      moyasar: {
        publishableKey: s.moyasar?.publishableKey?.trim() || null,
        hasSecret: truthy(s.moyasar?.secretKeyRef),
        secretMasked: maskStoredSecret(s.moyasar?.secretKeyRef),
      },
      tamara: {
        hasMerchantToken: truthy(s.tamara?.merchantToken),
        merchantTokenMasked: maskStoredSecret(s.tamara?.merchantToken),
        hasSecret: truthy(s.tamara?.secretKeyRef),
        secretMasked: maskStoredSecret(s.tamara?.secretKeyRef),
      },
      tabby: {
        publicKey: s.tabby?.publicKey?.trim() || null,
        hasSecret: truthy(s.tabby?.secretKeyRef),
        secretMasked: maskStoredSecret(s.tabby?.secretKeyRef),
      },
      bankTransfer: {
        bankNameEn: bt.bankNameEn ?? bt.bankName ?? '',
        bankNameAr: bt.bankNameAr ?? '',
        beneficiaryEn: bt.beneficiaryEn ?? bt.accountHolder ?? '',
        beneficiaryAr: bt.beneficiaryAr ?? '',
        accountNumber: bt.accountNumber ?? '',
        iban: bt.iban ?? '',
        swiftCode: bt.swiftCode ?? '',
        instructionsEn: bt.instructionsEn ?? '',
        instructionsAr: bt.instructionsAr ?? '',
      },
      hasWebhookSecret: truthy(s.webhookSecretRef),
      invoiceFooterEn: s.invoiceFooterEn ?? '',
      invoiceFooterAr: s.invoiceFooterAr ?? '',
      autoSendReceipt: s.autoSendReceipt ?? false,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.updatedById
        ? {
            id: row.updatedById,
            name: [row.updatedByFirstName, row.updatedByLastName]
              .filter(Boolean)
              .join(' ')
              .trim() || row.updatedByEmail || 'Unknown',
            email: row.updatedByEmail || null,
          }
        : null,
    };
  }

  // ─── Refund Policy ────────────────────────────────────────────────
  // The current policy + the lookup metadata (who last touched it,
  // when). UI uses the metadata to show a "last updated by X" line.

  @Get('refund-policy')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getRefundPolicy() {
    const policy = await this.refundPolicyService.getPolicy();
    const [row] = await db
      .select({
        updatedAt: systemSettings.updatedAt,
        updatedByFirstName: users.firstName,
        updatedByLastName: users.lastName,
        updatedByEmail: users.email,
        updatedById: users.id,
      })
      .from(systemSettings)
      .leftJoin(users, eq(users.id, systemSettings.updatedBy))
      .where(eq(systemSettings.category, 'refund_policy'))
      .limit(1);

    return {
      policy,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.updatedById
        ? {
            id: row.updatedById,
            name: [row.updatedByFirstName, row.updatedByLastName]
              .filter(Boolean)
              .join(' ')
              .trim() || row.updatedByEmail || 'Unknown',
            email: row.updatedByEmail || null,
          }
        : null,
    };
  }

  @Put('refund-policy')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async updateRefundPolicy(
    @Body() dto: UpdateRefundPolicyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const policy = await this.refundPolicyService.updatePolicy(
      dto,
      user.id,
      ipAddress,
    );
    return { policy };
  }

  // ─── Tax Settings ────────────────────────────────────────────────
  // Global VAT rate + ZATCA tax number + company name. The rate +
  // treatment used at payment time are snapshotted on the payment's
  // metadata so historical invoices keep their original numbers.

  @Get('tax')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getTaxSettings() {
    const settings = await this.taxComputationService.getSettings();
    const [row] = await db
      .select({
        updatedAt: systemSettings.updatedAt,
        updatedByFirstName: users.firstName,
        updatedByLastName: users.lastName,
        updatedByEmail: users.email,
        updatedById: users.id,
      })
      .from(systemSettings)
      .leftJoin(users, eq(users.id, systemSettings.updatedBy))
      .where(eq(systemSettings.category, 'tax'))
      .limit(1);

    return {
      settings,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.updatedById
        ? {
            id: row.updatedById,
            name: [row.updatedByFirstName, row.updatedByLastName]
              .filter(Boolean)
              .join(' ')
              .trim() || row.updatedByEmail || 'Unknown',
            email: row.updatedByEmail || null,
          }
        : null,
    };
  }

  @Put('tax')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async updateTaxSettings(
    @Body() dto: UpdateTaxSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const settings = await this.taxComputationService.updateSettings(
      dto,
      user.id,
      ipAddress,
    );
    return { settings };
  }

  // ─── Per-course VAT treatments ───────────────────────────────────
  // Searchable, paginated list of courses with their current treatment
  // + last-90-day sales count so finance can prioritise high-revenue
  // courses when picking exemptions.

  @Get('vat-treatments')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async listVatTreatments(
    @Query('search') search?: string,
    @Query('treatment') treatment?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    const page = Math.max(1, Number(pageStr) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(pageSizeStr) || 25));
    const offset = (page - 1) * pageSize;

    const filters: ReturnType<typeof and>[] = [];
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      filters.push(or(ilike(courses.title, term), ilike(courses.titleAr, term)));
    }
    if (treatment && treatment !== 'all') {
      if (!['standard', 'exempt', 'zero_rated'].includes(treatment)) {
        throw new BadRequestException('Invalid treatment filter');
      }
      filters.push(eq(courses.vatTreatment, treatment));
    }
    const whereClause = filters.length ? and(...filters) : undefined;

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        deliveryType: courses.deliveryType,
        price: courses.price,
        vatTreatment: courses.vatTreatment,
        salesCount: sql<number>`(
          SELECT COUNT(*)::int FROM ${payments}
          WHERE ${payments.courseId} = ${courses.id}
            AND ${payments.status} = ${PAYMENT_STATUS.PAID}
            AND ${payments.paidAt} >= ${ninetyDaysAgo}
        )`,
      })
      .from(courses)
      .where(whereClause)
      .orderBy(desc(courses.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [totalRow] = await db
      .select({ total: count() })
      .from(courses)
      .where(whereClause);

    return {
      data: rows,
      page,
      pageSize,
      total: totalRow?.total ?? 0,
    };
  }

  @Put('vat-treatments/:courseId')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async updateVatTreatment(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: UpdateVatTreatmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const [before] = await db
      .select({ vatTreatment: courses.vatTreatment, title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!before) {
      throw new BadRequestException('Course not found');
    }

    await db
      .update(courses)
      .set({ vatTreatment: dto.treatment, updatedAt: new Date() })
      .where(eq(courses.id, courseId));

    await this.auditLogService.log({
      entityType: 'course_vat_treatment',
      entityId: courseId,
      action: 'vat_treatment_updated',
      performedBy: user.id,
      ipAddress,
      metadata: {
        courseTitle: before.title,
        before: before.vatTreatment,
        after: dto.treatment,
      },
    });

    return { courseId, treatment: dto.treatment };
  }

  @Post('vat-treatments/bulk')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async bulkUpdateVatTreatment(
    @Body() dto: BulkUpdateVatTreatmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const updated = await db
      .update(courses)
      .set({ vatTreatment: dto.treatment, updatedAt: new Date() })
      .where(inArray(courses.id, dto.courseIds))
      .returning({ id: courses.id });

    await this.auditLogService.log({
      entityType: 'course_vat_treatment',
      entityId: `bulk-${updated.length}`,
      action: 'vat_treatment_bulk_updated',
      performedBy: user.id,
      ipAddress,
      metadata: {
        treatment: dto.treatment,
        courseIds: updated.map((r) => r.id),
        count: updated.length,
      },
    });

    return { count: updated.length };
  }
}
