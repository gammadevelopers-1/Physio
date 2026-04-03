import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { db } from '../../../database';
import { courseMaterials, courses, users, userRoles, roles } from '../../../database/schema';
import { QUEUE_NAMES } from '../constants';
import { WcagService } from '../services/wcag.service';
import { ProcessingService } from '../processing.service';
import { UserNotificationsService } from '../../user-notifications/user-notifications.service';
import { EmailService } from '../../email/email.service';
import type { WcagJobData } from '../interfaces';

@Processor(QUEUE_NAMES.WCAG, { concurrency: 4 })
export class WcagProcessor extends WorkerHost {
  private readonly logger = new Logger(WcagProcessor.name);
  private readonly tempDir: string;

  constructor(
    private wcagService: WcagService,
    private processingService: ProcessingService,
    private configService: ConfigService,
    private userNotificationsService: UserNotificationsService,
    private emailService: EmailService,
  ) {
    super();
    this.tempDir = this.configService.get<string>('processing.tempDir') || '/tmp/physio-processing';
  }

  async process(job: Job<WcagJobData>): Promise<void> {
    const { materialId, materialType, hasCaptions, hasTranscript, fileUrl, mimeType } = job.data;
    this.logger.log(`Running WCAG check for material ${materialId} (type: ${materialType})`);

    let tempFilePath: string | null = null;
    let tempDirPath: string | null = null;

    try {
      // 1. Download file to temp if fileUrl is available
      if (fileUrl) {
        tempDirPath = path.join(this.tempDir, `wcag-${materialId}`);
        fs.mkdirSync(tempDirPath, { recursive: true });
        const ext = fileUrl.split('.').pop() || 'bin';
        tempFilePath = path.join(tempDirPath, `source.${ext}`);
        await this.downloadFile(fileUrl, tempFilePath);
        this.logger.log(`Downloaded file for WCAG inspection: ${tempFilePath}`);
      }

      // 2. Run WCAG compliance check with actual file
      const result = await this.wcagService.checkCompliance({
        materialType,
        hasCaptions,
        hasTranscript,
        filePath: tempFilePath,
        mimeType,
      });

      this.logger.log(
        `WCAG result for ${materialId}: ${result.status} (score: ${result.score}) — ` +
        result.details.map(d => `${d.passed ? 'PASS' : 'FAIL'} ${d.label}`).join(', '),
      );

      // 3. Update wcagStatus + wcagDetails in DB
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

      // 4. Route based on WCAG result:
      //    - pass → auto-approve (markLive) or pending_review (based on config)
      //    - warning/fail → always pending_review (manager must approve)
      if (result.status === 'pass') {
        await this.processingService.markLive(materialId);
        this.logger.log(`Material ${materialId} WCAG passed — marked as live/pending per config`);
      } else {
        await this.processingService.markPendingReview(materialId);
        this.logger.log(
          `Material ${materialId} WCAG ${result.status} (score: ${result.score}) — routed to pending_review for manager approval`,
        );
        // Notify managers about pending review (fire-and-forget)
        this.notifyManagersOfPendingReview(materialId, result.status, result.details).catch((err) => {
          this.logger.warn(`Failed to notify managers of pending review for ${materialId}`, err);
        });
      }
    } catch (error) {
      this.logger.error(`WCAG check failed for ${materialId}`, error);
      await this.processingService.markFailed(materialId, `WCAG check failed: ${(error as Error).message}`);
      throw error;
    } finally {
      // 5. Cleanup temp files
      if (tempDirPath) {
        try {
          fs.rmSync(tempDirPath, { recursive: true, force: true });
        } catch {
          // Cleanup failure is non-critical
        }
      }
    }
  }

  /**
   * Notify all managers that content needs review.
   */
  private async notifyManagersOfPendingReview(
    materialId: string,
    wcagStatus: string,
    wcagDetails: Array<{ passed: boolean; label: string; detail: string }>,
  ): Promise<void> {
    // 1. Fetch material + course + instructor info
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
    const instructorName = [course?.instructorFirstName, course?.instructorLastName]
      .filter(Boolean).join(' ') || 'Unknown Instructor';

    // 2. Get all managers
    const managers = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, language: users.language })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(roles.name, 'MANAGER'));

    if (managers.length === 0) return;

    const wcagSummary = wcagDetails
      .map((d) => `${d.passed ? '\u2713' : '\u2717'} ${d.label}: ${d.detail}`)
      .join('\n');

    // 3. In-app notifications (bulk)
    await this.userNotificationsService.createBulk(
      managers.map((m) => m.id),
      {
        type: 'content_pending_review',
        title: 'Content Pending Review',
        message: `"${material.title}" from ${instructorName} in ${courseName} requires review (WCAG ${wcagStatus})`,
        link: '/dashboard/manager/content-review',
        entityType: 'material',
        entityId: material.id,
      },
    );

    // 4. Email each manager (fire-and-forget)
    for (const mgr of managers) {
      const name = [mgr.firstName, mgr.lastName].filter(Boolean).join(' ') || 'Manager';
      const mgrLocale = (mgr.language || 'en') as 'en' | 'ar';
      this.emailService.sendContentPendingReview(mgr.email, {
        recipientName: name,
        materialTitle: material.title,
        courseName,
        instructorName,
        wcagStatus,
        wcagSummary,
      }, mgrLocale).catch(() => {});
    }

    this.logger.log(`Notified ${managers.length} manager(s) about pending review for material ${materialId}`);
  }

  /**
   * Download a file from URL or local storage path to a destination.
   * Reuses the same pattern from TranscodingProcessor/CaptionsProcessor.
   */
  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Handle local storage URLs (relative paths)
      if (url.startsWith('/') || url.includes('localhost') || url.includes('physio-backend')) {
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

      // HTTP(S) download
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      protocol.get(url, (response) => {
        // Follow redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            return this.downloadFile(redirectUrl, dest).then(resolve, reject);
          }
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }
}
