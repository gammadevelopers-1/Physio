/**
 * IZoomService — Interface for Zoom operations.
 * Business logic injects this token, NEVER concrete classes.
 * At runtime the module provides either ZoomService (real) or ZoomMockService
 * based on ZOOM_MOCK env var.
 */
export const ZOOM_SERVICE = 'ZOOM_SERVICE';

export interface CreateZoomMeetingParams {
  topic: string;
  startTime: Date;
  durationMinutes: number;
}

export interface CreateZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
  password: string;
}

export interface ZoomMeetingDetails {
  startUrl: string;
  joinUrl: string;
  status: string;
}

export interface ZoomParticipantReport {
  id: string;
  name: string;
  userEmail: string;
  joinTime: string;
  leaveTime: string;
  duration: number; // seconds
}

export interface IZoomService {
  createMeeting(params: CreateZoomMeetingParams): Promise<CreateZoomMeetingResult>;
  getMeeting(meetingId: string): Promise<ZoomMeetingDetails>;
  endMeeting(meetingId: string): Promise<void>;
  getWebhookSecretToken(): string;
  getParticipantReport(meetingId: string): Promise<ZoomParticipantReport[]>;
}
