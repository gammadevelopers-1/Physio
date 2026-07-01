import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';

export type NelcMode = 'staging' | 'production';

const CATEGORY = 'nelc';

interface NelcCategoryValue {
  mode?: NelcMode;
  updatedByEmail?: string;
}

export interface NelcActiveConfig {
  mode: NelcMode;
  /** Where the active mode resolved from — useful in admin UI / logs */
  source: 'db' | 'env' | 'default';
  endpoint: string;
  username: string;
  password: string;
  /** True only when the password for the active mode is actually loaded
   *  (i.e. the corresponding Secret Manager value made it into env).
   *  When false, callers should refuse to POST. */
  hasPassword: boolean;
}

/**
 * Single source of truth for which NELC LRS the platform is talking to.
 *
 * Why this lives separately from nelc.config.ts:
 *   - Mode is admin-toggleable from the UI (persisted in system_settings)
 *   - Mode falls back to env var, then 'staging' (fail-safe — accidental
 *     production traffic is impossible without explicit action)
 *   - LrsClient resolves once per POST without hitting the DB (30s cache,
 *     same TTL as AdminSettingsService)
 *
 * The companion {@link setMode} flips the DB row + invalidates this cache
 * AND the AdminSettingsService cache so the next LRS POST picks the new
 * endpoint within milliseconds.
 */
@Injectable()
export class NelcModeService {
  private readonly logger = new Logger(NelcModeService.name);
  private cached: NelcActiveConfig | null = null;
  private cachedAt = 0;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly adminSettings: AdminSettingsService,
  ) {
    // Wipe our cache the moment an admin saves the nelc category.
    this.adminSettings.onCategoryChange(CATEGORY, () => this.invalidate());
  }

  /** Resolve {mode, endpoint, password} for the active environment.
   *  Order: system_settings.nelc.mode → env default → 'staging'. */
  async getActive(): Promise<NelcActiveConfig> {
    if (this.cached && Date.now() - this.cachedAt < this.CACHE_TTL_MS) {
      return this.cached;
    }

    let mode: NelcMode;
    let source: NelcActiveConfig['source'];

    try {
      const row = await this.adminSettings.getCategory<NelcCategoryValue>(
        CATEGORY,
      );
      if (row?.mode === 'production' || row?.mode === 'staging') {
        mode = row.mode;
        source = 'db';
      } else {
        const envMode = this.configService.get<NelcMode>('nelc.defaultMode');
        mode = envMode === 'production' ? 'production' : 'staging';
        source = envMode ? 'env' : 'default';
      }
    } catch (err) {
      this.logger.warn(
        `[NELC] mode lookup failed (${(err as Error).message}) — defaulting to staging`,
      );
      mode = 'staging';
      source = 'default';
    }

    const endpoint =
      mode === 'production'
        ? this.configService.get<string>('nelc.endpointProd') || ''
        : this.configService.get<string>('nelc.endpointStaging') || '';
    const username = this.configService.get<string>('nelc.username') || '';
    const password =
      mode === 'production'
        ? this.configService.get<string>('nelc.passwordProd') || ''
        : this.configService.get<string>('nelc.passwordStaging') || '';

    const active: NelcActiveConfig = {
      mode,
      source,
      endpoint,
      username,
      password,
      hasPassword: Boolean(password),
    };
    this.cached = active;
    this.cachedAt = Date.now();
    return active;
  }

  /** Persist a new mode + invalidate caches. Audit trail lives in
   *  system_settings.updated_by / updated_at. Throws when the target
   *  mode's password isn't loaded (refuses to half-cut over). */
  async setMode(mode: NelcMode, actorId: string, actorEmail?: string): Promise<NelcActiveConfig> {
    if (mode !== 'staging' && mode !== 'production') {
      throw new Error(`Invalid NELC mode: ${mode}`);
    }
    const targetPassword =
      mode === 'production'
        ? this.configService.get<string>('nelc.passwordProd') || ''
        : this.configService.get<string>('nelc.passwordStaging') || '';
    if (!targetPassword) {
      throw new Error(
        `Cannot switch to ${mode}: password is not loaded (NELC_LRS_PASSWORD${
          mode === 'production' ? '_PROD' : ''
        } missing in Secret Manager)`,
      );
    }

    await this.adminSettings.updateCategory(
      CATEGORY,
      {
        mode,
        ...(actorEmail ? { updatedByEmail: actorEmail } : {}),
      },
      actorId,
    );
    this.invalidate();
    this.logger.warn(
      `[NELC] mode switched to ${mode.toUpperCase()} by ${actorEmail ?? actorId}`,
    );
    return this.getActive();
  }

  invalidate(): void {
    this.cached = null;
    this.cachedAt = 0;
  }
}
