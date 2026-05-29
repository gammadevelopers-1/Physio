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

// ─── Webinar types ─────────────────────────────────────────────────────────

export interface CreateZoomWebinarParams {
  topic: string;
  startTime: Date;
  durationMinutes: number;
  /** Instructor / manager email. Webinar is created under their account if licensed. */
  hostEmail?: string;
  recordingEnabled?: boolean;
  /**
   * Optional description shown on the Zoom-hosted registration page,
   * directly below the topic. We use this to surface the parent course
   * name so registrants see the broader context (e.g. "Part of: …").
   * Max ~2000 chars per Zoom API.
   */
  agenda?: string;
}

export interface CreateZoomWebinarResult {
  /** Numeric webinar ID (stringified). */
  webinarId: string;
  /** Public Zoom-hosted registration page URL. */
  registrationUrl: string;
  /** Start URL used by the host. */
  startUrl: string;
}

export interface UpdateZoomWebinarParams {
  topic?: string;
  startTime?: Date;
  durationMinutes?: number;
}

/**
 * Custom registration questions the manager wants on every webinar's
 * registration page. Default Zoom questions (First Name, Last Name, Email)
 * are always present; we add ID/Iqama, Phone, SCFHS as custom required.
 */
export interface WebinarRegistrantInput {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  /** Custom field: ID / Iqama number. */
  nationalId?: string;
  /** Custom field: SCFHS license number; pass 'NO' when not applicable. */
  scfhsNumber?: string;
}

export interface WebinarRegistrantResult {
  /** Opaque Zoom registrant id. */
  registrantId: string;
  /** Personal join URL for this registrant. */
  joinUrl: string;
}

export interface WebinarLicenseCheckResult {
  /** Zoom user exists for this email. */
  userExists: boolean;
  /** User has a webinar add-on assigned. */
  hasWebinarLicense: boolean;
  /** Zoom user type — 1=Basic, 2=Licensed, 3=On-Prem. Webinars require 2. */
  userType: number | null;
  /** Free-form error if we couldn't probe (rate limit, account access etc). */
  error?: string;
}

/** Admin-editable Zoom config persisted in system_settings (category 'zoom'). */
export interface ZoomConfig {
  /**
   * Fallback host used when a session's instructor isn't a licensed seat.
   * Replaces the implicit app-owner ('me') fallback. Null → fall back to
   * the OAuth app owner as before.
   */
  defaultHostEmail: string | null;
}

/** A licensed seat on the connected Zoom account. */
export interface ZoomSeat {
  email: string;
  name: string;
  /** 1=Basic, 2=Licensed, 3=On-Prem. */
  type: number;
}

/** Summary of the connected Zoom account (from /users/me). */
export interface ZoomAccountInfo {
  ownerEmail: string;
  ownerName: string;
  accountId: string;
  /** Owner seat type — 2=Licensed. */
  type: number;
  /** Licensed seats on the account (type === 2), owner included. */
  licensedSeats: ZoomSeat[];
}

/** Result of a connection / host validation probe. */
export interface ZoomConnectionStatus {
  /** OAuth token fetch succeeded — the credentials are valid. */
  connected: boolean;
  /** Present only when an email was supplied to validate a specific seat. */
  host?: WebinarLicenseCheckResult & { email: string };
  error?: string;
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

  // Webinar surface
  createWebinar(params: CreateZoomWebinarParams): Promise<CreateZoomWebinarResult>;
  /**
   * Retrieve a webinar's metadata + the host's personal `start_url` so the
   * instructor (host) can open the webinar in Zoom from our app.
   */
  getWebinar(webinarId: string): Promise<{
    startUrl: string;
    joinUrl: string;
    hostEmail: string | null;
    topic: string;
    startTime: string;
  }>;
  /** Add ID/Iqama, Phone, SCFHS as required custom registration questions. */
  configureStandardWebinarQuestions(webinarId: string): Promise<void>;
  updateWebinar(webinarId: string, params: UpdateZoomWebinarParams): Promise<void>;
  deleteWebinar(webinarId: string): Promise<{ deleted: boolean; error?: string }>;
  registerForWebinar(
    webinarId: string,
    registrant: WebinarRegistrantInput,
  ): Promise<WebinarRegistrantResult>;
  /** Check whether a Zoom user has a webinar add-on assigned. */
  checkWebinarLicense(email: string): Promise<WebinarLicenseCheckResult>;

  // ─── Admin host management ───────────────────────────────────────────
  /** Read the admin-editable Zoom config (default fallback host). */
  getZoomConfig(): Promise<ZoomConfig>;
  /** Persist the default fallback host email; clears the host cache. */
  setDefaultHostEmail(email: string | null, actorId: string): Promise<void>;
  /** Connected-account summary + licensed seat list (from /users/me + /users). */
  getAccountInfo(): Promise<ZoomAccountInfo>;
  /** Probe credentials; optionally validate a specific host seat. */
  testConnection(email?: string): Promise<ZoomConnectionStatus>;
}
