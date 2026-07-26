import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from '../../jobs/job-handler.interface';
import { JobRegistry } from '../../jobs/job-registry.service';
import { WcagRunner } from '../services/wcag.runner';

/**
 * Cloud Run Jobs form of the WCAG compliance check.
 *
 * Triggered from THREE call sites (all via CloudRunJobsService.runJob):
 *   - VideoTranscodeRunner (skip-captions branch)
 *   - CaptionsRunner (final chain step after captions + transcript)
 *   - ProcessingService.dispatchWcagOnly (non-video materials skip
 *     straight to WCAG)
 *
 * Cloud Run spins up a fresh container (1 vCPU / 512 MiB / 5-min
 * timeout) that boots main-job.ts, resolves this handler by name,
 * reads per-execution env vars, runs the check, updates the material
 * row, and (for warning/fail) notifies managers via email +
 * in-app. Container exits when done — zero idle cost.
 *
 * Env-var contract (all UPPERCASE strings, since Cloud Run env is
 * string-only):
 *   MATERIAL_ID       — uuid of course_materials row
 *   MATERIAL_TYPE     — "video" | "pdf" | "document" | "image"
 *   COURSE_ID         — uuid of parent course
 *   HAS_CAPTIONS      — "true" | "false"
 *   HAS_TRANSCRIPT    — "true" | "false"
 *   FILE_URL          — public URL to source file (may be empty)
 *   MIME_TYPE         — optional, e.g. "application/pdf"
 */
@Injectable()
export class WcagJob implements JobHandler {
  private readonly logger = new Logger(WcagJob.name);
  readonly name = 'wcag.check';

  constructor(
    registry: JobRegistry,
    private readonly runner: WcagRunner,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    const materialId = process.env.MATERIAL_ID;
    const materialType = process.env.MATERIAL_TYPE;
    const courseId = process.env.COURSE_ID;
    const hasCaptions = process.env.HAS_CAPTIONS === 'true';
    const hasTranscript = process.env.HAS_TRANSCRIPT === 'true';
    const fileUrl = process.env.FILE_URL || null;
    const mimeType = process.env.MIME_TYPE || undefined;

    if (!materialId || !materialType || !courseId) {
      throw new Error(
        `wcag.check: missing required env — MATERIAL_ID=${!!materialId} MATERIAL_TYPE=${!!materialType} COURSE_ID=${!!courseId}. ` +
          `The producer (CloudRunJobsService.runJob) must pass all three via container-overrides.`,
      );
    }

    this.logger.log(
      `Cloud Run Job invoked for material ${materialId} (type=${materialType})`,
    );

    await this.runner.run({
      materialId,
      materialType,
      courseId,
      hasCaptions,
      hasTranscript,
      fileUrl,
      mimeType,
    });
  }
}
