import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import {
  systemSettings,
  courses,
  type VatTreatment,
  VAT_TREATMENT,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';

/**
 * Tax Computation — single source of truth for VAT math.
 *
 * Reads the finance-managed global tax settings from
 * `system_settings.tax` and the per-course `vat_treatment` override
 * from the courses row, returning the final VAT for any taxable
 * amount. The VAT rate AND treatment used at compute time are
 * returned so callers can store them on the invoice metadata — past
 * invoices then render with the rate that applied at the time.
 */

export interface TaxSettings {
  vatEnabled: boolean;
  vatRate: number;                 // percent (e.g. 15)
  taxNumber: string;               // ZATCA tax registration number
  companyNameEn: string;
  companyNameAr: string;
  defaultVatTreatment: VatTreatment;
}

export interface TaxComputation {
  vatRate: number;                 // effective rate applied (0 for exempt/zero_rated)
  vatAmount: number;
  treatment: VatTreatment;
  taxableAmount: number;
  total: number;                   // taxableAmount + vatAmount
}

const DEFAULT_SETTINGS: TaxSettings = {
  vatEnabled: true,
  vatRate: 15,
  taxNumber: '',
  companyNameEn: 'PhysioGuidance',
  companyNameAr: 'فيزيوقايدنس',
  defaultVatTreatment: VAT_TREATMENT.STANDARD,
};

const CATEGORY = 'tax';
const CACHE_TTL_MS = 30_000;

@Injectable()
export class TaxComputationService {
  private readonly logger = new Logger(TaxComputationService.name);
  private cached: { settings: TaxSettings; expiresAt: number } | null = null;

  constructor(private readonly auditLogService: AuditLogService) {}

  async getSettings(): Promise<TaxSettings> {
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return this.cached.settings;
    }
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.category, CATEGORY))
      .limit(1);

    const settings = this.mergeWithDefaults(row?.value as Partial<TaxSettings> | undefined);
    this.cached = { settings, expiresAt: Date.now() + CACHE_TTL_MS };
    return settings;
  }

  async updateSettings(
    input: TaxSettings,
    actorId: string,
    ipAddress?: string,
  ): Promise<TaxSettings> {
    const before = await this.getSettings();
    await db
      .insert(systemSettings)
      .values({
        category: CATEGORY,
        value: input,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.category,
        set: {
          value: input,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      });

    this.cached = null;

    await this.auditLogService.log({
      entityType: 'tax_settings',
      entityId: CATEGORY,
      action: 'tax_settings_updated',
      performedBy: actorId,
      ipAddress,
      metadata: { before, after: input },
    });

    return input;
  }

  /**
   * Compute VAT for a course at a given taxable amount.
   *
   * Rules:
   * - VAT disabled globally → 0% (no VAT line)
   * - Course `exempt` → 0% (no VAT line)
   * - Course `zero_rated` → 0% BUT keep the treatment label so the
   *   invoice renders a "Zero-rated (0%)" row for ZATCA reporting
   * - Course `standard` (or unknown) → global rate
   */
  async computeForCourse(
    courseId: string | null | undefined,
    taxableAmount: number,
  ): Promise<TaxComputation> {
    const settings = await this.getSettings();
    let treatment: VatTreatment = settings.defaultVatTreatment;

    if (courseId) {
      const [row] = await db
        .select({ vatTreatment: courses.vatTreatment })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);
      if (row?.vatTreatment) {
        treatment = row.vatTreatment as VatTreatment;
      }
    }

    const safeTaxable = Number((taxableAmount || 0).toFixed(2));

    if (!settings.vatEnabled || treatment === VAT_TREATMENT.EXEMPT) {
      return {
        vatRate: 0,
        vatAmount: 0,
        treatment: VAT_TREATMENT.EXEMPT,
        taxableAmount: safeTaxable,
        total: safeTaxable,
      };
    }
    if (treatment === VAT_TREATMENT.ZERO_RATED) {
      return {
        vatRate: 0,
        vatAmount: 0,
        treatment: VAT_TREATMENT.ZERO_RATED,
        taxableAmount: safeTaxable,
        total: safeTaxable,
      };
    }

    const rate = Math.max(0, settings.vatRate);
    const vatAmount = Number((safeTaxable * (rate / 100)).toFixed(2));
    return {
      vatRate: rate,
      vatAmount,
      treatment: VAT_TREATMENT.STANDARD,
      taxableAmount: safeTaxable,
      total: Number((safeTaxable + vatAmount).toFixed(2)),
    };
  }

  /** Public-safe projection — what the storefront/cart can see. */
  async getPublicDisplay(): Promise<{
    vatEnabled: boolean;
    vatRate: number;
    defaultVatTreatment: VatTreatment;
  }> {
    const s = await this.getSettings();
    return {
      vatEnabled: s.vatEnabled,
      vatRate: s.vatRate,
      defaultVatTreatment: s.defaultVatTreatment,
    };
  }

  private mergeWithDefaults(stored: Partial<TaxSettings> | undefined): TaxSettings {
    if (!stored) return DEFAULT_SETTINGS;
    return {
      vatEnabled: stored.vatEnabled ?? DEFAULT_SETTINGS.vatEnabled,
      vatRate: stored.vatRate ?? DEFAULT_SETTINGS.vatRate,
      taxNumber: stored.taxNumber ?? DEFAULT_SETTINGS.taxNumber,
      companyNameEn: stored.companyNameEn ?? DEFAULT_SETTINGS.companyNameEn,
      companyNameAr: stored.companyNameAr ?? DEFAULT_SETTINGS.companyNameAr,
      defaultVatTreatment:
        stored.defaultVatTreatment ?? DEFAULT_SETTINGS.defaultVatTreatment,
    };
  }
}
