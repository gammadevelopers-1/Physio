import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { randomUUID } from 'crypto';

/**
 * Redis-backed distributed lock for cross-instance @Cron dedup.
 *
 * When api-web autoscales to N instances, an in-process `@Cron` method
 * fires on every instance simultaneously — that's N × the intended
 * work. Existing crons defended against this via per-row CAS UPDATEs;
 * we generalise here so any cron can wrap its body in withLock() and
 * only one instance runs the body per tick.
 *
 * Correctness anchors:
 *   1. Lock acquisition is atomic (SET NX EX). No TOCTOU.
 *   2. Every lock carries a random token; only the holder releases it,
 *      via a Lua script that CAS-checks the token. This prevents
 *      instance A's expired lock from being released by instance B
 *      that has since acquired the same key.
 *   3. TTL is a hard ceiling on lock hold time. If the cron body takes
 *      longer than TTL, another instance can acquire — set TTL >> your
 *      expected max cron runtime.
 *   4. Lock release is best-effort — if Redis dies during the cron
 *      body, the TTL will eventually free the key. Never rely on
 *      release completing for correctness.
 *
 * Falls back to "no lock" behaviour (always acquire) when Redis is
 * unavailable, matching how BullModule silently omits itself. In dev
 * this means every cron runs on every instance, but there's only one.
 * In prod without Redis nothing else works either.
 */
@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly client: Redis | null;
  private static readonly RELEASE_SCRIPT = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `.trim();

  constructor(config: ConfigService) {
    const host = config.get<string>('processing.redis.host', '');
    const port = config.get<number>('processing.redis.port', 6379);
    const tlsEnabled = config.get<boolean>('processing.redis.tls', false);

    if (!process.env.REDIS_HOST || !host) {
      this.logger.warn(
        'DistributedLockService: REDIS_HOST unset — withLock() will always acquire (unsafe for multi-instance).',
      );
      this.client = null;
      return;
    }

    const caCert = process.env.REDIS_CA_CERT;
    const options: RedisOptions = {
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableAutoPipelining: true,
      ...(tlsEnabled
        ? { tls: caCert ? { ca: caCert } : { rejectUnauthorized: false } }
        : {}),
    };

    this.client = new Redis(options);
    this.client.on('error', (err) => {
      this.logger.warn(`Redis lock client error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  /**
   * Acquire a lock, run `body`, release. If the lock is already held,
   * returns null WITHOUT running the body — caller decides whether
   * that's a no-op (typical cron dedup) or an error.
   *
   * @param key    Unique lock name — convention: `lock:cron:<slug>`
   * @param ttlMs  Max time the lock will be held. Auto-releases after
   *               even if the process dies. MUST exceed your body's
   *               worst-case runtime; 60s is a reasonable default for
   *               most cron methods.
   * @param body   Async function to run while lock is held.
   */
  async withLock<T>(
    key: string,
    ttlMs: number,
    body: () => Promise<T>,
  ): Promise<T | null> {
    if (!this.client) {
      // Redis unavailable — run body without a lock (fine for local dev,
      // unsafe in prod but the app is already crippled anyway).
      return body();
    }

    const token = randomUUID();
    let acquired = false;
    try {
      const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
      acquired = result === 'OK';
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      this.logger.warn(
        `Lock acquire failed for ${key} (${errorObj.message}); running body without lock.`,
      );
      return body();
    }

    if (!acquired) {
      // Another instance holds it. Silently skip — this IS the dedup.
      return null;
    }

    try {
      return await body();
    } finally {
      try {
        // eval with CAS release — only free the key if we still own it
        await this.client.eval(
          DistributedLockService.RELEASE_SCRIPT,
          1,
          key,
          token,
        );
      } catch (err: unknown) {
        const errorObj = err as { message?: string };
        this.logger.debug(
          `Lock release failed for ${key} (${errorObj.message}); TTL will free it.`,
        );
      }
    }
  }
}
