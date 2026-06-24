import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminSettingsService } from '../../admin-settings/admin-settings.service';

/**
 * Per-gateway credential snapshot. Sync getters return the active values
 * (DB > env), so gateway services don't need to await on every charge.
 *
 * The cache refreshes on boot, when the admin saves payment settings
 * (via `markDirty()`), and lazily on next access if the TTL has elapsed.
 *
 * Empty strings in the DB row are treated as "not configured" so admin
 * clearing a field falls back to env automatically rather than breaking
 * the gateway.
 */

export interface MoyasarCredentials {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  apiUrl: string;
  source: 'db' | 'env' | 'mixed';
}

export interface TamaraCredentials {
  apiToken: string;
  notificationToken: string;
  publicKey: string;
  apiUrl: string;
  source: 'db' | 'env' | 'mixed';
}

export interface TabbyCredentials {
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  merchantCode: string;
  apiUrl: string;
  source: 'db' | 'env' | 'mixed';
}

export interface BankTransferCredentials {
  bankNameEn: string;
  bankNameAr: string;
  beneficiaryEn: string;
  beneficiaryAr: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  instructionsEn: string;
  instructionsAr: string;
  source: 'db' | 'env' | 'empty';
}

interface DbPaymentsSettings {
  gateway?: string;
  testMode?: boolean;
  currency?: string;
  moyasar?: { publishableKey?: string; secretKeyRef?: string | null };
  tamara?: { merchantToken?: string; secretKeyRef?: string | null };
  tabby?: { publicKey?: string; secretKeyRef?: string | null };
  bankTransfer?: {
    bankNameEn?: string;
    bankNameAr?: string;
    beneficiaryEn?: string;
    beneficiaryAr?: string;
    accountNumber?: string;
    iban?: string;
    swiftCode?: string;
    instructionsEn?: string;
    instructionsAr?: string;
  };
  webhookSecretRef?: string | null;
}

@Injectable()
export class GatewayCredentialsService implements OnModuleInit {
  private readonly logger = new Logger(GatewayCredentialsService.name);
  private readonly CACHE_TTL_MS = 30_000;

  private moyasar!: MoyasarCredentials;
  private tamara!: TamaraCredentials;
  private tabby!: TabbyCredentials;
  private bankTransfer!: BankTransferCredentials;
  private expiresAt = 0;
  private refreshPromise: Promise<void> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly adminSettings: AdminSettingsService,
  ) {
    this.applyEnvDefaults();
  }

  async onModuleInit() {
    // Eager DB pull on boot so the very first payment after deploy uses
    // the latest admin-saved values, not just env. Plus a listener so
    // admin-side saves invalidate immediately, not after TTL.
    this.adminSettings.onCategoryChange('payments', () => this.markDirty());
    await this.refresh();
  }

  /** Admin-settings update handler calls this so the cache invalidates
   *  immediately after a save and the next gateway call reads fresh. */
  markDirty(): void {
    this.expiresAt = 0;
  }

  getMoyasar(): MoyasarCredentials {
    this.maybeRefreshInBackground();
    return this.moyasar;
  }

  getTamara(): TamaraCredentials {
    this.maybeRefreshInBackground();
    return this.tamara;
  }

  getTabby(): TabbyCredentials {
    this.maybeRefreshInBackground();
    return this.tabby;
  }

  getBankTransfer(): BankTransferCredentials {
    this.maybeRefreshInBackground();
    return this.bankTransfer;
  }

  /**
   * Force a refresh from DB. Called on boot + after admin saves payment
   * settings. Safe to call concurrently — re-uses a pending refresh.
   */
  async refresh(): Promise<void> {
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }
    this.refreshPromise = (async () => {
      try {
        const db = await this.adminSettings.getCategory<DbPaymentsSettings>(
          'payments',
        );
        this.applyDbOverrides(db);
        this.expiresAt = Date.now() + this.CACHE_TTL_MS;
      } catch (err) {
        this.logger.warn(
          `Failed to refresh gateway credentials from DB; staying on prior values: ${(err as Error).message}`,
        );
      } finally {
        this.refreshPromise = null;
      }
    })();
    await this.refreshPromise;
  }

  private maybeRefreshInBackground(): void {
    if (Date.now() < this.expiresAt) return;
    // Fire-and-forget — current request continues with stale-but-valid
    // values; the next one reads the refreshed cache.
    void this.refresh();
  }

  private applyEnvDefaults(): void {
    this.moyasar = {
      secretKey: this.cfg('payments.moyasar.secretKey'),
      publishableKey: this.cfg('payments.moyasar.publishableKey'),
      webhookSecret: this.cfg('payments.moyasar.webhookSecret'),
      apiUrl: this.cfg('payments.moyasar.apiUrl', 'https://api.moyasar.com/v1'),
      source: 'env',
    };
    this.tamara = {
      apiToken: this.cfg('payments.tamara.apiToken'),
      notificationToken: this.cfg('payments.tamara.notificationToken'),
      publicKey: this.cfg('payments.tamara.publicKey', ''),
      apiUrl: this.cfg('payments.tamara.apiUrl', 'https://api-sandbox.tamara.co'),
      source: 'env',
    };
    this.tabby = {
      secretKey: this.cfg('payments.tabby.secretKey'),
      publicKey: this.cfg('payments.tabby.publicKey'),
      webhookSecret: this.cfg('payments.tabby.webhookSecret'),
      merchantCode: this.cfg('payments.tabby.merchantCode'),
      apiUrl: this.cfg('payments.tabby.apiUrl', 'https://api.tabby.ai/api/v2'),
      source: 'env',
    };
    this.bankTransfer = {
      bankNameEn: '',
      bankNameAr: '',
      beneficiaryEn: '',
      beneficiaryAr: '',
      accountNumber: '',
      iban: '',
      swiftCode: '',
      instructionsEn: '',
      instructionsAr: '',
      source: 'empty',
    };
  }

  private applyDbOverrides(db: DbPaymentsSettings): void {
    // Moyasar
    const moyasarPub = this.nonEmpty(db.moyasar?.publishableKey);
    const moyasarSec = this.nonEmpty(db.moyasar?.secretKeyRef);
    const moyasarHook = this.nonEmpty(db.webhookSecretRef);
    if (moyasarPub || moyasarSec || moyasarHook) {
      const envPub = this.cfg('payments.moyasar.publishableKey');
      const envSec = this.cfg('payments.moyasar.secretKey');
      const envHook = this.cfg('payments.moyasar.webhookSecret');
      this.moyasar = {
        secretKey: moyasarSec || envSec,
        publishableKey: moyasarPub || envPub,
        webhookSecret: moyasarHook || envHook,
        apiUrl: this.cfg('payments.moyasar.apiUrl', 'https://api.moyasar.com/v1'),
        source: moyasarSec && envSec && moyasarSec !== envSec ? 'db'
          : (moyasarSec || moyasarPub || moyasarHook) ? 'mixed' : 'env',
      };
    }

    // Tamara — DB field `merchantToken` maps to env `apiToken`; webhook is
    // shared `webhookSecretRef` (one secret for all webhooks in admin UI).
    const tamaraTok = this.nonEmpty(db.tamara?.merchantToken);
    const tamaraSec = this.nonEmpty(db.tamara?.secretKeyRef);
    if (tamaraTok || tamaraSec) {
      const envTok = this.cfg('payments.tamara.apiToken');
      const envNotif = this.cfg('payments.tamara.notificationToken');
      this.tamara = {
        apiToken: tamaraTok || envTok,
        notificationToken: tamaraSec || envNotif,
        publicKey: this.cfg('payments.tamara.publicKey', ''),
        apiUrl: this.cfg('payments.tamara.apiUrl', 'https://api-sandbox.tamara.co'),
        source: (tamaraTok && envTok && tamaraTok !== envTok) ? 'db'
          : (tamaraTok || tamaraSec) ? 'mixed' : 'env',
      };
    }

    // Tabby
    const tabbyPub = this.nonEmpty(db.tabby?.publicKey);
    const tabbySec = this.nonEmpty(db.tabby?.secretKeyRef);
    if (tabbyPub || tabbySec) {
      const envPub = this.cfg('payments.tabby.publicKey');
      const envSec = this.cfg('payments.tabby.secretKey');
      const envHook = this.cfg('payments.tabby.webhookSecret');
      this.tabby = {
        secretKey: tabbySec || envSec,
        publicKey: tabbyPub || envPub,
        webhookSecret: envHook, // not exposed in admin UI; env-only
        merchantCode: this.cfg('payments.tabby.merchantCode'),
        apiUrl: this.cfg('payments.tabby.apiUrl', 'https://api.tabby.ai/api/v2'),
        source: (tabbySec && envSec && tabbySec !== envSec) ? 'db'
          : (tabbySec || tabbyPub) ? 'mixed' : 'env',
      };
    }

    // Bank transfer — DB-only; env has no equivalent fields. Empty means
    // the admin hasn't configured it yet, in which case the public
    // checkout falls through to whatever fallback the controller chooses.
    const bt = db.bankTransfer ?? {};
    const anyBankField =
      this.nonEmpty(bt.bankNameEn) ||
      this.nonEmpty(bt.bankNameAr) ||
      this.nonEmpty(bt.accountNumber) ||
      this.nonEmpty(bt.iban);
    if (anyBankField) {
      this.bankTransfer = {
        bankNameEn: bt.bankNameEn ?? '',
        bankNameAr: bt.bankNameAr ?? '',
        beneficiaryEn: bt.beneficiaryEn ?? '',
        beneficiaryAr: bt.beneficiaryAr ?? '',
        accountNumber: bt.accountNumber ?? '',
        iban: bt.iban ?? '',
        swiftCode: bt.swiftCode ?? '',
        instructionsEn: bt.instructionsEn ?? '',
        instructionsAr: bt.instructionsAr ?? '',
        source: 'db',
      };
    }
  }

  private cfg(key: string, fallback = ''): string {
    return this.configService.get<string>(key) ?? fallback;
  }

  private nonEmpty(v: string | null | undefined): string | null {
    return v && v.trim().length > 0 ? v.trim() : null;
  }
}
