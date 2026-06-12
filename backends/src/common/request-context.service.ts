/**
 * RequestContextService — per-request store keyed by AsyncLocalStorage.
 *
 * Wraps Node's built-in async_hooks so any service deep in a request
 * handler can read context (currently: client IP + user agent) without
 * the controller plumbing it through every call.
 *
 * The store is populated by RequestContextMiddleware at the very start
 * of an HTTP request and is automatically scoped to the async chain
 * spawned from that request. Background workers (queue consumers, cron
 * jobs, scheduled tasks) never enter `als.run()`, so `getIp()` returns
 * undefined there — those call sites should pass `ipAddress: 'system'`
 * explicitly when writing audit logs.
 */

import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>();

  /**
   * Run a function with the given context. Anything called inside
   * (synchronously or asynchronously) inherits the same store.
   * The middleware is the only intended caller.
   */
  run<T>(ctx: RequestContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  /** Returns the IP captured for the current request, if any. */
  getIp(): string | undefined {
    return this.als.getStore()?.ipAddress;
  }

  /** Returns the User-Agent header for the current request, if any. */
  getUserAgent(): string | undefined {
    return this.als.getStore()?.userAgent;
  }
}
