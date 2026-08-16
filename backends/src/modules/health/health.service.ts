import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { pool } from '../../database';

type CheckResult = { ok: boolean; latencyMs?: number; error?: string };

@Injectable()
export class HealthService {
  constructor(private configService: ConfigService) {}

  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV'),
      uptime: process.uptime(),
    };
  }

  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness() {
    const checks: Record<string, CheckResult> = {};

    const dbStart = Date.now();
    try {
      await pool.query('SELECT 1');
      checks.database = { ok: true, latencyMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = { ok: false, error: (err as Error).message };
    }

    checks.redis = await this.checkRedis();

    const body = {
      status: checks.database.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };

    if (!checks.database.ok) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }

  private async checkRedis(): Promise<CheckResult> {
    const host = this.configService.get<string>('processing.redis.host', '');
    if (!process.env.REDIS_HOST || !host || host === 'localhost') {
      return { ok: true, error: 'not_configured' };
    }

    const port = this.configService.get<number>('processing.redis.port', 6379);
    const tls = this.configService.get<boolean>('processing.redis.tls', false);
    const caCert = process.env.REDIS_CA_CERT;
    const start = Date.now();
    const client = new Redis({
      host,
      port,
      // Match DistributedLockService: pass CA cert when Memorystore
      // provides one, otherwise skip verification. Bare `tls: {}` fails
      // the handshake because Memorystore's cert isn't in the default
      // trust store.
      ...(tls
        ? { tls: caCert ? { ca: caCert } : { rejectUnauthorized: false } }
        : {}),
      connectTimeout: 2000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    try {
      await client.connect();
      await client.ping();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      client.disconnect();
    }
  }
}
