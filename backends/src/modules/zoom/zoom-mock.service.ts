import { Injectable, Logger } from '@nestjs/common';
import {
  IZoomService,
  CreateZoomMeetingParams,
  CreateZoomMeetingResult,
  ZoomMeetingDetails,
  ZoomParticipantReport,
} from './zoom.interface';
import { randomUUID } from 'crypto';

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

  async endMeeting(meetingId: string): Promise<void> {
    const meeting = this.meetings.get(meetingId);
    if (meeting) {
      meeting.status = 'ended';
    }
    this.logger.log(`[MOCK] Zoom meeting ended: ${meetingId}`);
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
}
