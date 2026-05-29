import { Injectable, Logger } from '@nestjs/common';
import {
  IZoomService,
  CreateZoomMeetingParams,
  CreateZoomMeetingResult,
  UpdateZoomMeetingParams,
  ZoomMeetingDetails,
  ZoomParticipantReport,
  ZoomRecordingFile,
  CreateZoomWebinarParams,
  CreateZoomWebinarResult,
  UpdateZoomWebinarParams,
  WebinarRegistrantInput,
  WebinarRegistrantResult,
  ZoomConfig,
  ZoomAccountInfo,
  ZoomConnectionStatus,
} from './zoom.interface';

/**
 * Mock Zoom service for local development.
 * Returns fake data so the full workflow can be tested without real Zoom credentials.
 */
@Injectable()
export class ZoomMockService implements IZoomService {
  private readonly logger = new Logger(ZoomMockService.name);

  // In-memory store for mock meetings
  private meetings = new Map<
    string,
    { topic: string; startTime: Date; status: string }
  >();

  // In-memory store for mock participant reports (seeded via mock webhook endpoint)
  private participantReports = new Map<string, ZoomParticipantReport[]>();

  async createMeeting(
    params: CreateZoomMeetingParams,
  ): Promise<CreateZoomMeetingResult> {
    const meetingId = String(Math.floor(10000000000 + Math.random() * 90000000000));

    this.meetings.set(meetingId, {
      topic: params.topic,
      startTime: params.startTime,
      status: 'waiting',
    });

    this.logger.log(`[MOCK] Zoom meeting created: ${meetingId} — "${params.topic}"`);

    return {
      meetingId,
      joinUrl: `https://zoom.us/j/${meetingId}?mock=true`,
      startUrl: `https://zoom.us/s/${meetingId}?mock=true&role=host`,
      password: 'mock123',
    };
  }

  async getMeeting(meetingId: string): Promise<ZoomMeetingDetails> {
    const meeting = this.meetings.get(meetingId);

    this.logger.log(`[MOCK] Get meeting: ${meetingId}`);

    return {
      startUrl: `https://zoom.us/s/${meetingId}?mock=true&role=host`,
      joinUrl: `https://zoom.us/j/${meetingId}?mock=true`,
      status: meeting?.status || 'waiting',
    };
  }

  async updateMeeting(
    meetingId: string,
    params: UpdateZoomMeetingParams,
  ): Promise<void> {
    const meeting = this.meetings.get(meetingId);
    if (meeting) {
      if (params.topic) meeting.topic = params.topic;
      if (params.startTime) meeting.startTime = params.startTime;
    }
    this.logger.log(`[MOCK] Zoom meeting updated: ${meetingId}`);
  }

  async deleteMeeting(
    meetingId: string,
  ): Promise<{ deleted: boolean; error?: string }> {
    this.meetings.delete(meetingId);
    this.participantReports.delete(meetingId);
    this.logger.log(`[MOCK] Zoom meeting deleted: ${meetingId}`);
    return { deleted: true };
  }

  async endMeeting(
    meetingId: string,
  ): Promise<{ ended: boolean; error?: string }> {
    const meeting = this.meetings.get(meetingId);
    if (meeting) {
      meeting.status = 'ended';
    }
    this.logger.log(`[MOCK] Zoom meeting ended: ${meetingId}`);
    return { ended: true };
  }

  getWebhookSecretToken(): string {
    return 'mock-webhook-secret';
  }

  async getParticipantReport(
    meetingId: string,
  ): Promise<ZoomParticipantReport[]> {
    const reports = this.participantReports.get(meetingId) || [];
    this.logger.log(
      `[MOCK] Participant report for ${meetingId}: ${reports.length} participants`,
    );
    return reports;
  }

  async getRecordings(meetingId: string): Promise<ZoomRecordingFile[]> {
    this.logger.log(`[MOCK] Get recordings for ${meetingId}: returning empty`);
    return [];
  }

  async getRecordingShareUrl(meetingId: string): Promise<string | null> {
    this.logger.log(`[MOCK] Get recording share URL for ${meetingId}: returning null`);
    return null;
  }

  async removeRecordingPasscode(meetingId: string): Promise<boolean> {
    this.logger.log(`[MOCK] Remove recording passcode for ${meetingId}`);
    return true;
  }

  async promoteToCohost(
    meetingId: string,
    participantId: string,
  ): Promise<void> {
    this.logger.log(
      `[MOCK] Promoted participant ${participantId} to co-host in meeting ${meetingId}`,
    );
  }

  /**
   * Seed mock participant data for a meeting (used by mock webhook endpoint).
   */
  seedParticipantReport(
    meetingId: string,
    participants: ZoomParticipantReport[],
  ): void {
    const existing = this.participantReports.get(meetingId) || [];
    this.participantReports.set(meetingId, [...existing, ...participants]);
    this.logger.log(
      `[MOCK] Seeded ${participants.length} participants for meeting ${meetingId}`,
    );
  }

  // ─── Webinars (mock) ────────────────────────────────────────
  private webinars = new Map<
    string,
    { topic: string; startTime: Date; registrants: WebinarRegistrantResult[] }
  >();

  async createWebinar(
    params: CreateZoomWebinarParams,
  ): Promise<CreateZoomWebinarResult> {
    const webinarId = String(Math.floor(80000000000 + Math.random() * 10000000000));
    this.webinars.set(webinarId, {
      topic: params.topic,
      startTime: params.startTime,
      registrants: [],
    });
    this.logger.log(`[MOCK] Webinar created: ${webinarId} — "${params.topic}"`);
    return {
      webinarId,
      registrationUrl: `https://us02web.zoom.us/webinar/register/mock_${webinarId}`,
      startUrl: `https://zoom.us/s/${webinarId}?mock=true&role=host`,
    };
  }

  async configureStandardWebinarQuestions(webinarId: string): Promise<void> {
    this.logger.log(`[MOCK] Configured standard questions for webinar ${webinarId}`);
  }

  async updateWebinar(
    webinarId: string,
    params: UpdateZoomWebinarParams,
  ): Promise<void> {
    const w = this.webinars.get(webinarId);
    if (w) {
      if (params.topic) w.topic = params.topic;
      if (params.startTime) w.startTime = params.startTime;
    }
    this.logger.log(`[MOCK] Webinar updated: ${webinarId}`);
  }

  async deleteWebinar(
    webinarId: string,
  ): Promise<{ deleted: boolean; error?: string }> {
    this.webinars.delete(webinarId);
    this.logger.log(`[MOCK] Webinar deleted: ${webinarId}`);
    return { deleted: true };
  }

  async registerForWebinar(
    webinarId: string,
    registrant: WebinarRegistrantInput,
  ): Promise<WebinarRegistrantResult> {
    const result: WebinarRegistrantResult = {
      registrantId: `mock_reg_${Math.random().toString(36).slice(2, 10)}`,
      joinUrl: `https://zoom.us/w/${webinarId}?mock=true&email=${encodeURIComponent(registrant.email)}`,
    };
    const w = this.webinars.get(webinarId);
    if (w) w.registrants.push(result);
    this.logger.log(
      `[MOCK] Registered ${registrant.email} for webinar ${webinarId}`,
    );
    return result;
  }

  async checkWebinarLicense(email: string) {
    this.logger.log(`[MOCK] License check for ${email}`);
    return {
      userExists: true,
      hasWebinarLicense: true,
      userType: 2,
    };
  }

  async getWebinar(webinarId: string) {
    const w = this.webinars.get(webinarId);
    return {
      startUrl: `https://zoom.us/s/${webinarId}?mock=host`,
      joinUrl: `https://zoom.us/w/${webinarId}?mock=true`,
      hostEmail: null,
      topic: w?.topic || '[mock webinar]',
      startTime: w?.startTime?.toISOString?.() || new Date().toISOString(),
    };
  }

  // ─── Admin host management (mock) ────────────────────────────
  private mockDefaultHost: string | null = null;

  async getZoomConfig(): Promise<ZoomConfig> {
    return { defaultHostEmail: this.mockDefaultHost };
  }

  async setDefaultHostEmail(
    email: string | null,
    _actorId: string,
  ): Promise<void> {
    this.mockDefaultHost = email?.trim() || null;
    this.logger.log(`[MOCK] Default host set to: ${this.mockDefaultHost ?? '(app owner)'}`);
  }

  async getAccountInfo(): Promise<ZoomAccountInfo> {
    return {
      ownerEmail: 'owner@mock.zoom',
      ownerName: 'Mock Owner',
      accountId: 'mock-account',
      type: 2,
      licensedSeats: [
        { email: 'owner@mock.zoom', name: 'Mock Owner', type: 2 },
        { email: 'host1@mock.zoom', name: 'Mock Host One', type: 2 },
      ],
    };
  }

  async testConnection(email?: string): Promise<ZoomConnectionStatus> {
    if (email?.trim()) {
      return {
        connected: true,
        host: {
          email: email.trim(),
          userExists: true,
          hasWebinarLicense: true,
          userType: 2,
        },
      };
    }
    return { connected: true };
  }
}
