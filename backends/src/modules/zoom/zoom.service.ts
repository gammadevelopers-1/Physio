import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IZoomService,
  CreateZoomMeetingParams,
  CreateZoomMeetingResult,
  ZoomMeetingDetails,
  ZoomParticipantReport,
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

@Injectable()
export class ZoomService implements IZoomService {
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
    this.tokenExpiresAt = now + (data.expires_in - 60) * 1000;

    this.logger.log('Zoom OAuth token obtained successfully');
    return this.cachedToken;
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

  async getMeeting(meetingId: string): Promise<ZoomMeetingDetails> {
    const token = await this.getAccessToken();

    const response = await fetch(
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

  getWebhookSecretToken(): string {
    return this.webhookSecretToken;
  }

  async getParticipantReport(
    meetingId: string,
  ): Promise<ZoomParticipantReport[]> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://api.zoom.us/v2/report/meetings/${meetingId}/participants?page_size=300`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

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

    this.logger.log(
      `Zoom participant report for ${meetingId}: ${participants.length} participants`,
    );

    return participants;
  }
}
