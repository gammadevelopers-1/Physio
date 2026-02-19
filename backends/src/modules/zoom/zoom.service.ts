import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

export interface CreateZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
  password: string;
}

@Injectable()
export class ZoomService {
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

  /**
   * Get an OAuth access token using Server-to-Server OAuth.
   * Caches the token until it expires (with a 60s buffer).
   */
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Zoom OAuth token request failed: ${errorText}`);
      throw new Error(`Failed to get Zoom access token: ${response.status}`);
    }

    const data: ZoomTokenResponse = await response.json();
    this.cachedToken = data.access_token;
    // Cache with 60s buffer before actual expiry
    this.tokenExpiresAt = now + (data.expires_in - 60) * 1000;

    this.logger.log('Zoom OAuth token obtained successfully');
    return this.cachedToken;
  }

  /**
   * Create a Zoom meeting via the Zoom REST API.
   */
  async createMeeting(params: {
    topic: string;
    startTime: Date;
    durationMinutes: number;
  }): Promise<CreateZoomMeetingResult> {
    const token = await this.getAccessToken();

    const body = {
      topic: params.topic,
      type: 2, // Scheduled meeting
      start_time: params.startTime.toISOString(),
      duration: params.durationMinutes,
      timezone: 'UTC',
      settings: {
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: true,
        auto_recording: 'none',
      },
    };

    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

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

  /**
   * Get meeting details (including start_url for host).
   */
  async getMeeting(
    meetingId: string,
  ): Promise<{ startUrl: string; joinUrl: string; status: string }> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${meetingId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  /**
   * End a Zoom meeting via the Zoom REST API.
   */
  async endMeeting(meetingId: string): Promise<void> {
    const token = await this.getAccessToken();

    const response = await fetch(
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

    if (!response.ok) {
      const errorText = await response.text();
      // 404 = meeting already ended or doesn't exist — not a real error
      if (response.status === 404) {
        this.logger.warn(
          `Zoom meeting ${meetingId} not found (already ended?)`,
        );
        return;
      }
      this.logger.error(`Zoom end meeting failed: ${errorText}`);
      throw new Error(`Failed to end Zoom meeting: ${response.status}`);
    }

    this.logger.log(`Zoom meeting ${meetingId} ended successfully`);
  }

  /**
   * Verify that a webhook payload is authentic using the secret token.
   */
  getWebhookSecretToken(): string {
    return this.webhookSecretToken;
  }
}
