import { Injectable, Logger } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';

const RUN_API = 'https://run.googleapis.com/v2';

/**
 * Thin client for triggering Cloud Run Jobs from within the api-web
 * service. Uses ADC (the runtime service account) to sign REST calls to
 * `projects.locations.jobs.run` with per-execution container overrides
 * (env vars). Fire-and-forget by design — Cloud Run returns
 * immediately with an Operation handle; we don't await job completion.
 *
 * Auth model: the api-web service account needs `roles/run.developer`
 * on the target Job. Grant via:
 *
 *   gcloud run jobs add-iam-policy-binding physio-job-video-transcode \
 *     --region=me-central2 \
 *     --member=serviceAccount:<api-web-runtime-sa> \
 *     --role=roles/run.developer
 *
 * Failure behaviour: if the run() call fails (auth, quota, job not
 * found), we throw. The caller (ProcessingService.dispatch...) can
 * decide whether to fall back to BullMQ or mark the material as
 * failed. Do NOT swallow the error silently — a failed dispatch that
 * looks succeeded is exactly how materials get stuck.
 */
@Injectable()
export class CloudRunJobsService {
  private readonly logger = new Logger(CloudRunJobsService.name);

  private readonly projectId =
    process.env.GCP_PROJECT_ID || 'nelc-elearning-platform-479319';
  private readonly region = process.env.GCP_REGION || 'me-central2';

  private auth: GoogleAuth | null = null;

  /**
   * Trigger a Cloud Run Job execution with the given env var overrides.
   * The overrides are ADDED to (not replaced with) the Job's stored
   * env — so the Job definition supplies the shared runtime config
   * (DATABASE_URL, REDIS_HOST, etc.) and the caller supplies the
   * per-invocation params (MATERIAL_ID, FILE_URL, ...).
   *
   * Fire-and-forget: returns as soon as Cloud Run acknowledges the
   * run request, NOT when the job finishes. The job may run for
   * minutes. Failures inside the job are surfaced via the material's
   * row (markFailed) + the reaper cron, not via this call.
   *
   * The env-var override contract:
   *   Cloud Run Jobs `run` API accepts `overrides.containerOverrides[].env`
   *   as an array of {name, value}. We flatten the passed record into
   *   that shape. Values must be strings.
   */
  async runJob(
    jobName: string,
    envOverrides: Record<string, string>,
  ): Promise<{ operationName: string }> {
    const url = `${RUN_API}/projects/${this.projectId}/locations/${this.region}/jobs/${jobName}:run`;

    const body = {
      overrides: {
        containerOverrides: [
          {
            env: Object.entries(envOverrides).map(([name, value]) => ({
              name,
              value,
            })),
          },
        ],
      },
    };

    const token = await this.getAccessToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Cloud Run Jobs runJob('${jobName}') failed: ${res.status} ${res.statusText} — ${text}`,
      );
    }

    const json = (await res.json()) as { name?: string };
    const operationName = json.name ?? '(unnamed operation)';
    this.logger.log(
      `Triggered Cloud Run Job '${jobName}' (op: ${operationName})`,
    );
    return { operationName };
  }

  private getAuth(): GoogleAuth {
    if (!this.auth) {
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }
    return this.auth;
  }

  private async getAccessToken(): Promise<string> {
    const client = await this.getAuth().getClient();
    const res = await client.getAccessToken();
    if (!res.token) throw new Error('Failed to obtain GCP access token');
    return res.token;
  }
}
