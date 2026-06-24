import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminSettingsService } from '../../admin-settings/admin-settings.service';
import { decryptSecret, modeFromKeyPrefix } from './payments-secrets.util';

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

export type GatewaySource = 'db' | 'env' | 'mixed' | 'empty';
export type GatewayMode = 'test' | 'live';

export interface MoyasarCredentials {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  apiUrl: string;
  source: GatewaySource;
  /** test/live inferred from key prefix (sk_test_ vs sk_live_), or null
   *  when no key is configured / prefix is unrecognised. */
  mode: GatewayMode | null;
  /** Last 4 chars of the secret key (UI display). null if no secret. */
  lastFour: string | null;
}

export interface TamaraCredentials {
  apiToken: string;
  notificationToken: string;
  publicKey: string;
  apiUrl: string;
  source: GatewaySource;
  /** test/live decided by the stored `mode` field (admin-controlled) or
   *  derived from the API URL when no stored mode exists. */
  mode: GatewayMode | null;
  lastFour: string | null;
}

export interface TabbyCredentials {
  secretKey: string;
  publicKey: string;
  webhookSecret: string;
  merchantCode: string;
  apiUrl: string;
  source: GatewaySource;
  /** test/live inferred from key prefix. */
  mode: GatewayMode | null;
  lastFour: string | null;
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
  tamara?: {
    merchantToken?: string;
    secretKeyRef?: string | null;
    /** Admin-saved mode for Tamara — drives URL choice (sandbox vs prod). */
    mode?: 'test' | 'live';
  };
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

// Tamara URL constants — admin mode dropdown picks between these so admin
// can switch sandbox↔live without devops touching env vars. Both come from
// official Tamara docs.
const TAMARA_URLS = {
  test: 'https://api-sandbox.tamara.co',
  live: 'https://api.tamara.co',
} as const;

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
    const moySec = this.cfg('payments.moyasar.secretKey');
    const tabSec = this.cfg('payments.tabby.secretKey');
    const tamTok = this.cfg('payments.tamara.apiToken');
    const tamUrl = this.cfg('payments.tamara.apiUrl', 'https://api-sandbox.tamara.co');

    this.moyasar = {
      secretKey: moySec,
      publishableKey: this.cfg('payments.moyasar.publishableKey'),
      webhookSecret: this.cfg('payments.moyasar.webhookSecret'),
      apiUrl: this.cfg('payments.moyasar.apiUrl', 'https://api.moyasar.com/v1'),
      source: moySec ? 'env' : 'empty',
      mode: moySec ? this.modeFromMoyasarConfigOrPrefix(moySec) : null,
      lastFour: this.tailFour(moySec),
    };
    this.tamara = {
      apiToken: tamTok,
      notificationToken: this.cfg('payments.tamara.notificationToken'),
      publicKey: this.cfg('payments.tamara.publicKey', ''),
      apiUrl: tamUrl,
      source: tamTok ? 'env' : 'empty',
      mode: tamTok ? (tamUrl.includes('sandbox') ? 'test' : 'live') : null,
      lastFour: this.tailFour(tamTok),
    };
    this.tabby = {
      secretKey: tabSec,
      publicKey: this.cfg('payments.tabby.publicKey'),
      webhookSecret: this.cfg('payments.tabby.webhookSecret'),
      merchantCode: this.cfg('payments.tabby.merchantCode'),
      apiUrl: this.cfg('payments.tabby.apiUrl', 'https://api.tabby.ai/api/v2'),
      source: tabSec ? 'env' : 'empty',
      mode: tabSec ? modeFromKeyPrefix(tabSec) : null,
      lastFour: this.tailFour(tabSec),
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

  private tailFour(value: string | undefined): string | null {
    if (!value || value.length < 4) return null;
    return value.slice(-4);
  }

  /** Moyasar's MOYASAR_MODE env var is authoritative when set; fall back
   *  to key-prefix detection otherwise (matches admin-side UX). */
  private modeFromMoyasarConfigOrPrefix(key: string): GatewayMode | null {
    const cfgMode = this.cfg('payments.moyasar.mode').toLowerCase();
    if (cfgMode === 'live') return 'live';
    if (cfgMode === 'test') return 'test';
    return modeFromKeyPrefix(key);
  }

  private applyDbOverrides(db: DbPaymentsSettings): void {
    // ─── Moyasar ──────────────────────────────────────────────────
    // Publishable key is plain (safe to expose). Secret + webhook are
    // decrypted via decryptSecret (no-op for legacy plaintext rows).
    const moyDbPub = this.nonEmpty(db.moyasar?.publishableKey);
    const moyDbSec = decryptSecret(db.moyasar?.secretKeyRef);
    const moyDbHook = decryptSecret(db.webhookSecretRef);
    if (moyDbPub || moyDbSec || moyDbHook) {
      const envPub = this.cfg('payments.moyasar.publishableKey');
      const envSec = this.cfg('payments.moyasar.secretKey');
      const envHook = this.cfg('payments.moyasar.webhookSecret');
      const effectiveSec = moyDbSec || envSec;
      this.moyasar = {
        secretKey: effectiveSec,
        publishableKey: moyDbPub || envPub,
        webhookSecret: moyDbHook || envHook,
        apiUrl: this.cfg('payments.moyasar.apiUrl', 'https://api.moyasar.com/v1'),
        source: this.detectSource(
          [moyDbPub, moyDbSec, moyDbHook],
          [envPub, envSec, envHook],
        ),
        mode: effectiveSec ? this.modeFromMoyasarConfigOrPrefix(effectiveSec) : null,
        lastFour: this.tailFour(effectiveSec),
      };
    }

    // ─── Tamara ───────────────────────────────────────────────────
    // UI's `merchantToken` field maps to runtime apiToken; `secretKeyRef`
    // maps to notificationToken. Both are encrypted. Mode is admin-saved
    // and drives URL choice between sandbox and prod — overriding env.
    const tamDbTok = decryptSecret(db.tamara?.merchantToken);
    const tamDbNotif = decryptSecret(db.tamara?.secretKeyRef);
    const tamStoredMode = db.tamara?.mode;
    if (tamDbTok || tamDbNotif || tamStoredMode) {
      const envTok = this.cfg('payments.tamara.apiToken');
      const envNotif = this.cfg('payments.tamara.notificationToken');
      const envUrl = this.cfg('payments.tamara.apiUrl', 'https://api-sandbox.tamara.co');
      const effectiveTok = tamDbTok || envTok;
      // Stored mode wins; else infer from existing env URL.
      const effectiveMode: GatewayMode | null = tamStoredMode
        ? tamStoredMode
        : effectiveTok
          ? envUrl.includes('sandbox') ? 'test' : 'live'
          : null;
      this.tamara = {
        apiToken: effectiveTok,
        notificationToken: tamDbNotif || envNotif,
        publicKey: this.cfg('payments.tamara.publicKey', ''),
        // Admin mode dropdown picks the URL — devops env stays as fallback.
        apiUrl: effectiveMode ? TAMARA_URLS[effectiveMode] : envUrl,
        source: this.detectSource([tamDbTok, tamDbNotif], [envTok, envNotif]),
        mode: effectiveMode,
        lastFour: this.tailFour(effectiveTok),
      };
    }

    // ─── Tabby ────────────────────────────────────────────────────
    const tabDbPub = this.nonEmpty(db.tabby?.publicKey);
    const tabDbSec = decryptSecret(db.tabby?.secretKeyRef);
    if (tabDbPub || tabDbSec) {
      const envPub = this.cfg('payments.tabby.publicKey');
      const envSec = this.cfg('payments.tabby.secretKey');
      const envHook = this.cfg('payments.tabby.webhookSecret');
      const effectiveSec = tabDbSec || envSec;
      this.tabby = {
        secretKey: effectiveSec,
        publicKey: tabDbPub || envPub,
        webhookSecret: envHook, // not exposed in admin UI yet; env-only
        merchantCode: this.cfg('payments.tabby.merchantCode'),
        apiUrl: this.cfg('payments.tabby.apiUrl', 'https://api.tabby.ai/api/v2'),
        source: this.detectSource([tabDbPub, tabDbSec], [envPub, envSec]),
        mode: effectiveSec ? modeFromKeyPrefix(effectiveSec) : null,
        lastFour: this.tailFour(effectiveSec),
      };
    }

    // ─── Bank transfer ───────────────────────────────────────────
    // DB-only; env has no equivalent fields. Empty means the admin hasn't
    // configured it yet, in which case the public checkout falls through
    // to whatever fallback the controller chooses.
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

  /**
   * Classify where the active credentials came from.
   *   - 'empty' → both DB and env are empty
   *   - 'env'   → DB is empty, env has values
   *   - 'db'    → DB has values, env is empty
   *   - 'mixed' → both populated (some fields from DB, some fallback to env)
   */
  private detectSource(
    dbValues: Array<string | null | undefined>,
    envValues: Array<string | null | undefined>,
  ): GatewaySource {
    const dbAny = dbValues.some((v) => !!v && v.length > 0);
    const envAny = envValues.some((v) => !!v && v.length > 0);
    if (!dbAny && !envAny) return 'empty';
    if (dbAny && !envAny) return 'db';
    if (!dbAny && envAny) return 'env';
    // Both populated — if every DB slot is filled, treat as pure db; if
    // any DB slot was empty (admin only rotated one of two), 'mixed'.
    const allDbFilled = dbValues.every((v) => !!v && v.length > 0);
    return allDbFilled ? 'db' : 'mixed';
  }

  private cfg(key: string, fallback = ''): string {
    return this.configService.get<string>(key) ?? fallback;
  }

  private nonEmpty(v: string | null | undefined): string | null {
    return v && v.trim().length > 0 ? v.trim() : null;
  }
}
