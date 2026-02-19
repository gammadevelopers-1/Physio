import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { sessions, SESSION_STATUS } from '../../database/schema';
import { ZoomService } from './zoom.service';
import { Public } from '../auth/decorators';
import * as crypto from 'crypto';

@Controller('zoom')
export class ZoomController {
  private readonly logger = new Logger(ZoomController.name);

  constructor(private zoomService: ZoomService) {}

  /**
   * POST /zoom/webhook
   * Receives Zoom webhook events.
   * This endpoint is public (no JWT required) — Zoom must be able to call it.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: any,
    @Headers('x-zm-request-timestamp') timestamp: string,
    @Headers('x-zm-signature') signature: string,
  ) {
    // ─── URL Validation Challenge ──────────────────────────
    // Zoom sends this during webhook endpoint verification setup
    if (body.event === 'endpoint.url_validation') {
      const hashForValidate = crypto
        .createHmac('sha256', this.zoomService.getWebhookSecretToken())
        .update(body.payload?.plainToken || '')
        .digest('hex');

      this.logger.log('Zoom webhook URL validation handled');

      return {
        plainToken: body.payload?.plainToken,
        encryptedToken: hashForValidate,
      };
    }

    // ─── Signature Verification ────────────────────────────
    const secretToken = this.zoomService.getWebhookSecretToken();
    if (secretToken && timestamp && signature) {
      const message = `v0:${timestamp}:${JSON.stringify(body)}`;
      const expectedSig =
        'v0=' +
        crypto
          .createHmac('sha256', secretToken)
          .update(message)
          .digest('hex');

      if (signature !== expectedSig) {
        this.logger.warn('Zoom webhook signature verification failed');
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    // ─── Handle Events ─────────────────────────────────────
    const event = body.event;
    this.logger.log(`Zoom webhook event received: ${event}`);

    if (event === 'meeting.ended') {
      await this.handleMeetingEnded(body.payload?.object);
    }

    return { status: 'ok' };
  }

  /**
   * When a Zoom meeting ends, find the session by meetingId
   * and update its status to completed.
   */
  private async handleMeetingEnded(meeting: any) {
    if (!meeting?.id) {
      this.logger.warn('meeting.ended event received without meeting id');
      return;
    }

    const meetingId = String(meeting.id);
    this.logger.log(`Meeting ended: ${meetingId}`);

    // Find session with this meetingId that is currently live
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.meetingId, meetingId))
      .limit(1);

    if (!session) {
      this.logger.warn(
        `No session found for Zoom meetingId: ${meetingId}`,
      );
      return;
    }

    if (
      session.status !== SESSION_STATUS.LIVE &&
      session.status !== SESSION_STATUS.SCHEDULED
    ) {
      this.logger.log(
        `Session ${session.id} already ${session.status}, skipping`,
      );
      return;
    }

    await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.COMPLETED,
        actualEndedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));

    this.logger.log(
      `Session ${session.id} marked as completed via Zoom webhook`,
    );
  }
}
