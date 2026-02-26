import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IZoomService,
  CreateZoomMeetingParams,
  CreateZoomMeetingResult,
  UpdateZoomMeetingParams,
  ZoomMeetingDetails,
  ZoomParticipantReport,
  ZoomRecordingFile,
} from './zoom.interface';

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomMeetingResponse {
  id: number;
  uuid: string;
  host_id: string;
  topic: string;
  type: number;
  start_url: string;
  join_url: string;
  password: string;
  duration: number;
  start_time: string;
}

const REQUEST_TIMEOUT_MS = 15_000; // 15 seconds
const MAX_RATE_LIMIT_RETRIES = 3;

@Injectable()
export class ZoomService implements IZoomService, OnModuleInit {
  private readonly logger = new Logger(ZoomService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  private readonly accountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookSecretToken: string;

  constructor(private configService: ConfigService) {
    this.accountId = this.configService.get<string>('zoom.accountId', '');
    this.clientId = this.configService.get<string>('zoom.clientId', '');
    this.clientSecret = this.configService.get<string>('zoom.clientSecret', '');
    this.webhookSecretToken = this.configService.get<string>(
      'zoom.webhookSecretToken',
      '',
    );
  }

  /** Validate Zoom config on startup (item #18) */
  onModuleInit() {
    if (!this.accountId || !this.clientId || !this.clientSecret) {
      this.logger.error(
        'Zoom credentials are missing! Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET env vars. ' +
          'Zoom API calls will fail until credentials are provided.',
      );
    }
    if (!this.webhookSecretToken) {
      this.logger.warn(
        'ZOOM_WEBHOOK_SECRET_TOKEN is not set. Webhook signature verification will be skipped.',
      );
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: this.accountId,
    });

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Clear cached token on failure (item #3)
      this.cachedToken = null;
      this.tokenExpiresAt = 0;
      this.logger.error(`Zoom OAuth token request failed: ${errorText}`);
      throw new Error(`Failed to get Zoom access token: ${response.status}`);
    }

    const data: ZoomTokenResponse = await response.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = now + (data.expires_in - 60) * 1000;

    this.logger.log('Zoom OAuth token obtained successfully');
    return this.cachedToken;
  }

  /**
   * Wrapper for Zoom API calls with timeout + rate limit handling (items #6, #7).
   * Retries on 429 with Retry-After header, exponential backoff fallback.
   */
  private async zoomFetch(
    url: string,
    options: RequestInit,
    attempt = 1,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      // Handle rate limiting (429)
      if (response.status === 429 && attempt <= MAX_RATE_LIMIT_RETRIES) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 10000); // exponential backoff

        this.logger.warn(
          `Zoom API rate limited (429). Retry ${attempt}/${MAX_RATE_LIMIT_RETRIES} after ${waitMs}ms`,
        );
        await new Promise((r) => setTimeout(r, waitMs));

        // Re-fetch token in case it expired during wait
        const token = await this.getAccessToken();
        const newHeaders = new Headers(options.headers);
        newHeaders.set('Authorization', `Bearer ${token}`);

        return this.zoomFetch(url, { ...options, headers: newHeaders }, attempt + 1);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createMeeting(
    params: CreateZoomMeetingParams,
  ): Promise<CreateZoomMeetingResult> {
    const token = await this.getAccessToken();

    const body = {
      topic: params.topic,
      type: 2,
      start_time: params.startTime.toISOString(),
      duration: params.durationMinutes,
      timezone: 'UTC',
      settings: {
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: true,
        auto_recording: params.recordingEnabled !== false ? 'cloud' : 'none',
      },
    };

    const response = await this.zoomFetch(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Zoom create meeting failed: ${errorText}`);
      throw new Error(`Failed to create Zoom meeting: ${response.status}`);
    }

    const meeting: ZoomMeetingResponse = await response.json();
    this.logger.log(`Zoom meeting created: ${meeting.id}`);

    return {
      meetingId: String(meeting.id),
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
      password: meeting.password,
    };
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingDetails> {
    const token = await this.getAccessToken();

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Zoom get meeting failed: ${errorText}`);
      throw new Error(`Failed to get Zoom meeting: ${response.status}`);
    }

    const meeting: ZoomMeetingResponse = await response.json();

    return {
      startUrl: meeting.start_url,
      joinUrl: meeting.join_url,
      status: (meeting as any).status || 'waiting',
    };
  }

  async updateMeeting(
    meetingId: string,
    params: UpdateZoomMeetingParams,
  ): Promise<void> {
    const token = await this.getAccessToken();

    const body: Record<string, unknown> = {};
    if (params.topic) body.topic = params.topic;
    if (params.startTime) body.start_time = params.startTime.toISOString();
    if (params.durationMinutes) body.duration = params.durationMinutes;
    if (params.startTime || params.durationMinutes) body.timezone = 'UTC';

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text();
      this.logger.error(
        `Zoom update meeting ${meetingId} failed: ${response.status} - ${errorText}`,
      );
      throw new Error(`Failed to update Zoom meeting: ${response.status}`);
    }

    this.logger.log(`Zoom meeting ${meetingId} updated successfully`);
  }

  async deleteMeeting(
    meetingId: string,
  ): Promise<{ deleted: boolean; error?: string }> {
    try {
      const token = await this.getAccessToken();

      const response = await this.zoomFetch(
        `https://api.zoom.us/v2/meetings/${meetingId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok || response.status === 204) {
        this.logger.log(`Zoom meeting ${meetingId} deleted successfully`);
        return { deleted: true };
      }

      if (response.status === 404) {
        this.logger.warn(
          `Zoom meeting ${meetingId} not found (already deleted?)`,
        );
        return { deleted: true };
      }

      const errorText = await response.text();
      this.logger.error(
        `Zoom delete meeting ${meetingId} failed: ${response.status} - ${errorText}`,
      );
      return {
        deleted: false,
        error: `Zoom API ${response.status}: ${errorText.slice(0, 200)}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Zoom delete meeting ${meetingId} threw: ${msg}`);
      return { deleted: false, error: msg };
    }
  }

  async endMeeting(
    meetingId: string,
  ): Promise<{ ended: boolean; error?: string }> {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const token = await this.getAccessToken();

        const response = await this.zoomFetch(
          `https://api.zoom.us/v2/meetings/${meetingId}/status`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'end' }),
          },
        );

        if (response.ok || response.status === 204) {
          this.logger.log(`Zoom meeting ${meetingId} ended successfully`);
          return { ended: true };
        }

        const errorText = await response.text();

        if (response.status === 404) {
          this.logger.warn(
            `Zoom meeting ${meetingId} not found (already ended?)`,
          );
          return { ended: true };
        }

        if (response.status === 400) {
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.code === 3001) {
              this.logger.warn(
                `Zoom meeting ${meetingId} does not exist (code 3001)`,
              );
              return { ended: true };
            }
          } catch {
            /* not JSON, fall through */
          }
        }

        if (attempt < maxAttempts) {
          this.logger.warn(
            `Zoom endMeeting attempt ${attempt} failed (${response.status}), retrying in 1s...`,
          );
          await new Promise((r) => setTimeout(r, 1000));
          this.cachedToken = null;
          continue;
        }

        this.logger.error(
          `Zoom end meeting failed after ${maxAttempts} attempts: ${response.status} - ${errorText}`,
        );
        return {
          ended: false,
          error: `Zoom API ${response.status}: ${errorText.slice(0, 200)}`,
        };
      } catch (error) {
        if (attempt < maxAttempts) {
          this.logger.warn(
            `Zoom endMeeting attempt ${attempt} threw, retrying in 1s...`,
          );
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Zoom end meeting threw after ${maxAttempts} attempts: ${msg}`,
        );
        return { ended: false, error: msg };
      }
    }

    return { ended: false, error: 'Unreachable' };
  }

  getWebhookSecretToken(): string {
    return this.webhookSecretToken;
  }

  /**
   * Fetch participant report with pagination (item #8).
   * Loops through all pages using next_page_token for >300 participants.
   */
  async getParticipantReport(
    meetingId: string,
  ): Promise<ZoomParticipantReport[]> {
    const token = await this.getAccessToken();
    const allParticipants: ZoomParticipantReport[] = [];
    let nextPageToken = '';

    do {
      const url = new URL(
        `https://api.zoom.us/v2/report/meetings/${meetingId}/participants`,
      );
      url.searchParams.set('page_size', '300');
      if (nextPageToken) {
        url.searchParams.set('next_page_token', nextPageToken);
      }

      const response = await this.zoomFetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Zoom participant report failed: ${errorText}`);
        throw new Error(
          `Failed to get participant report: ${response.status}`,
        );
      }

      const data = await response.json();
      const participants: ZoomParticipantReport[] = (
        data.participants || []
      ).map((p: any) => ({
        id: p.id || p.participant_uuid || '',
        name: p.name || '',
        userEmail: p.user_email || '',
        joinTime: p.join_time || '',
        leaveTime: p.leave_time || '',
        duration: p.duration || 0,
      }));

      allParticipants.push(...participants);
      nextPageToken = data.next_page_token || '';
    } while (nextPageToken);

    this.logger.log(
      `Zoom participant report for ${meetingId}: ${allParticipants.length} participants`,
    );

    return allParticipants;
  }

  /**
   * Fetch cloud recordings for a meeting (item #22).
   */
  async getRecordings(meetingId: string): Promise<ZoomRecordingFile[]> {
    const token = await this.getAccessToken();

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // 404 = no recordings yet
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Zoom get recordings failed: ${errorText}`);
      throw new Error(`Failed to get recordings: ${response.status}`);
    }

    const data = await response.json();
    const recordings: ZoomRecordingFile[] = (
      data.recording_files || []
    ).map((r: any) => ({
      id: r.id || '',
      meetingId: String(data.id || meetingId),
      recordingType: r.recording_type || '',
      downloadUrl: r.download_url || '',
      playUrl: r.play_url || '',
      fileSize: r.file_size || 0,
      fileType: r.file_type || '',
      recordingStart: r.recording_start || '',
      recordingEnd: r.recording_end || '',
      status: r.status || 'completed',
      password: data.password || undefined,
    }));

    this.logger.log(
      `Zoom recordings for ${meetingId}: ${recordings.length} files`,
    );

    return recordings;
  }
}
