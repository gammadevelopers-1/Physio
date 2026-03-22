import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { eq, and, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  attendance,
  sessionRecordings,
  SESSION_STATUS,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { ZOOM_SERVICE, IZoomService } from './zoom.interface';
import { ZoomWebhookService } from './zoom-webhook.service';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { Public } from '../auth/decorators';
import * as crypto from 'crypto';

/** Deduplication: track processed webhook event IDs with TTL (item #15) */
const PROCESSED_EVENTS = new Map<string, number>();
const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupProcessedEvents() {
  const now = Date.now();
  for (const [key, ts] of PROCESSED_EVENTS) {
    if (now - ts > DEDUP_TTL_MS) {
      PROCESSED_EVENTS.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupProcessedEvents, 5 * 60 * 1000).unref();

@Controller('zoom')
export class ZoomController {
  private readonly logger = new Logger(ZoomController.name);

  constructor(
    @Inject(ZOOM_SERVICE) private zoomService: IZoomService,
    private webhookService: ZoomWebhookService,
    private auditService: NelcAuditService,
  ) {}

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

    // ─── Signature Verification (item #1: timing-safe compare) ──
    const secretToken = this.zoomService.getWebhookSecretToken();
    if (secretToken && secretToken !== 'mock-webhook-secret' && timestamp && signature) {
      const message = `v0:${timestamp}:${JSON.stringify(body)}`;
      const expectedSig =
        'v0=' +
        crypto
          .createHmac('sha256', secretToken)
          .update(message)
          .digest('hex');

      // Timing-safe comparison to prevent timing attacks
      const sigBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSig, 'utf8');
      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        this.logger.warn('Zoom webhook signature verification failed');
        throw new BadRequestException('Invalid webhook signature');
      }

      // ─── Timestamp Replay Protection ────────────────────
      const tsMs = Number(timestamp) * 1000;
      const ageMs = Math.abs(Date.now() - tsMs);
      const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
      if (Number.isNaN(tsMs) || ageMs > MAX_AGE_MS) {
        this.logger.warn(
          `Zoom webhook rejected: timestamp too old or invalid (age=${Math.round(ageMs / 1000)}s)`,
        );
        throw new BadRequestException('Webhook timestamp expired');
      }
    }

    // ─── Event Deduplication (item #15) ──────────────────────
    const eventId =
      body.event_ts?.toString() || body.payload?.object?.uuid || '';
    if (eventId) {
      if (PROCESSED_EVENTS.has(eventId)) {
        this.logger.debug(`Duplicate webhook event skipped: ${eventId}`);
        return { status: 'ok', duplicate: true };
      }
      PROCESSED_EVENTS.set(eventId, Date.now());
    }

    // ─── Handle Events (item #2: error isolation per handler) ──
    const event = body.event;
    this.logger.log(`Zoom webhook event received: ${event}`);

    try {
      if (event === 'meeting.started') {
        await this.handleMeetingStarted(body.payload?.object);
      } else if (event === 'meeting.ended') {
        await this.handleMeetingEnded(body.payload?.object);
      } else if (event === 'meeting.participant_joined') {
        await this.webhookService.handleParticipantJoined(body.payload?.object);
      } else if (event === 'meeting.participant_left') {
        await this.webhookService.handleParticipantLeft(body.payload?.object);
      } else if (event === 'meeting.updated') {
        await this.handleMeetingUpdated(body.payload?.object);
      } else if (event === 'meeting.deleted') {
        await this.handleMeetingDeleted(body.payload?.object);
      } else if (event === 'recording.completed') {
        await this.handleRecordingCompleted(body.payload?.object);
      } else {
        this.logger.debug(`Unhandled Zoom event: ${event}`);
      }
    } catch (error) {
      // Log but never fail the webhook — Zoom requires 200 OK (item #2)
      this.logger.error(
        `Error handling Zoom event ${event}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }

    return { status: 'ok' };
  }

  /**
   * POST /zoom/mock-webhook
   * Mock endpoint for local development — simulates Zoom webhook events.
   * Only available when NODE_ENV !== 'production'.
   */
  @Public()
  @Post('mock-webhook')
  @HttpCode(HttpStatus.OK)
  async handleMockWebhook(@Body() body: any) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Mock webhooks disabled in production');
    }

    this.logger.log(`[MOCK] Simulating Zoom event: ${body.event}`);

    const event = body.event;

    if (event === 'meeting.started') {
      await this.handleMeetingStarted(body.payload?.object);
    } else if (event === 'meeting.participant_joined') {
      await this.webhookService.handleParticipantJoined(body.payload?.object);
    } else if (event === 'meeting.participant_left') {
      await this.webhookService.handleParticipantLeft(body.payload?.object);
    } else if (event === 'meeting.ended') {
      await this.handleMeetingEnded(body.payload?.object);
    } else if (event === 'recording.completed') {
      await this.handleRecordingCompleted(body.payload?.object);
    } else {
      return { status: 'unknown_event', event };
    }

    return { status: 'ok', mock: true };
  }

  /**
   * When a Zoom meeting starts, find the session by meetingId
   * and update its status to live (if still scheduled).
   */
  private async handleMeetingStarted(meeting: any) {
    if (!meeting?.id) {
      this.logger.warn('meeting.started event received without meeting id');
      return;
    }

    const meetingId = String(meeting.id);
    this.logger.log(`Meeting started: ${meetingId}`);

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

    if (session.status === SESSION_STATUS.LIVE) {
      this.logger.log(`Session ${session.id} already live, skipping`);
      return;
    }

    if (session.status !== SESSION_STATUS.SCHEDULED) {
      this.logger.log(
        `Session ${session.id} is ${session.status}, cannot start`,
      );
      return;
    }

    await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.LIVE,
        actualStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.SESSION_STARTED,
      entityType: 'session',
      entityId: session.id,
      metadata: {
        sessionId: session.id,
        courseId: session.courseId,
        instructorId: session.instructorId,
        method: 'zoom_webhook',
      },
    });

    this.logger.log(
      `Session ${session.id} marked as live via Zoom meeting.started webhook`,
    );
  }

  /**
   * When a Zoom meeting ends, find the session by meetingId,
   * close open attendance records, and update status to completed.
   */
  private async handleMeetingEnded(meeting: any) {
    if (!meeting?.id) {
      this.logger.warn('meeting.ended event received without meeting id');
      return;
    }

    const meetingId = String(meeting.id);
    this.logger.log(`Meeting ended: ${meetingId}`);

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

    const endedAt = new Date();

    // Close out open attendance records
    const openRecords = await db
      .select({ id: attendance.id, studentId: attendance.studentId })
      .from(attendance)
      .where(
        and(
          eq(attendance.sessionId, session.id),
          isNotNull(attendance.joinedAt),
          isNull(attendance.leftAt),
        ),
      );

    for (const record of openRecords) {
      try {
        const totalMinutes =
          await this.webhookService.calculateTotalDuration(
            session.id,
            record.studentId,
          );
        await db
          .update(attendance)
          .set({
            leftAt: endedAt,
            durationMinutes: totalMinutes,
          })
          .where(eq(attendance.id, record.id));
      } catch (error) {
        this.logger.warn(
          `Failed to close attendance for student ${record.studentId}`,
          error,
        );
      }
    }

    if (openRecords.length > 0) {
      this.logger.log(
        `Closed ${openRecords.length} open attendance records for session ${session.id}`,
      );
    }

    await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.ENDED,
        actualEndedAt: endedAt,
        updatedAt: endedAt,
      })
      .where(eq(sessions.id, session.id));

    this.logger.log(
      `Session ${session.id} marked as ended via Zoom webhook (instructor must finalize after marking attendance)`,
    );
  }

  /**
   * Handle meeting.updated event from Zoom (item #16).
   * Logs the change — we do NOT overwrite our session data since our DB is the source of truth.
   */
  private async handleMeetingUpdated(meeting: any) {
    if (!meeting?.id) return;
    const meetingId = String(meeting.id);

    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.meetingId, meetingId))
      .limit(1);

    if (session) {
      this.logger.log(
        `Zoom meeting ${meetingId} updated externally (session ${session.id}). ` +
          'Our DB remains source of truth — no changes applied.',
      );
    }
  }

  /**
   * Handle meeting.deleted event from Zoom (item #16).
   * If someone deletes the meeting on Zoom side, log a warning.
   */
  private async handleMeetingDeleted(meeting: any) {
    if (!meeting?.id) return;
    const meetingId = String(meeting.id);

    const [session] = await db
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.meetingId, meetingId))
      .limit(1);

    if (session && session.status !== SESSION_STATUS.CANCELLED) {
      this.logger.warn(
        `Zoom meeting ${meetingId} deleted externally but session ${session.id} is still ${session.status}. ` +
          'Instructor may need to recreate the Zoom meeting.',
      );
    }
  }

  /**
   * Handle recording.completed event from Zoom (item #22).
   * Stores recording files in session_recordings table.
   */
  private async handleRecordingCompleted(payload: any) {
    const meetingId = String(payload?.id || '');
    if (!meetingId) {
      this.logger.warn('recording.completed: no meeting id in payload');
      return;
    }

    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.meetingId, meetingId))
      .limit(1);

    if (!session) {
      this.logger.warn(
        `No session found for recording meetingId: ${meetingId}`,
      );
      return;
    }

    const recordingFiles = payload?.recording_files || [];
    const shareUrl = payload?.share_url || null;
    let inserted = 0;

    for (const file of recordingFiles) {
      try {
        await db.insert(sessionRecordings).values({
          sessionId: session.id,
          meetingId,
          recordingType: file.recording_type || 'unknown',
          downloadUrl: file.download_url || null,
          playUrl: file.play_url || null,
          shareUrl,
          fileSize: file.file_size || null,
          fileType: file.file_type || null,
          recordingStart: file.recording_start
            ? new Date(file.recording_start)
            : null,
          recordingEnd: file.recording_end
            ? new Date(file.recording_end)
            : null,
          status: file.status || 'completed',
          password: payload.password || null,
        });
        inserted++;
      } catch (error) {
        this.logger.error(
          `Failed to save recording file for session ${session.id}: ${(error as Error).message}`,
        );
      }
    }

    if (inserted > 0) {
      this.logger.log(
        `Saved ${inserted} recording files for session ${session.id} (meeting ${meetingId})`,
      );

      // Remove passcode so students can view without authentication
      this.zoomService
        .removeRecordingPasscode(meetingId)
        .catch((err) =>
          this.logger.warn(`Failed to remove recording passcode: ${err}`),
        );

      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.SESSION_STARTED, // reuse closest event type
        entityType: 'recording',
        entityId: session.id,
        metadata: {
          sessionId: session.id,
          meetingId,
          recordingCount: inserted,
          source: 'zoom_webhook',
        },
      });
    }
  }
}
