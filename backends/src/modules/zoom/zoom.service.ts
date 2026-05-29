import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { systemSettings } from '../../database/schema';
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
  ZoomSeat,
  ZoomConnectionStatus,
} from './zoom.interface';

/** system_settings category that stores admin-editable Zoom config. */
const ZOOM_SETTINGS_CATEGORY = 'zoom';

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

  // Default-host cache. Read on every meeting/webinar creation, so we
  // keep a short TTL rather than hitting the DB each time. Invalidated
  // immediately when an admin saves a new default host.
  private cachedDefaultHost: string | null = null;
  private defaultHostExpiresAt = 0;
  private static readonly DEFAULT_HOST_TTL_MS = 60_000;

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

  /**
   * Read the admin-configured default host email (system_settings →
   * 'zoom'). Cached for a short TTL. Empty string / null means "no
   * default configured" — callers fall back to the app owner ('me').
   */
  private async getDefaultHostEmail(): Promise<string | null> {
    const now = Date.now();
    if (now < this.defaultHostExpiresAt) {
      return this.cachedDefaultHost;
    }
    try {
      const rows = await db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.category, ZOOM_SETTINGS_CATEGORY))
        .limit(1);
      const value = (rows[0]?.value ?? {}) as { defaultHostEmail?: string };
      const email = value.defaultHostEmail?.trim();
      this.cachedDefaultHost = email && email.length > 0 ? email : null;
    } catch (err) {
      // DB hiccup — don't block meeting creation; fall back to 'me'.
      this.logger.warn(
        `Failed to read Zoom default host: ${err instanceof Error ? err.message : err}`,
      );
      this.cachedDefaultHost = null;
    }
    this.defaultHostExpiresAt = now + ZoomService.DEFAULT_HOST_TTL_MS;
    return this.cachedDefaultHost;
  }

  /**
   * Build the ordered list of Zoom userId path segments to try when
   * creating a meeting/webinar: the requested instructor first, then the
   * admin-configured default host, then the OAuth app owner ('me') as the
   * ultimate safety net. Deduplicated; 'me' is always last.
   */
  private async resolveHostCandidates(hostEmail?: string): Promise<string[]> {
    const defaultHost = await this.getDefaultHostEmail();
    const emails: string[] = [];
    const seen = new Set<string>();
    for (const e of [hostEmail, defaultHost]) {
      const clean = e?.trim().toLowerCase();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        emails.push(e!.trim());
      }
    }
    const candidates = emails.map((e) => encodeURIComponent(e));
    candidates.push('me'); // app owner — always the final fallback
    return candidates;
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
      // Riyadh — the platform serves Saudi Arabia. Zoom uses this to
      // render the time in its confirmation/reminder emails; the
      // start_time (above) is still sent as a UTC ISO string so the
      // absolute instant is unambiguous regardless of timezone label.
      timezone: 'Asia/Riyadh',
      settings: {
        join_before_host: false,
        waiting_room: true,
        mute_upon_entry: true,
        auto_recording: params.recordingEnabled !== false ? 'cloud' : 'none',
        // Enable cohost so TAs can be promoted to co-host on join
        co_host: true,
        // Do NOT require Zoom account sign-in — students join as guests so
        // the ?uname= platform ID pre-fill is respected by Zoom's web client.
        // Access is controlled by the waiting room (instructor admits each person).
        meeting_authentication: false,
      },
    };

    // Try creating under the instructor's Zoom account first (if licensed),
    // then the admin-configured default host, then the app owner ('me').
    const candidates = await this.resolveHostCandidates(params.hostEmail);
    let response: Response | null = null;

    for (let i = 0; i < candidates.length; i++) {
      const userId = candidates[i];
      response = await this.zoomFetch(
        `https://api.zoom.us/v2/users/${userId}/meetings`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (response.ok) break;
      if (i < candidates.length - 1) {
        this.logger.warn(
          `Zoom: host "${decodeURIComponent(userId)}" could not create meeting (${response.status}), falling back to "${decodeURIComponent(candidates[i + 1])}"`,
        );
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : 'no response';
      this.logger.error(`Zoom create meeting failed: ${errorText}`);
      throw new Error(
        `Failed to create Zoom meeting: ${response?.status ?? 'unknown'}`,
      );
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
      hostEmail: (meeting as any).host_email || undefined,
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

      // 404 = report not yet available (can take 10-30 min after meeting ends)
      if (response.status === 404) {
        this.logger.warn(
          `Zoom participant report not yet available for meeting ${meetingId}`,
        );
        throw new Error(
          'Zoom attendance report is not yet available. Reports typically take 10-30 minutes to become available after a meeting ends. Please try again later.',
        );
      }

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
        role: p.role || 'participant',
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

  /**
   * Get the share URL for a meeting's recordings from Zoom API.
   */
  async getRecordingShareUrl(meetingId: string): Promise<string | null> {
    const token = await this.getAccessToken();

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.share_url || null;
  }

  /**
   * Remove passcode from recording so it can be viewed without authentication.
   * Uses PATCH /meetings/{meetingId}/recordings/settings
   */
  async removeRecordingPasscode(meetingId: string): Promise<boolean> {
    const token = await this.getAccessToken();

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/meetings/${meetingId}/recordings/settings`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          share_recording: 'publicly',
          viewer_download: false,
          password: '',
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.warn(
        `Failed to remove recording passcode for ${meetingId}: ${response.status} ${errorText}`,
      );
      return false;
    }

    this.logger.log(`Removed recording passcode for meeting ${meetingId}`);
    return true;
  }

  /**
   * Promote a live meeting participant to co-host.
   * Uses PUT /meetings/{meetingId}/participants/{participantId}
   * Requires `co_host: true` in meeting settings (set at creation time).
   */
  async promoteToCohost(
    meetingId: string,
    participantId: string,
  ): Promise<void> {
    const token = await this.getAccessToken();

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/live_meetings/${meetingId}/participants/${participantId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'set_role', role: 'co-host' }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.warn(
        `Failed to promote participant ${participantId} to co-host in meeting ${meetingId}: ${response.status} - ${errorText}`,
      );
      return;
    }

    this.logger.log(
      `Promoted participant ${participantId} to co-host in meeting ${meetingId}`,
    );
  }

  // ─── Webinars ─────────────────────────────────────────────────────────
  // Webinars live under /v2/users/{userId}/webinars (separate endpoint
  // from meetings). They require the Zoom Webinars add-on on the account.
  // Registration is required (registration_type: 1 = once); attendees fill
  // a Zoom-hosted form whose URL is returned in registration_url.

  async createWebinar(
    params: CreateZoomWebinarParams,
  ): Promise<CreateZoomWebinarResult> {
    const token = await this.getAccessToken();

    const body: Record<string, unknown> = {
      topic: params.topic,
      type: 5, // 5 = scheduled webinar
      start_time: params.startTime.toISOString(),
      duration: params.durationMinutes,
      // Riyadh — the platform serves Saudi Arabia. Zoom uses this to
      // render the time in its confirmation/reminder emails; the
      // start_time (above) is still sent as a UTC ISO string so the
      // absolute instant is unambiguous regardless of timezone label.
      timezone: 'Asia/Riyadh',
      // Agenda is rendered as the description under the topic on Zoom's
      // hosted registration page — we surface the parent course here.
      ...(params.agenda ? { agenda: params.agenda } : {}),
      settings: {
        // 1 = attendees register once and can attend any occurrence; suits
        // our single-session-per-webinar model.
        registration_type: 1,
        // 0 = automatically approve everyone (no manual moderation).
        approval_type: 0,
        // We send our own platform emails; suppress Zoom defaults to avoid
        // duplicates. The confirmation email with the personal join URL is
        // still sent on registration — controlled by registrants_confirmation_email.
        registrants_email_notification: true,
        registrants_confirmation_email: true,
        auto_recording: params.recordingEnabled !== false ? 'cloud' : 'none',
        // Practice session always ON. Host + panelists join privately to
        // prep mic/screen/etc.; registered attendees who click their join
        // link land in the waiting room. When the host clicks
        // "Start Webinar", all waiting attendees enter at once.
        practice_session: true,
        // HD video for both panelists and attendees.
        hd_video: true,
      },
    };

    // Try the requested host, then the admin default host, then 'me'.
    const candidates = await this.resolveHostCandidates(params.hostEmail);
    let response: Response | null = null;

    for (let i = 0; i < candidates.length; i++) {
      const userId = candidates[i];
      response = await this.zoomFetch(
        `https://api.zoom.us/v2/users/${userId}/webinars`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (response.ok) break;
      if (i < candidates.length - 1) {
        this.logger.warn(
          `Zoom: host "${decodeURIComponent(userId)}" not webinar-licensed (${response.status}), falling back to "${decodeURIComponent(candidates[i + 1])}"`,
        );
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : 'no response';
      this.logger.error(`Zoom create webinar failed: ${errorText}`);
      throw new Error(
        `Failed to create Zoom webinar: ${response?.status ?? 'unknown'}`,
      );
    }

    const webinar: {
      id: number;
      start_url: string;
      registration_url?: string;
      join_url?: string;
    } = await response.json();

    this.logger.log(`Zoom webinar created: ${webinar.id}`);

    return {
      webinarId: String(webinar.id),
      // For registration-required webinars Zoom returns registration_url;
      // some account types only return join_url which still routes through
      // the registration page when registration is required.
      registrationUrl: webinar.registration_url || webinar.join_url || '',
      startUrl: webinar.start_url,
    };
  }

  /**
   * Fetch webinar details — primarily for the host start_url so the
   * instructor can launch the webinar from our app.
   */
  async getWebinar(webinarId: string): Promise<{
    startUrl: string;
    joinUrl: string;
    hostEmail: string | null;
    topic: string;
    startTime: string;
  }> {
    const token = await this.getAccessToken();
    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/webinars/${encodeURIComponent(webinarId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Zoom get webinar failed: ${errorText}`);
      throw new Error(`Failed to get Zoom webinar: ${response.status}`);
    }
    const w: any = await response.json();
    return {
      startUrl: w.start_url || '',
      joinUrl: w.join_url || '',
      hostEmail: w.host_email || null,
      topic: w.topic || '',
      startTime: w.start_time || '',
    };
  }

  /**
   * Add ID/Iqama, Phone, SCFHS as required custom registration questions.
   * The default Zoom fields (First Name, Last Name, Email) are always
   * present and cannot be removed.
   */
  async configureStandardWebinarQuestions(webinarId: string): Promise<void> {
    const token = await this.getAccessToken();

    const body = {
      // Built-in fields. Phone is OPTIONAL per client spec.
      questions: [
        { field_name: 'phone', required: false },
      ],
      // Custom questions — text fields shown after the defaults.
      // ID/Iqama is required; SCFHS is optional (write "NO" if not applicable).
      // NOTE: `answers` is omitted because Zoom only accepts it for
      // type=single/multiple choice questions; including `answers: []` on
      // a short-text question fails with "Invalid field".
      custom_questions: [
        {
          title: 'ID No / Iqama',
          type: 'short',
          required: true,
        },
        {
          title: 'Saudi Health Commission License Number (write "NO" if not applicable)',
          type: 'short',
          required: false,
        },
      ],
    };

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/webinars/${encodeURIComponent(webinarId)}/registrants/questions`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `Failed to configure webinar questions for ${webinarId}: ${response.status} - ${errorText}`,
      );
      throw new Error(
        `Failed to configure webinar registration questions: ${response.status} ${errorText.slice(0, 200)}`,
      );
    }

    this.logger.log(`Configured custom registration questions for webinar ${webinarId}`);
  }

  async updateWebinar(
    webinarId: string,
    params: UpdateZoomWebinarParams,
  ): Promise<void> {
    const token = await this.getAccessToken();

    const body: Record<string, unknown> = {};
    if (params.topic) body.topic = params.topic;
    if (params.startTime) body.start_time = params.startTime.toISOString();
    if (params.durationMinutes !== undefined) body.duration = params.durationMinutes;
    if (params.startTime) body.timezone = 'UTC';

    if (Object.keys(body).length === 0) return;

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/webinars/${encodeURIComponent(webinarId)}`,
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
      this.logger.error(`Zoom update webinar failed: ${errorText}`);
      throw new Error(`Failed to update Zoom webinar: ${response.status}`);
    }
  }

  async deleteWebinar(
    webinarId: string,
  ): Promise<{ deleted: boolean; error?: string }> {
    const token = await this.getAccessToken();

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/webinars/${encodeURIComponent(webinarId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    // 404 means it's already gone — treat as success.
    if (response.ok || response.status === 404) {
      this.logger.log(`Zoom webinar deleted: ${webinarId}`);
      return { deleted: true };
    }

    const errorText = await response.text();
    this.logger.error(`Zoom delete webinar failed: ${errorText}`);
    return { deleted: false, error: errorText };
  }

  /**
   * Register a single user for a webinar. Zoom dedupes by email — if the
   * email is already registered, Zoom returns the existing registrant's
   * data (including their join URL), which is what we want.
   */
  async registerForWebinar(
    webinarId: string,
    registrant: WebinarRegistrantInput,
  ): Promise<WebinarRegistrantResult> {
    const token = await this.getAccessToken();

    const body: Record<string, unknown> = {
      email: registrant.email,
      first_name: registrant.firstName,
      last_name: registrant.lastName || '',
    };
    if (registrant.phone) body.phone = registrant.phone;
    // Custom questions are submitted as a name-keyed array. Names must
    // match what was configured in configureStandardWebinarQuestions.
    const custom: Array<{ title: string; value: string }> = [];
    if (registrant.nationalId) {
      custom.push({ title: 'ID No / Iqama', value: registrant.nationalId });
    }
    custom.push({
      title: 'Saudi Health Commission License Number (write "NO" if not applicable)',
      value: registrant.scfhsNumber || 'NO',
    });
    if (custom.length > 0) body.custom_questions = custom;

    const response = await this.zoomFetch(
      `https://api.zoom.us/v2/webinars/${encodeURIComponent(webinarId)}/registrants`,
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
      this.logger.error(`Zoom webinar register failed: ${errorText}`);
      throw new Error(`Failed to register for webinar: ${response.status}`);
    }

    const data: { registrant_id?: string; id?: string; join_url: string } =
      await response.json();
    return {
      registrantId: String(data.registrant_id || data.id || ''),
      joinUrl: data.join_url,
    };
  }

  /**
   * Check whether a Zoom user has a webinar license assigned. Used by the
   * manager dashboard to warn before submit if the picked instructor isn't
   * webinar-licensed. We probe GET /users/{email} and inspect feature flags
   * (zoom_webinar / large_meeting_capacity / type=2 Licensed).
   */
  async checkWebinarLicense(email: string) {
    if (!email) {
      return {
        userExists: false,
        hasWebinarLicense: false,
        userType: null,
        error: 'No email provided',
      };
    }
    try {
      const token = await this.getAccessToken();
      const response = await this.zoomFetch(
        `https://api.zoom.us/v2/users/${encodeURIComponent(email)}?login_type=99`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.status === 404) {
        return {
          userExists: false,
          hasWebinarLicense: false,
          userType: null,
        };
      }
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`Zoom license check failed (${email}): ${errorText}`);
        return {
          userExists: false,
          hasWebinarLicense: false,
          userType: null,
          error: `Zoom API ${response.status}`,
        };
      }

      const user: any = await response.json();
      const features = user?.feature || {};
      const hasWebinar =
        features.zoom_webinar === true ||
        Boolean(features.webinar_capacity) ||
        Boolean(features.large_meeting_capacity);
      return {
        userExists: true,
        hasWebinarLicense: hasWebinar,
        userType: typeof user?.type === 'number' ? user.type : null,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Zoom license check threw for ${email}: ${msg}`);
      return {
        userExists: false,
        hasWebinarLicense: false,
        userType: null,
        error: msg,
      };
    }
  }

  // ─── Admin host management ───────────────────────────────────────────

  async getZoomConfig(): Promise<ZoomConfig> {
    return { defaultHostEmail: await this.getDefaultHostEmail() };
  }

  async setDefaultHostEmail(
    email: string | null,
    actorId: string,
  ): Promise<void> {
    const clean = email?.trim() || null;
    const value = { defaultHostEmail: clean };

    await db
      .insert(systemSettings)
      .values({
        category: ZOOM_SETTINGS_CATEGORY,
        value,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.category,
        set: { value, updatedBy: actorId, updatedAt: new Date() },
      });

    // Invalidate the cache so the change takes effect on the very next
    // meeting/webinar without waiting for the TTL.
    this.cachedDefaultHost = clean;
    this.defaultHostExpiresAt = Date.now() + ZoomService.DEFAULT_HOST_TTL_MS;
    this.logger.log(`Zoom default host set to: ${clean ?? '(app owner)'}`);
  }

  async getAccountInfo(): Promise<ZoomAccountInfo> {
    const token = await this.getAccessToken();

    const meRes = await this.zoomFetch('https://api.zoom.us/v2/users/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) {
      const errorText = await meRes.text();
      this.logger.error(`Zoom get account info failed: ${errorText}`);
      throw new Error(`Failed to read Zoom account: ${meRes.status}`);
    }
    const me: any = await meRes.json();

    // List active users and surface only the licensed seats (type === 2).
    const licensedSeats: ZoomSeat[] = [];
    try {
      const usersRes = await this.zoomFetch(
        'https://api.zoom.us/v2/users?status=active&page_size=300',
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      );
      if (usersRes.ok) {
        const data: any = await usersRes.json();
        for (const u of data.users || []) {
          if (u.type === 2) {
            licensedSeats.push({
              email: u.email || '',
              name:
                `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
                u.email ||
                '',
              type: u.type,
            });
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `Zoom user list failed (account info still returned): ${err instanceof Error ? err.message : err}`,
      );
    }

    return {
      ownerEmail: me.email || '',
      ownerName: `${me.first_name || ''} ${me.last_name || ''}`.trim(),
      accountId: me.account_id || this.accountId || '',
      type: typeof me.type === 'number' ? me.type : 0,
      licensedSeats,
    };
  }

  async testConnection(email?: string): Promise<ZoomConnectionStatus> {
    // 1) Credentials valid? Force a fresh token to truly exercise OAuth.
    try {
      this.cachedToken = null;
      this.tokenExpiresAt = 0;
      await this.getAccessToken();
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    // 2) Optionally validate a specific host seat.
    if (email?.trim()) {
      const host = await this.checkWebinarLicense(email.trim());
      return { connected: true, host: { ...host, email: email.trim() } };
    }
    return { connected: true };
  }
}
