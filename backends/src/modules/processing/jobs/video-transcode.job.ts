import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from '../../jobs/job-handler.interface';
import { JobRegistry } from '../../jobs/job-registry.service';
import { VideoTranscodeRunner } from '../services/video-transcode.runner';

/**
 * Cloud Run Jobs form of the video transcoding pipeline.
 *
 * Triggered by the api-web service via `CloudRunJobsService.runJob(
 *   'physio-job-video-transcode', { MATERIAL_ID, FILE_URL, COURSE_ID,
 *   ORIGINAL_MIME_TYPE, AUTO_TRANSCRIBE }
 * )` after an instructor uploads a video. Cloud Run spins up a fresh
 * container (2 vCPU / 2 GiB, --no-cpu-throttling within the job's
 * lifetime, per-second billing) that boots main-job.ts, resolves this
 * handler by name, reads the per-execution env vars, and runs the
 * transcode pipeline to completion. Container exits when done — zero
 * idle cost.
 *
 * Retries: Cloud Run Jobs retries N times on non-zero exit (see the
 * `--max-retries` flag when the job is created). VideoTranscodeRunner
 * catches all errors, calls processingService.markFailed(), then
 * re-throws so the process exits with code 1 and Cloud Run knows to
 * retry.
 *
 * Env-var contract (all as UPPERCASE strings, since Cloud Run env
 * only carries strings):
 *   MATERIAL_ID          — uuid of course_materials row
 *   FILE_URL             — signed/public URL to source video
 *   COURSE_ID            — uuid of parent course
 *   ORIGINAL_MIME_TYPE   — e.g. "video/mp4"
 *   AUTO_TRANSCRIBE      — "true" | "false" (defaults true if unset)
 */
@Injectable()
export class VideoTranscodeJob implements JobHandler {
  private readonly logger = new Logger(VideoTranscodeJob.name);
  readonly name = 'video.transcode';

  constructor(
    registry: JobRegistry,
    private readonly runner: VideoTranscodeRunner,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    const materialId = process.env.MATERIAL_ID;
    const fileUrl = process.env.FILE_URL;
    const courseId = process.env.COURSE_ID;
    const originalMimeType = process.env.ORIGINAL_MIME_TYPE;
    const autoTranscribe = process.env.AUTO_TRANSCRIBE !== 'false';

    if (!materialId || !fileUrl || !courseId) {
      throw new Error(
        `video.transcode: missing required env — MATERIAL_ID=${!!materialId} FILE_URL=${!!fileUrl} COURSE_ID=${!!courseId}. ` +
          `The producer (CloudRunJobsService.runJob) must pass all three via container-overrides.`,
      );
    }

    this.logger.log(
      `Cloud Run Job invoked for material ${materialId} (autoTranscribe=${autoTranscribe})`,
    );

    await this.runner.run({
      materialId,
      fileUrl,
      courseId,
      originalMimeType,
      autoTranscribe,
    });
  }
}
