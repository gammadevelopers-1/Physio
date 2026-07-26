import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { courseMaterials, courses, users } from '../../../database/schema';
import { WcagService } from './wcag.service';
import { ProcessingService } from '../processing.service';
import { UserNotificationsService } from '../../user-notifications/user-notifications.service';
import { EmailService } from '../../email/email.service';

/**
 * Pure WCAG-compliance-check pipeline. Formerly the body of
 * WcagProcessor.process(). Extracted so both entry points share it:
 *
 *   1. Legacy BullMQ WcagProcessor (drain catch-net for pre-migration
 *      jobs — the producers no longer push here).
 *   2. Cloud Run Job entry point (WcagJob → `wcag.check` handler in
 *      JobRegistry). Every new material after Phase 3 goes through
 *      this path.
 *
 * Efficiency change from the old processor: we NO LONGER download the
 * source file for materialType === 'video'. WcagService only reads
 * hasCaptions/hasTranscript booleans for videos — the file was never
 * inspected. Skipping the download avoids up to 500 MB of GCS egress
 * per video and lets the Cloud Run Job stay at 512 MiB RAM.
 */
@Injectable()
export class WcagRunner {
  private readonly logger = new Logger(WcagRunner.name);
  private readonly tempDir: string;

  constructor(
    private wcagService: WcagService,
    private processingService: ProcessingService,
    private configService: ConfigService,
    private userNotificationsService: UserNotificationsService,
    private emailService: EmailService,
  ) {
    this.tempDir = this.configService.get<string>('processing.tempDir') || '/tmp/physio-processing';
  }

  async run(params: {
    materialId: string;
    materialType: string;
    courseId: string;
    hasCaptions: boolean;
    hasTranscript: boolean;
    fileUrl: string | null;
    mimeType?: string;
  }): Promise<void> {
    const { materialId, materialType, hasCaptions, hasTranscript, fileUrl, mimeType } = params;
    this.logger.log(`Running WCAG check for material ${materialId} (type: ${materialType})`);

    let tempFilePath: string | null = null;
    let tempDirPath: string | null = null;

    try {
      // 1. Download file to temp — SKIPPED for videos (WcagService reads
      // only hasCaptions/hasTranscript booleans for that type; the file
      // was previously downloaded and thrown away, up to 500 MB per run).
      if (fileUrl && materialType !== 'video') {
        tempDirPath = path.join(this.tempDir, `wcag-${materialId}`);
        fs.mkdirSync(tempDirPath, { recursive: true });
        const ext = fileUrl.split('.').pop() || 'bin';
        tempFilePath = path.join(tempDirPath, `source.${ext}`);
        await this.downloadFile(fileUrl, tempFilePath);
        this.logger.log(`Downloaded file for WCAG inspection: ${tempFilePath}`);
      }

      // 2. Run WCAG compliance check.
      const result = await this.wcagService.checkCompliance({
        materialType,
        hasCaptions,
        hasTranscript,
        filePath: tempFilePath,
        mimeType,
      });

      this.logger.log(
        `WCAG result for ${materialId}: ${result.status} (score: ${result.score}) — ` +
          result.details.map((d) => `${d.passed ? 'PASS' : 'FAIL'} ${d.label}`).join(', '),
      );

      // 3. Persist wcagStatus + wcagDetails.
      const wcagStatusMap: Record<string, string> = {
        pass: 'compliant',
        warning: 'warning',
        fail: 'fail',
      };
      await db
        .update(courseMaterials)
        .set({
          wcagStatus: wcagStatusMap[result.status] || 'pending',
          wcagDetails: JSON.stringify(result.details),
          updatedAt: new Date(),
        })
        .where(eq(courseMaterials.id, materialId));

      // 4. Route based on WCAG result.
      if (result.status === 'pass') {
        await this.processingService.markLive(materialId);
        this.logger.log(`Material ${materialId} WCAG passed — marked as live`);
      } else {
        await this.processingService.markPendingReview(materialId);
        this.logger.log(
          `Material ${materialId} WCAG ${result.status} (score: ${result.score}) — routed to pending_review`,
        );
        // Fire-and-forget manager notification (never block the job on this).
        this.notifyManagersOfPendingReview(materialId, result.status, result.details).catch((err) => {
          this.logger.warn(`Failed to notify managers of pending review for ${materialId}`, err);
        });
      }
    } catch (error) {
      this.logger.error(`WCAG check failed for ${materialId}`, error);
      await this.processingService.markFailed(
        materialId,
        `WCAG check failed: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      if (tempDirPath) {
        try {
          fs.rmSync(tempDirPath, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    }
  }

  private async notifyManagersOfPendingReview(
    materialId: string,
    wcagStatus: string,
    wcagDetails: Array<{ passed: boolean; label: string; detail: string }>,
  ): Promise<void> {
    const [material] = await db
      .select({
        id: courseMaterials.id,
        title: courseMaterials.title,
        courseId: courseMaterials.courseId,
      })
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);

    if (!material) return;

    const [course] = await db
      .select({
        title: courses.title,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
      })
      .from(courses)
      .innerJoin(users, eq(courses.instructorId, users.id))
      .where(eq(courses.id, material.courseId))
      .limit(1);

    const courseName = course?.title || 'Unknown Course';
    const instructorName =
      [course?.instructorFirstName, course?.instructorLastName].filter(Boolean).join(' ') ||
      'Unknown Instructor';

    const managers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
      })
      .from(courses)
      .innerJoin(users, eq(courses.managerId, users.id))
      .where(eq(courses.id, material.courseId));

    if (managers.length === 0) return;

    for (const mgr of managers) {
      const mgrLocale = (mgr.language || 'en') as 'en' | 'ar';
      const isAr = mgrLocale === 'ar';

      const wcagSummary = wcagDetails
        .map((d) => `${d.passed ? '✓' : '✗'} ${d.label}: ${d.detail}`)
        .join('\n');

      await this.userNotificationsService.create({
        recipientId: mgr.id,
        type: 'content_pending_review',
        title: isAr ? 'محتوى بانتظار المراجعة' : 'Content Pending Review',
        message: isAr
          ? `"${material.title}" من ${instructorName} في ${courseName} يتطلب مراجعة (WCAG ${wcagStatus})`
          : `"${material.title}" from ${instructorName} in ${courseName} requires review (WCAG ${wcagStatus})`,
        link: '/dashboard/manager/content-review',
        entityType: 'material',
        entityId: material.id,
      });

      const name = [mgr.firstName, mgr.lastName].filter(Boolean).join(' ') || 'Manager';
      this.emailService
        .sendContentPendingReview(
          mgr.email,
          {
            recipientName: name,
            materialTitle: material.title,
            courseName,
            instructorName,
            wcagStatus,
            wcagSummary,
          },
          mgrLocale,
        )
        .catch(() => {});
    }

    this.logger.log(`Notified ${managers.length} manager(s) about pending review for material ${materialId}`);
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (
        url.startsWith('/') ||
        url.includes('localhost') ||
        url.includes('physio-backend')
      ) {
        const localPattern = '/storage/files/public/';
        const idx = url.indexOf(localPattern);
        if (idx !== -1) {
          const relativePath = url.substring(idx + localPattern.length);
          const localPath = path.join(process.cwd(), 'uploads', 'public', relativePath);
          if (fs.existsSync(localPath)) {
            fs.copyFileSync(localPath, dest);
            return resolve();
          }
        }
      }

      // Same defensive pattern as the other runners.
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
      protocol
        .get(url, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              file.close();
              return this.downloadFile(redirectUrl, dest).then(resolve, reject);
            }
          }
          if (
            !response.statusCode ||
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            file.close();
            fs.unlink(dest, () => {});
            return reject(
              new Error(`Source download failed: HTTP ${response.statusCode} for ${url}`),
            );
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    });
  }
}
