import { Injectable, Logger } from '@nestjs/common';
import { JobHandler } from '../../jobs/job-handler.interface';
import { JobRegistry } from '../../jobs/job-registry.service';
import { CaptionsRunner } from '../services/captions.runner';

/**
 * Cloud Run Jobs form of the merged captions + transcript pipeline.
 *
 * Triggered from VideoTranscodeRunner (via CloudRunJobsService.runJob(
 *   'physio-job-captions-generate', {...}
 * )) as the chain step after transcoding completes. Cloud Run spins up
 * a fresh container (1 vCPU / 1 GiB / 30-min timeout) which boots
 * main-job.ts, resolves this handler by name, reads per-execution env
 * vars, and runs the pipeline to completion. Container exits when
 * done — zero idle cost.
 *
 * Env-var contract (all UPPERCASE strings — Cloud Run env is
 * string-only):
 *   MATERIAL_ID       — uuid of course_materials row
 *   FILE_URL          — public URL to source video
 *   COURSE_ID         — uuid of parent course
 *   AUTO_TRANSCRIBE   — "true" | "false" (defaults true if unset)
 *
 * Note: unlike the old BullMQ handoff, we do NOT pass captionsText
 * across a process boundary — the Whisper output stays local to the
 * runner and is uploaded twice (VTT + TXT) inside one process. The
 * old CaptionsProcessor → TranscriptProcessor split is gone.
 */
@Injectable()
export class CaptionsJob implements JobHandler {
  private readonly logger = new Logger(CaptionsJob.name);
  readonly name = 'captions.generate';

  constructor(
    registry: JobRegistry,
    private readonly runner: CaptionsRunner,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    const materialId = process.env.MATERIAL_ID;
    const fileUrl = process.env.FILE_URL;
    const courseId = process.env.COURSE_ID;
    const autoTranscribe = process.env.AUTO_TRANSCRIBE !== 'false';

    if (!materialId || !fileUrl || !courseId) {
      throw new Error(
        `captions.generate: missing required env — MATERIAL_ID=${!!materialId} FILE_URL=${!!fileUrl} COURSE_ID=${!!courseId}. ` +
          `The producer (VideoTranscodeRunner → CloudRunJobsService.runJob) must pass all three via container-overrides.`,
      );
    }

    this.logger.log(
      `Cloud Run Job invoked for material ${materialId} (autoTranscribe=${autoTranscribe})`,
    );

    await this.runner.run({
      materialId,
      fileUrl,
      courseId,
      autoTranscribe,
    });
  }
}
