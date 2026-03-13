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
  recordingEnabled?: boolean;
  /** Instructor's email — if licensed on Zoom, meeting is created under their account */
  hostEmail?: string;
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
  hostEmail?: string;
}

export interface ZoomParticipantReport {
  id: string;
  name: string;
  userEmail: string;
  joinTime: string;
  leaveTime: string;
  duration: number; // seconds
  role: string; // 'host' | 'participant' | 'co-host' etc.
}

export interface UpdateZoomMeetingParams {
  topic?: string;
  startTime?: Date;
  durationMinutes?: number;
}

export interface ZoomRecordingFile {
  id: string;
  meetingId: string;
  recordingType: string;
  downloadUrl: string;
  playUrl: string;
  fileSize: number;
  fileType: string;
  recordingStart: string;
  recordingEnd: string;
  status: string;
  password?: string;
}

export interface IZoomService {
  createMeeting(params: CreateZoomMeetingParams): Promise<CreateZoomMeetingResult>;
  getMeeting(meetingId: string): Promise<ZoomMeetingDetails>;
  updateMeeting(meetingId: string, params: UpdateZoomMeetingParams): Promise<void>;
  deleteMeeting(meetingId: string): Promise<{ deleted: boolean; error?: string }>;
  endMeeting(meetingId: string): Promise<{ ended: boolean; error?: string }>;
  getWebhookSecretToken(): string;
  getParticipantReport(meetingId: string): Promise<ZoomParticipantReport[]>;
  getRecordings(meetingId: string): Promise<ZoomRecordingFile[]>;
  getRecordingShareUrl(meetingId: string): Promise<string | null>;
  removeRecordingPasscode(meetingId: string): Promise<boolean>;
  promoteToCohost(meetingId: string, participantId: string): Promise<void>;
}
