import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { OidcVerifierService } from './oidc-verifier.service';
import { TaskHandlerRegistry } from './task-handler.registry';
import { PermanentTaskError } from './task-handler.interface';
import { TaskEnvelope } from './task-payload';

/**
 * Entry point for every Cloud Task delivery.
 *
 *   POST /internal/tasks/dispatch
 *   Authorization: Bearer <google-signed-oidc-token>
 *   Content-Type:  application/json
 *   Body:          TaskEnvelope
 *
 * Flow:
 *   1. Verify OIDC token (signed by Google, audience matches, SA
 *      in allow-list). 401 on any failure.
 *   2. Look up handler by envelope.handler. 400 if unknown (permanent,
 *      Cloud Tasks won't retry).
 *   3. Call handler.run(...) with entityId + payload + taskVersion.
 *   4. Map handler outcome to HTTP status:
 *        - success            → 200 OK
 *        - PermanentTaskError → 400 (no retry)
 *        - any other error    → 500 (Cloud Tasks retries per queue policy)
 *
 * Public route (no JWT guard) because Cloud Tasks doesn't have a user
 * JWT — OIDC verification is the auth here.
 *
 * Throttled generously — Cloud Tasks queue-side rate-limits already
 * govern real load; this bucket just defends against pathological
 * infinite retry loops after a queue misconfig.
 */
@Public()
@Controller('internal/tasks')
export class TasksDispatchController {
  private readonly logger = new Logger(TasksDispatchController.name);

  constructor(
    private readonly oidc: OidcVerifierService,
    private readonly registry: TaskHandlerRegistry,
  ) {}

  @Post('dispatch')
  @HttpCode(200)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async dispatch(
    @Headers('authorization') authHeader: string | undefined,
    @Body() envelope: TaskEnvelope,
  ) {
    // 1. OIDC verification (throws UnauthorizedException on failure)
    if (this.oidc.isEnabled()) {
      await this.oidc.verifyBearer(authHeader);
    }

    // 2. Envelope validation
    if (!envelope || typeof envelope !== 'object') {
      throw new BadRequestException('Malformed task envelope');
    }
    const { handler, entityId, payload, taskVersion, enqueuedAt } = envelope;
    if (!handler || typeof handler !== 'string') {
      throw new BadRequestException('Missing handler slug');
    }
    if (!entityId || typeof entityId !== 'string') {
      throw new BadRequestException('Missing entityId');
    }
    if (typeof taskVersion !== 'number') {
      throw new BadRequestException('Missing taskVersion');
    }

    // 3. Handler lookup
    const target = this.registry.get(handler);
    if (!target) {
      // 400 not 500 — this is a permanent config error, retrying won't help
      this.logger.warn(
        `Unknown task handler "${handler}" (known: ${this.registry.list().join(', ')})`,
      );
      throw new NotFoundException(`Unknown task handler: ${handler}`);
    }

    // 4. Execute + translate outcome
    const startedAt = Date.now();
    try {
      await target.run({ entityId, payload, taskVersion });
      const elapsedMs = Date.now() - startedAt;
      this.logger.log(
        `Task ${handler}[${entityId}] v${taskVersion} completed in ${elapsedMs}ms (enqueued ${enqueuedAt})`,
      );
      return { ok: true, elapsedMs };
    } catch (err) {
      if (err instanceof PermanentTaskError) {
        this.logger.error(
          `Task ${handler}[${entityId}] v${taskVersion} PERMANENT failure: ${err.message}`,
        );
        // 400 tells Cloud Tasks: don't retry
        throw new BadRequestException(err.message);
      }
      const errorObj = err as { message?: string };
      this.logger.error(
        `Task ${handler}[${entityId}] v${taskVersion} transient failure: ${errorObj.message}`,
      );
      // Re-throw as-is → Nest turns it into 500 → Cloud Tasks retries
      throw err;
    }
  }
}
